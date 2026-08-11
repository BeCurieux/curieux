/**
 * Shopify product payloads -> the catalogue in `types.ts`.
 *
 * Two public surfaces carry the same products in two different shapes, and we
 * read both because they fail in different circumstances:
 *
 *   /products.json          list endpoint. `price: "24.00"`, `body_html`,
 *                           `product_type`, images as objects with dimensions.
 *   /products/<handle>.js   single product. `price: 2400` (minor units),
 *                           `description`, `type`, images as bare URLs.
 *
 * Mixing those up is the classic hundredfold pricing bug — a $24 product
 * listed at $2,400 — so the unit is decided by the *type* of the field, not by
 * which endpoint we thought we called.
 */

import { htmlToText } from "./html";
import type { IngestedImage, IngestedProduct, IngestedVariant } from "./types";
import { absoluteUrl } from "./url";

type Json = Record<string, unknown>;

export interface NormaliseOptions {
  storeUrl: URL;
  /** Cap on description length handed to the merchandiser. */
  maxDescription?: number;
}

/** `{ products: [...] }` from /products.json. Unreadable entries are skipped. */
export function parseProductList(payload: unknown, options: NormaliseOptions): IngestedProduct[] {
  const products = isRecord(payload) ? payload["products"] : payload;
  if (!Array.isArray(products)) return [];
  const out: IngestedProduct[] = [];
  for (const raw of products) {
    const product = normaliseProduct(raw, options);
    if (product) out.push(product);
  }
  return out;
}

/** A single product, from /products/<handle>.js or a `{product: {...}}` wrapper. */
export function parseSingleProduct(payload: unknown, options: NormaliseOptions): IngestedProduct | null {
  if (!isRecord(payload)) return null;
  const node = isRecord(payload["product"]) ? payload["product"] : payload;
  return normaliseProduct(node, options);
}

export function normaliseProduct(raw: unknown, options: NormaliseOptions): IngestedProduct | null {
  if (!isRecord(raw)) return null;

  const handle = asString(raw["handle"]);
  const title = asString(raw["title"]);
  if (!handle || !title) return null;

  const variants = normaliseVariants(raw["variants"], options.storeUrl);
  // A product with no readable variant has no price and no buy path. Keeping
  // it would put a card on the page that cannot be bought or priced, which is
  // exactly the kind of plausible-looking wrongness the brief forbids.
  if (variants.length === 0) return null;

  const images = normaliseImages(raw["images"], options.storeUrl, raw["featured_image"]);
  const prices = variants.map((v) => v.price);
  const availabilityKnown = hasKnownAvailability(raw["variants"]);

  const descriptionSource = asString(raw["body_html"]) ?? asString(raw["description"]) ?? "";

  return {
    handle,
    ...(raw["id"] !== undefined && raw["id"] !== null ? { id: String(raw["id"]) } : {}),
    title: title.trim(),
    description: htmlToText(descriptionSource, options.maxDescription ?? 1200),
    ...(asString(raw["vendor"]) ? { vendor: asString(raw["vendor"])! } : {}),
    ...(asString(raw["product_type"]) ?? asString(raw["type"])
      ? { productType: (asString(raw["product_type"]) ?? asString(raw["type"]))! }
      : {}),
    tags: normaliseTags(raw["tags"]),
    url: new URL(`/products/${encodeURIComponent(handle)}`, options.storeUrl).toString(),
    images,
    variants,
    price: { min: Math.min(...prices), max: Math.max(...prices) },
    available: variants.some((v) => v.available),
    availabilityKnown,
    ...(asString(raw["published_at"]) ? { publishedAt: asString(raw["published_at"])! } : {}),
    ...(asString(raw["created_at"]) ? { createdAt: asString(raw["created_at"])! } : {}),
  };
}

function normaliseVariants(raw: unknown, storeUrl: URL): IngestedVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: IngestedVariant[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const price = parseMoney(entry["price"]);
    if (price === null) continue;
    const id = entry["id"];
    if (id === undefined || id === null) continue;

    const compareAt = parseMoney(entry["compare_at_price"]);
    const featured = entry["featured_image"];
    const imageUrl = absoluteUrl(
      typeof featured === "string" ? featured : isRecord(featured) ? asString(featured["src"]) : undefined,
      storeUrl,
    );

    out.push({
      id: String(id),
      title: asString(entry["title"]) ?? "Default",
      ...(asString(entry["sku"]) ? { sku: asString(entry["sku"])! } : {}),
      price,
      // A compare-at at or below the price is Shopify's leftover from an
      // ended sale, not a discount. Surfacing it would print a struck-through
      // number that never was.
      ...(compareAt !== null && compareAt > price ? { compareAtPrice: compareAt } : {}),
      available: entry["available"] === undefined ? true : entry["available"] === true,
      options: normaliseVariantOptions(entry),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }
  return out;
}

function normaliseVariantOptions(entry: Json): string[] {
  const options = entry["options"];
  if (Array.isArray(options)) return options.map((o) => String(o)).filter(Boolean);
  return [entry["option1"], entry["option2"], entry["option3"]]
    .filter((o): o is string => typeof o === "string" && o.length > 0);
}

/**
 * `/products.json` always emits `available`; a rendered or JSON-LD-derived
 * product may not. Distinguishing "sold out" from "we never found out" is the
 * whole point of `availabilityKnown` on the product.
 */
function hasKnownAvailability(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.some((entry) => isRecord(entry) && typeof entry["available"] === "boolean");
}

function normaliseImages(raw: unknown, storeUrl: URL, featured: unknown): IngestedImage[] {
  const out: IngestedImage[] = [];
  const seen = new Set<string>();

  const push = (image: IngestedImage | null) => {
    if (!image || seen.has(image.url)) return;
    seen.add(image.url);
    out.push(image);
  };

  const toImage = (entry: unknown): IngestedImage | null => {
    // The .js endpoint gives bare, protocol-relative URLs; the list endpoint
    // gives objects with width and height the renderer wants for aspect ratio.
    if (typeof entry === "string") {
      const url = absoluteUrl(entry, storeUrl);
      return url ? { url } : null;
    }
    if (!isRecord(entry)) return null;
    const url = absoluteUrl(asString(entry["src"]) ?? asString(entry["url"]), storeUrl);
    if (!url) return null;
    const width = asPositiveInt(entry["width"]);
    const height = asPositiveInt(entry["height"]);
    const alt = asString(entry["alt"]);
    return {
      url,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(alt ? { alt } : {}),
    };
  };

  // Featured first when it is declared: `leadImageIndex` in a ShopConfig means
  // an index into this array, so the order here is a product decision.
  push(toImage(featured));
  if (Array.isArray(raw)) {
    const sorted = raw.every((e) => isRecord(e) && typeof e["position"] === "number")
      ? [...raw].sort((a, b) => Number((a as Json)["position"]) - Number((b as Json)["position"]))
      : raw;
    for (const entry of sorted) push(toImage(entry));
  }

  return out;
}

function normaliseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  // Some surfaces hand back the comma-joined string the admin UI shows.
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

/**
 * Money, in the shop's currency, as a decimal.
 *
 * A string is already decimal ("24.00"). A number is minor units (2400), the
 * convention of every Shopify JS-facing endpoint. There is no third case, and
 * guessing between them by magnitude would be wrong for any product over $100.
 */
export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return round2(value / 100);
  }
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return round2(parsed);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asPositiveInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
