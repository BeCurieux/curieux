/**
 * The app's HTTP surface, as plain functions from a `Request` to a `Response`.
 * The files under `src/app/api` are one line each; everything with a decision
 * in it is here, where the tests reach it with a fake Shopify.
 *
 *   POST /api/shopify/session   verify, install or refresh; the catalogue so far
 *   POST /api/shopify/sync      read the whole catalogue and store it
 *   POST /api/shopify/webhooks  everything Shopify sends
 */

import { summarise, toProductRow } from "../catalogue/sync.js";
import { AdminApiError } from "../shopify/admin/client.js";
import { idFromNumeric, productFromWebhook, readCatalogue } from "../shopify/admin/products.js";
import { verifyWebhookSignature } from "../shopify/hmac.js";
import { readDelivery, subscribedTopic, type SubscribedTopic } from "../shopify/webhook.js";
import { authenticate, type Deps } from "./session.js";

/** On every surface that shows a result (BUILD_BRIEF.md §2.4). */
export const DISCLAIMER =
  "MarketFit points out what a label or listing appears to be missing against the rules it holds, with the source for each. It is not legal advice and does not certify a product for any market.";

// ------------------------------------------------------------------ session

export async function handleSession(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const { merchant } = auth.session;
  return Response.json({
    shop: merchant.shop,
    installedAt: merchant.installedAt,
    catalogue: summarise(await deps.store.listProducts(merchant.id)),
    disclaimer: DISCLAIMER,
  });
}

// ------------------------------------------------------------------ sync

export async function handleSync(request: Request, deps: Deps): Promise<Response> {
  const auth = await authenticate(request, deps);
  if (!auth.ok) return auth.response;
  const { merchant, admin } = auth.session;

  let read;
  try {
    read = await readCatalogue(admin);
  } catch (error) {
    return Response.json({ error: "shopify-unavailable", detail: describe(error) }, { status: 502 });
  }
  // Only a complete read may remove products: a truncated one cannot prove a
  // product is gone.
  const result = await deps.store.putProducts(merchant.id, read.products.map(toProductRow), !read.truncated);
  return Response.json({
    ...result,
    truncated: read.truncated,
    catalogue: summarise(await deps.store.listProducts(merchant.id)),
  });
}

// ------------------------------------------------------------------ webhooks

/**
 * Signature first (401 if bad — the App Store review checks this), then the
 * envelope (400), then a claim on the delivery id so a retry is a no-op, then
 * the work. A failure answers 500 so Shopify retries.
 */
export async function handleWebhook(request: Request, deps: Deps): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get("x-shopify-hmac-sha256") ?? request.headers.get("shopify-hmac-sha256");
  if (!verifyWebhookSignature({ body, signature, secret: deps.config.secrets })) {
    return new Response("unauthorised", { status: 401 });
  }

  const parsed = readDelivery(request.headers);
  if (!parsed.ok) return new Response(parsed.reason, { status: 400 });
  const { delivery } = parsed;
  const topic = subscribedTopic(delivery);
  if (!topic) return new Response(null, { status: 200 });

  const now = deps.now();
  const claim = await deps.store.deliveries.claim(delivery.webhookId, now, delivery.shopDomain);
  if (!claim.claimed) return new Response(null, { status: 200 });

  let payload: unknown = null;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    // A signed body that is not JSON: nothing to act on, and retrying will not help.
    await deps.store.deliveries.settle(delivery.webhookId, "done", now);
    return new Response(null, { status: 200 });
  }

  try {
    await act(topic, delivery.shopDomain, payload, deps);
    await deps.store.deliveries.settle(delivery.webhookId, "done", deps.now());
    return new Response(null, { status: 200 });
  } catch (error) {
    await deps.store.deliveries.settle(delivery.webhookId, "failed", deps.now()).catch(() => undefined);
    console.error(`webhook ${topic} for ${delivery.shopDomain} failed: ${describe(error)}`);
    return new Response("failed", { status: 500 });
  }
}

async function act(topic: SubscribedTopic, shop: string, payload: unknown, deps: Deps): Promise<void> {
  switch (topic) {
    case "products/create":
    case "products/update": {
      const merchant = await deps.store.getMerchant(shop);
      const product = productFromWebhook(payload);
      if (!merchant || merchant.state === "uninstalled" || !product) return;
      await deps.store.putProducts(merchant.id, [toProductRow(product)], false);
      return;
    }
    case "products/delete": {
      const merchant = await deps.store.getMerchant(shop);
      const id = idFromNumeric((payload as Record<string, unknown> | null)?.["id"]);
      if (merchant && id) await deps.store.removeProduct(merchant.id, id);
      return;
    }
    case "app/uninstalled": {
      const merchant = await deps.store.getMerchant(shop);
      // The token is dead the moment the app is uninstalled; drop it. The
      // catalogue stays until shop/redact, which Shopify sends 48 hours later.
      if (merchant) {
        await deps.store.putMerchant({ ...merchant, token: null, state: "uninstalled", uninstalledAt: deps.now().toISOString() });
      }
      return;
    }
    case "shop/redact":
      await deps.store.redactShop(shop);
      return;
    case "app/scopes_update":
    case "customers/data_request":
    case "customers/redact":
      // MarketFit reads products only and holds no customer data, so there is
      // nothing to return or erase. Acknowledged, as the App Store requires.
      return;
  }
}

function describe(error: unknown): string {
  if (error instanceof AdminApiError) return `${error.kind}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
