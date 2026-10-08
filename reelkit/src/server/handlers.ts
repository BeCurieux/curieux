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
import { clientKey, type Limiter } from "./limit.js";

export type Deps = {
  transport: Transport;
  lookup: Lookup;
  imageSecret: string;
  etsyKey?: string;
  drafter?: Drafter;
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

export async function handleWrite(req: Request, deps: Deps): Promise<Response> {
  const parsed = ProductBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "The product details are incomplete." }, 400);

  // Templates are free; only a model call spends the budget.
  const drafter = deps.drafter && deps.writeLimit(clientKey(req)) ? deps.drafter : undefined;

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
  const report = await writeAds(facts, drafter);
  if (report.rejected.length || report.drafterError) {
    deps.log?.("write.fallback", { rejected: report.rejected, error: report.drafterError });
  }
  return json({ ads: report.ads, facts: { name: facts.name, price: facts.price, shop: facts.shop } });
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
