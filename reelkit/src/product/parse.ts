/**
 * Turning what a store sends back into a `Product`. Pure: strings in,
 * products out, no network. `fetch.ts` decides what to ask for.
 */

import { clip, decodeEntities, htmlToText, tidy } from "./text.js";
import {
  MAX_DESCRIPTION_CHARS,
  MAX_IMAGES,
  type Price,
  type Product,
  type ProductSource,
} from "./types.js";

export type Partial = {
  title?: string;
  description?: string;
  price?: Price;
  shop?: string;
  images: string[];
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined;

/** Absolute https image URLs, de-duplicated, in order. */
export function cleanImages(urls: unknown[], base?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const s = str(raw);
    if (!s) continue;
    let u: URL;
    try {
      u = new URL(s.startsWith("//") ? `https:${s}` : s, base);
    } catch {
      continue;
    }
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:") continue;
    // Shopify serves one image under many size suffixes; the bare URL is the
    // original and the one to keep.
    const key = u.toString().replace(/_(\d+x\d*|\d*x\d+|small|medium|large|grande)(?=\.)/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u.toString());
  }
  return out.slice(0, MAX_IMAGES);
}

export function finish(source: ProductSource, url: string | undefined, p: Partial): Product | null {
  const title = p.title ? tidy(decodeEntities(p.title)) : "";
  if (!title) return null;
  return {
    source,
    ...(url ? { url } : {}),
    title: clip(title, 140),
    description: clip(p.description ?? "", MAX_DESCRIPTION_CHARS),
    ...(p.price ? { price: p.price } : {}),
    ...(p.shop ? { shop: tidy(decodeEntities(p.shop)) } : {}),
    images: p.images,
  };
}

// ---------------------------------------------------------------- Shopify

/** What Shopify's .json gives: everything but a currency for its price. */
export type ShopifyPartial = Partial & { amount?: string };

/** `/products/<handle>.json`, the public product endpoint every store has. */
export function fromShopifyJson(body: unknown, pageUrl: string): ShopifyPartial | null {
  const product = (body as { product?: Record<string, unknown> } | null)?.product;
  if (!product || typeof product !== "object") return null;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const available = variants.filter(
    (v: { available?: unknown }) => v && (v as { available?: unknown }).available !== false,
  );
  const first = (available[0] ?? variants[0]) as { price?: unknown } | undefined;
  const images = Array.isArray(product.images)
    ? product.images.map((i: { src?: unknown }) => i?.src)
    : [];

  return {
    title: str(product.title),
    description: htmlToText(str(product.body_html) ?? ""),
    shop: str(product.vendor),
    images: cleanImages(images, pageUrl),
    // The .json endpoint carries no currency. `mergeShopify` takes it from the
    // page itself, and without one the price is left off.
    amount: str(first?.price),
  };
}

// ---------------------------------------------------------------- JSON-LD

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    yield o;
    if (o["@graph"]) yield* walk(o["@graph"]);
  }
}

const isProduct = (o: Record<string, unknown>) => {
  const t = o["@type"];
  return t === "Product" || (Array.isArray(t) && t.includes("Product")) || t === "ProductGroup";
};

function ldImages(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.flatMap(ldImages);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return [o.contentUrl ?? o.url];
  }
  return [v];
}

function ldPrice(offers: unknown): Price | undefined {
  for (const o of walk(offers)) {
    const amount = str(o.price) ?? str(o.lowPrice);
    const spec = o.priceSpecification as Record<string, unknown> | undefined;
    const currency = str(o.priceCurrency) ?? str(spec?.priceCurrency);
    const specAmount = str(spec?.price);
    if ((amount ?? specAmount) && currency) {
      return { amount: (amount ?? specAmount)!, currency: currency.toUpperCase() };
    }
  }
  return undefined;
}

export function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = (m[1] ?? "").trim();
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Stores hand-edit their theme's JSON-LD and break it often enough
      // that a bad block is skipped rather than fatal.
    }
  }
  return out;
}

