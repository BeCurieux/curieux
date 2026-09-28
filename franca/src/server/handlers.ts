/**
 * The app's HTTP surface, as plain functions from a `Request` to a `Response`.
 *
 * The files under `src/app/api` are one line each: they build the real
 * dependencies and call one of these. Everything with a decision in it is
 * here, where the tests can reach it with a fake Shopify.
 *
 *   POST /api/shopify/session   who am I, which plan, which markets, last scan
 *   POST /api/shopify/markets   choose markets, within the plan
 *   POST /api/shopify/scan      read every product and scan it
 *   GET  /api/shopify/results   the last scan
 *   POST /api/shopify/webhooks  everything Shopify sends
 */

import { supportedJurisdictions } from "../engine/registry.js";
import { webhookAction, type WebhookAction } from "../shopify/actions.js";
import { AdminApiError } from "../shopify/admin/client.js";
import { readCatalogueCopy, readProductCopy } from "../shopify/admin/products.js";
import { scanCatalogue, scanProduct } from "../shopify/catalogue.js";
import { verifyWebhookSignature } from "../shopify/hmac.js";
import { shouldApplyProduct } from "../shopify/idempotency.js";
import {
  PLANS,
  accessFor,
  chooseMarkets,
  isPlanHandle,
  planSelectionUrl,
  type Access,
  type Entitlements,
} from "../shopify/plans.js";
import { readDelivery, subscribedTopic } from "../shopify/webhook.js";
import { lookupPlan } from "./planLookup.js";
import { accessTokenFor, adminFor, authenticate, type Deps, type Session } from "./session.js";
import type { Installation } from "./store.js";
import { catalogueView } from "./view.js";

// ------------------------------------------------------------------ session

export async function handleSession(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const access = await planAccess(session, deps);
  const catalogue = await deps.store.getCatalogue(session.shop);

  return Response.json({
    shop: session.shop,
    access: access.kind,
    plan: access.kind === "granted" ? planView(access.entitlements) : null,
    planUrl: planSelectionUrl(session.shop, deps.config.appHandle),
    markets: session.installation.markets,
    availableMarkets: supportedJurisdictions(),
    catalogue: catalogue ? catalogueView(catalogue) : null,
  });
}

// ------------------------------------------------------------------ markets

export async function handleMarkets(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const access = await planAccess(session, deps);
  const gate = requireGranted(access, session, deps);
  if (gate) return gate;
  const entitlements = (access as Extract<Access, { kind: "granted" }>).entitlements;

  const body = (await request.json().catch(() => null)) as { markets?: unknown } | null;
  const requested = Array.isArray(body?.markets) ? body.markets.filter((m): m is string => typeof m === "string") : [];
  const choice = chooseMarkets(entitlements, requested);
  if (!choice.ok) return Response.json({ error: choice.reason, detail: choice.detail }, { status: 422 });

  const installation = await currentInstallation(session, deps);
  await deps.store.putInstallation({ ...installation, markets: choice.markets, updatedAt: deps.now().toISOString() });
  return Response.json({ markets: choice.markets });
}

// ------------------------------------------------------------------ scan

export async function handleScan(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const access = await planAccess(session, deps);
  const gate = requireGranted(access, session, deps);
  if (gate) return gate;
  const entitlements = (access as Extract<Access, { kind: "granted" }>).entitlements;

  const installation = await currentInstallation(session, deps);
  const markets = installation.markets;
  // A plan downgraded since the markets were chosen can leave more selected
  // than it covers. Ask again rather than scanning the first N silently.
  if (!markets || !chooseMarkets(entitlements, markets).ok) {
    return Response.json({ error: "choose-markets" }, { status: 409 });
  }

  let read;
  try {
    read = await readCatalogueCopy(session.admin, {
      limit: Number.isFinite(entitlements.maxProducts) ? entitlements.maxProducts : undefined,
    });
  } catch (error) {
    return Response.json({ error: "shopify-unavailable", detail: describe(error) }, { status: 502 });
  }

  const catalogue = { ...scanCatalogue(read.products, markets, deps.now), truncated: read.truncated };
  await deps.store.putCatalogue(session.shop, catalogue);
  return Response.json(catalogueView(catalogue));
}

export async function handleResults(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const catalogue = await deps.store.getCatalogue(auth.session.shop);
  return Response.json(catalogue ? catalogueView(catalogue) : null);
}

// ------------------------------------------------------------------ webhooks

/**
 * Verify, deduplicate, act, acknowledge.
 *
 * The order matters. The signature comes first and a bad one is a 401 — the
 * App Store's compliance check sends exactly that and requires exactly that.
 * A delivery that fails partway is settled as failed and answered with a 500,
 * so Shopify retries it and the ledger lets the retry through.
 */
export async function handleWebhook(request: Request, deps: Deps): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());
  const signed = verifyWebhookSignature({
    body,
    signature: request.headers.get("x-shopify-hmac-sha256"),
    secret: deps.config.secrets,
  });
  if (!signed) return new Response("invalid signature", { status: 401 });

  const parsed = readDelivery(request.headers);
  if (!parsed.ok) return new Response(`not a delivery: ${parsed.reason}`, { status: 400 });
  const { delivery } = parsed;

  const topic = subscribedTopic(delivery);
  if (!topic) return new Response(null, { status: 200 });

  const claim = await deps.store.deliveries.claim(delivery.webhookId, deps.now(), delivery.shopDomain);
  if (!claim.claimed) return new Response(null, { status: 200 });

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    await deps.store.deliveries.settle(delivery.webhookId, "failed", deps.now());
    return new Response("body is not JSON", { status: 400 });
  }

  try {
    await perform(webhookAction(topic, payload), delivery.shopDomain, deps);
  } catch {
    await deps.store.deliveries.settle(delivery.webhookId, "failed", deps.now());
    return new Response("could not process", { status: 500 });
  }
  await deps.store.deliveries.settle(delivery.webhookId, "done", deps.now());
  return new Response(null, { status: 200 });
}

