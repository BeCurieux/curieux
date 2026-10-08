/**
 * Request handlers, with every dependency passed in. The route files are one
 * line each; the logic lives here where the tests can reach it.
 */

import { z } from "zod";
import { importProduct, ImportFailed, type Transport } from "../product/fetch.js";
import { assertPublicUrl, BlockedAddress, type Lookup } from "../product/guard.js";
import { proxiedImage, verifyImage } from "../product/sign.js";
import { BadLink } from "../product/url.js";
import { MAX_DESCRIPTION_CHARS, MAX_IMAGES, type Product } from "../product/types.js";
import type { Drafter } from "../script/claude.js";
import { factsFrom } from "../script/facts.js";
import { writeAds } from "../script/write.js";
import type { Credits } from "../billing/credits.js";
import { FREE_CREDITS, PACKS, packById, priceLabel } from "../billing/packs.js";
import type { Checkout, VerifyWebhook } from "../billing/stripe.js";
import { applyStripeEvent } from "../billing/webhook.js";
import { clientKey, type Limiter } from "./limit.js";
import type { Viewer } from "./supabase.js";

export type Deps = {
  production: boolean;
  transport: Transport;
  lookup: Lookup;
  imageSecret: string;
  etsyKey?: string;
  drafter?: Drafter;
  /** Who is signed in. Always null when accounts are off. */
  viewer: (req: Request) => Promise<Viewer | null>;
  /** Present when accounts are on (Supabase configured). */
  credits?: Credits;
  /** Present when payments are on (Stripe configured, and accounts on). */
  checkout?: Checkout;
  verifyWebhook?: VerifyWebhook;
  appUrl?: string;
  importLimit: Limiter;
  writeLimit: Limiter;
  log?: (event: string, data: Record<string, unknown>) => void;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ import

const ImportBody = z.object({ url: z.string().min(1).max(2000) });

export async function handleImport(req: Request, deps: Deps): Promise<Response> {
  if (!deps.importLimit(clientKey(req))) {
    return json({ error: "That's a lot of imports in a short time. Try again in a few minutes." }, 429);
  }
  const parsed = ImportBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Send a product link." }, 400);

  try {
    const product = await importProduct(parsed.data.url, {
      transport: deps.transport,
      lookup: deps.lookup,
      ...(deps.etsyKey ? { etsyKey: deps.etsyKey } : {}),
    });
    return json({
      product,
      // What the browser loads: the same photos, through our origin, so the
      // canvas can read them back to encode the video.
      views: product.images.map((u) => proxiedImage(u, deps.imageSecret)),
    });
  } catch (e) {
    if (e instanceof BadLink) return json({ error: e.message, manual: false }, 400);
    if (e instanceof ImportFailed) return json({ error: e.message, manual: e.manual }, 422);
    if (e instanceof BlockedAddress) return json({ error: "That link can't be imported.", manual: true }, 400);
    deps.log?.("import.error", { message: e instanceof Error ? e.message : String(e) });
    return json({ error: "Something went wrong reading that page. Add the details yourself below.", manual: true }, 502);
  }
}

// ------------------------------------------------------------------ write

export const ProductBody = z.object({
  source: z.enum(["shopify", "etsy", "page", "manual"]),
  title: z.string().trim().min(1).max(140),
  description: z.string().max(MAX_DESCRIPTION_CHARS),
  price: z
    .object({
      amount: z.string().regex(/^\d{1,9}(?:[.,]\d{1,3})?$/),
      currency: z.string().regex(/^[A-Z]{3}$/),
    })
    .optional(),
  shop: z.string().trim().max(80).optional(),
  imageCount: z.number().int().min(1).max(MAX_IMAGES),
});

/**
 * May this deployment call the model at all? Locally, always (if there is a
 * key). In production, only with accounts in front of it: otherwise anyone
 * could spend the Anthropic budget, and templates are the safe answer.
 */
export function aiAvailable(deps: Deps): boolean {
  return Boolean(deps.drafter) && (Boolean(deps.credits) || !deps.production);
}

export async function handleWrite(req: Request, deps: Deps): Promise<Response> {
  const parsed = ProductBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "The product details are incomplete." }, 400);

  const p = parsed.data;
  const product: Product = {
    source: p.source,
    title: p.title,
    description: p.description,
    ...(p.price ? { price: p.price } : {}),
    ...(p.shop ? { shop: p.shop } : {}),
    images: Array.from({ length: p.imageCount }, () => ""),
  };
  const facts = factsFrom(product);

  // No model: templates, free, no account needed.
  if (!aiAvailable(deps)) {
    const report = await writeAds(facts);
    return json({ ads: report.ads, ai: false });
  }

  // Model, no accounts (local development): free, rate limited per address.
  if (!deps.credits) {
    const drafter = deps.writeLimit(clientKey(req)) ? deps.drafter : undefined;
    const report = await writeAds(facts, drafter);
    logFallback(deps, report);
    return json({ ads: report.ads, ai: true });
  }

  // Model, with accounts: one credit per set of three, taken before the call
  // so two tabs cannot both spend the last one, and given back if the model
  // produced nothing usable.
  const who = await deps.viewer(req);
  if (!who) return json({ error: "Sign in to write your ads.", signIn: true }, 401);
  if (!deps.writeLimit(`user:${who.id}`)) {
    return json({ error: "That's a lot of ads in an hour. Try again a little later." }, 429);
  }

  const ref = crypto.randomUUID();
  const left = await deps.credits.spend(who.id, ref);
  if (left === null) {
    return json(
      { error: "You're out of credits.", buy: Boolean(deps.checkout), credits: 0 },
      402,
    );
  }

  let credits = left;
  try {
    const report = await writeAds(facts, deps.drafter);
    logFallback(deps, report);
    if (!report.ads.some((a) => a.by === "claude")) {
      credits = (await deps.credits.refund(who.id, ref)) ?? credits;
      return json({ ads: report.ads, ai: true, refunded: true, credits });
    }
    return json({ ads: report.ads, ai: true, credits });
  } catch (e) {
    await deps.credits.refund(who.id, ref);
    throw e;
  }
}