export function fromJsonLd(html: string, pageUrl: string): Partial | null {
  for (const block of jsonLdBlocks(html)) {
    for (const o of walk(block)) {
      if (!isProduct(o)) continue;
      const brand = o.brand as Record<string, unknown> | string | undefined;
      const seller = (o.offers as Record<string, unknown> | undefined)?.seller as
        | Record<string, unknown>
        | undefined;
      const variants = Array.isArray(o.hasVariant) ? o.hasVariant : [];
      return {
        title: str(o.name),
        description: htmlToText(str(o.description) ?? ""),
        price: ldPrice(o.offers) ?? ldPrice(variants.map((v: Record<string, unknown>) => v?.offers)),
        shop: typeof brand === "string" ? brand : str(brand?.name) ?? str(seller?.name),
        images: cleanImages(ldImages(o.image), pageUrl),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------- meta tags

export function metaTags(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    const value = content?.[1] ?? content?.[2];
    if (!key || value === undefined) continue;
    const list = out.get(key) ?? [];
    list.push(decodeEntities(value));
    out.set(key, list);
  }
  return out;
}

export function fromMeta(html: string, pageUrl: string): Partial | null {
  const meta = metaTags(html);
  const one = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k)?.[0]?.trim();
      if (v) return v;
    }
    return undefined;
  };
  const title = one("og:title", "twitter:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const amount = one("product:price:amount", "og:price:amount");
  const currency = one("product:price:currency", "og:price:currency");
  return {
    ...(title ? { title } : {}),
    description: tidy(one("og:description", "description", "twitter:description") ?? ""),
    price: amount && currency ? { amount, currency: currency.toUpperCase() } : undefined,
    shop: one("og:site_name"),
    images: cleanImages([...(meta.get("og:image") ?? []), ...(meta.get("og:image:secure_url") ?? [])], pageUrl),
  };
}

/** Structured data first, meta tags to fill whatever it left out. */
export function fromHtml(html: string, pageUrl: string): Partial | null {
  const ld = fromJsonLd(html, pageUrl);
  const meta = fromMeta(html, pageUrl);
  if (!ld) return meta;
  if (!meta) return ld;
  return {
    title: ld.title ?? meta.title,
    // A JSON-LD description is often a truncated teaser; the longer of the
    // two is almost always the real one.
    description:
      (ld.description?.length ?? 0) >= (meta.description?.length ?? 0) ? ld.description : meta.description,
    price: ld.price ?? meta.price,
    shop: ld.shop ?? meta.shop,
    images: ld.images.length ? ld.images : meta.images,
  };
}

/** Shopify's .json gives the product; the page gives the currency. */
export function mergeShopify(
  json: ShopifyPartial | null,
  page: Partial | null,
): Partial | null {
  if (!json) return page;
  const currency = page?.price?.currency;
  const amount = json.amount;
  return {
    title: json.title ?? page?.title,
    description: json.description || page?.description,
    shop: json.shop ?? page?.shop,
    images: json.images.length ? json.images : (page?.images ?? []),
    price: amount && currency ? { amount, currency } : page?.price,
  };
}

// ---------------------------------------------------------------- Etsy API

/** Etsy Open API v3 `getListing` plus `getListingImages`. */
export function fromEtsyApi(listing: unknown, images: unknown): Partial | null {
  const l = listing as Record<string, unknown> | null;
  if (!l || typeof l !== "object") return null;
  const price = l.price as { amount?: unknown; divisor?: unknown; currency_code?: unknown } | undefined;
  let p: Price | undefined;
  if (typeof price?.amount === "number" && typeof price.divisor === "number" && price.divisor > 0) {
    const decimals = Math.round(Math.log10(price.divisor));
    const currency = str(price.currency_code);
    if (currency) p = { amount: (price.amount / price.divisor).toFixed(decimals), currency };
  }
  const results = (images as { results?: unknown[] } | null)?.results ?? [];
  const ordered = [...results].sort(
    (a, b) =>
      ((a as { rank?: number }).rank ?? 0) - ((b as { rank?: number }).rank ?? 0),
  );
  return {
    title: str(l.title),
    description: tidy(decodeEntities(str(l.description) ?? "")),
    price: p,
    shop: undefined,
    images: cleanImages(
      ordered.map((i) => {
        const o = i as Record<string, unknown>;
        return o.url_fullxfull ?? o.url_570xN;
      }),
    ),
  };
}