async function perform(action: WebhookAction, shop: string, deps: Deps): Promise<void> {
  switch (action.kind) {
    case "rescan-product":
      return rescanProduct(shop, action.gid, action.updatedAt, deps);
    case "forget-product":
      return deps.store.removeProduct(shop, action.gid);
    case "uninstall": {
      const installation = await deps.store.getInstallation(shop);
      if (installation) {
        await deps.store.putInstallation({ ...installation, state: "uninstalled", updatedAt: deps.now().toISOString() });
      }
      return;
    }
    case "redact-shop":
      return deps.store.redactShop(shop);
    case "refresh-scopes":
    case "acknowledge":
    case "unreadable":
      return;
  }
}

/**
 * One product changed: read it, rescan it, swap it in.
 *
 * If the read fails, the product's badge is withdrawn before the error goes
 * back to Shopify for a retry. The old score stays for reference, marked stale;
 * the mark does not, because it would be sitting on words nobody has read.
 */
async function rescanProduct(shop: string, gid: string, updatedAt: string | null, deps: Deps): Promise<void> {
  const installation = await deps.store.getInstallation(shop);
  const catalogue = await deps.store.getCatalogue(shop);
  // No scan yet: the merchant's first scan will read this product anyway.
  if (!installation || installation.state !== "active" || !catalogue) return;

  const held = catalogue.products.find((p) => p.product.gid === gid);
  if (held && !shouldApplyProduct({ handle: held.product.handle, updatedAt }, { handle: held.product.handle, updatedAt: held.product.updatedAt }).apply) {
    return;
  }
  if (!held) {
    // A product the scan has not seen. Only add it within the plan's allowance.
    const plan = installation.lastKnownPlan ? PLANS[installation.lastKnownPlan] : null;
    if (!plan || catalogue.products.length >= plan.maxProducts) return;
  }

  try {
    const token = await accessTokenFor(installation, deps);
    if (!token) throw new Error("no usable access token");
    const copy = await readProductCopy(adminFor(shop, token, deps), gid);
    if (copy) {
      // Refused only when a newer copy of this product landed meanwhile,
      // which is the right outcome: the newer scan stands.
      await deps.store.putProduct(shop, scanProduct(copy, catalogue.jurisdictions));
    } else {
      await deps.store.removeProduct(shop, gid);
    }
  } catch (error) {
    if (held) await deps.store.markStale(shop, gid);
    throw error;
  }
}

// ------------------------------------------------------------------ cron

/**
 * Daily: drop delivery records too old to recur. Shopify retries a failed
 * delivery for about four hours and can deliver up to a day late; seven days
 * is a cheap margin (shopfront/SHOPIFY-APP.md §3.2 has the citations).
 *
 * Vercel calls crons with `Authorization: Bearer $CRON_SECRET`. With no secret
 * configured the route refuses everyone rather than serving anyone.
 */
export const DELIVERY_RETENTION_MS = 7 * 24 * 60 * 60_000;

export async function handleCronPrune(request: Request, deps: Deps): Promise<Response> {
  const secret = deps.config.cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorised", { status: 401 });
  }
  const pruned = await deps.store.pruneDeliveries(new Date(deps.now().getTime() - DELIVERY_RETENTION_MS));
  return Response.json({ pruned });
}

// ------------------------------------------------------------------ helpers

async function planAccess(session: Session, deps: Deps): Promise<Access> {
  const installation = session.installation;
  const lookup = await lookupPlan(session.admin, installation.lastKnownPlan, deps);

  // Remember what the Partner API confirmed, including that there is no plan:
  // the fallback for a failed lookup must be the last *answer*, not a guess.
  const confirmed =
    lookup.kind === "active" && isPlanHandle(lookup.handle) ? lookup.handle : lookup.kind === "none" ? null : undefined;
  if (confirmed !== undefined && confirmed !== installation.lastKnownPlan) {
    const current = await currentInstallation(session, deps);
    await deps.store.putInstallation({ ...current, lastKnownPlan: confirmed, updatedAt: deps.now().toISOString() });
  }
  return accessFor(lookup);
}

function requireGranted(access: Access, session: Session, deps: Deps): Response | null {
  if (access.kind === "granted") return null;
  if (access.kind === "choose-plan") {
    return Response.json(
      { error: "choose-plan", planUrl: planSelectionUrl(session.shop, deps.config.appHandle) },
      { status: 402 },
    );
  }
  return Response.json({ error: "plan-unknown" }, { status: 503 });
}

async function currentInstallation(session: Session, deps: Deps): Promise<Installation> {
  return (await deps.store.getInstallation(session.shop)) ?? session.installation;
}

function planView(entitlements: Entitlements) {
  return {
    handle: entitlements.handle,
    name: entitlements.name,
    // JSON has no Infinity; null reads as "no limit" on the page.
    maxProducts: Number.isFinite(entitlements.maxProducts) ? entitlements.maxProducts : null,
    maxMarkets: Number.isFinite(entitlements.maxMarkets) ? entitlements.maxMarkets : null,
  };
}

function describe(error: unknown): string {
  if (error instanceof AdminApiError) return `${error.kind}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