function logFallback(deps: Deps, report: Awaited<ReturnType<typeof writeAds>>) {
  if (report.rejected.length || report.drafterError) {
    deps.log?.("write.fallback", { rejected: report.rejected, error: report.drafterError });
  }
}

// ------------------------------------------------------------------ me

export async function handleMe(req: Request, deps: Deps): Promise<Response> {
  const who = deps.credits ? await deps.viewer(req) : null;
  return json({
    accounts: Boolean(deps.credits),
    payments: Boolean(deps.checkout),
    ai: aiAvailable(deps),
    freeCredits: FREE_CREDITS,
    packs: PACKS.map((p) => ({ id: p.id, name: p.name, credits: p.credits, price: priceLabel(p) })),
    viewer: who ? { email: who.email ?? null } : null,
    ...(who && deps.credits ? { credits: await deps.credits.balance(who.id) } : {}),
  });
}

// ------------------------------------------------------------------ billing

const CheckoutBody = z.object({ pack: z.string() });

export async function handleCheckout(req: Request, deps: Deps): Promise<Response> {
  if (!deps.checkout || !deps.credits) return json({ error: "Buying credits isn't switched on yet." }, 503);
  const who = await deps.viewer(req);
  if (!who) return json({ error: "Sign in to buy credits.", signIn: true }, 401);
  const parsed = CheckoutBody.safeParse(await body(req));
  const pack = parsed.success ? packById(parsed.data.pack) : undefined;
  if (!pack) return json({ error: "That pack doesn't exist." }, 400);

  const origin = deps.appUrl ?? new URL(req.url).origin;
  try {
    const url = await deps.checkout({ pack, user: who, origin });
    return json({ url });
  } catch (e) {
    deps.log?.("checkout.error", { message: e instanceof Error ? e.message : String(e) });
    return json({ error: "Checkout couldn't start. Please try again." }, 502);
  }
}

/**
 * Stripe's word that a payment happened. The signature is checked over the
 * raw body before anything is read from it. A database failure answers 500
 * so Stripe sends the event again; everything else answers 200, because a
 * retry of an event we chose to ignore would only be ignored again.
 */
export async function handleWebhook(req: Request, deps: Deps): Promise<Response> {
  if (!deps.verifyWebhook || !deps.credits) return new Response("Payments are off", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();

  let event;
  try {
    event = deps.verifyWebhook(raw, signature);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  let outcome;
  try {
    outcome = await applyStripeEvent(event, deps.credits);
  } catch (e) {
    deps.log?.("webhook.error", { event: event.id, message: e instanceof Error ? e.message : String(e) });
    return new Response("Try again", { status: 500 });
  }
  if (outcome === "mismatch") deps.log?.("webhook.mismatch", { event: event.id, type: event.type });
  return json({ received: true, outcome });
}

// ------------------------------------------------------------------ image

const MAX_IMAGE_BYTES = 12_000_000;
const MAX_IMAGE_REDIRECTS = 3;
/** SVG is refused: served from our origin it is a document that can run
 *  script, and a product photo is never one. */
const RASTER = /^image\/(jpeg|png|webp|gif|avif)\b/i;

export async function handleImage(req: Request, deps: Deps): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const target = q.get("u") ?? "";
  const sig = q.get("s") ?? "";
  if (!target || !verifyImage(target, sig, deps.imageSecret)) {
    return new Response("Not found", { status: 404 });
  }

  let current = target;
  try {
    for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
      await assertPublicUrl(current, deps.lookup);
      const res = await deps.transport(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (res.status !== 200 || !RASTER.test(type)) return new Response("Not an image", { status: 502 });
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > MAX_IMAGE_BYTES) return new Response("Image too large", { status: 413 });
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMAGE_BYTES) return new Response("Image too large", { status: 413 });
      return new Response(buf, {
        headers: {
          "content-type": type,
          "cache-control": "public, max-age=86400, immutable",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'",
        },
      });
    }
  } catch (e) {
    if (!(e instanceof BlockedAddress)) {
      deps.log?.("image.error", { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response("Image unavailable", { status: 502 });
  }
  return new Response("Too many redirects", { status: 502 });
}
