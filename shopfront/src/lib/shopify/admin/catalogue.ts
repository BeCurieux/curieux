/**
 * An Admin API `products` page -> the ingester's `Catalogue`.
 *
 * This file is the whole reuse argument in the design, made concrete: if an
 * Admin response can be mapped into `IngestResult`'s catalogue type, then the
 * Genome, the merchandiser, the renderer, `resolve.ts`, `lib/smart` and the
 * funnel all work on an app-backed store with no changes at all, and a shop can
 * move from the public path to the app without being regenerated.
 *
 * It deliberately reuses the ingester's own primitives — `parseMoney` for money
 * and `htmlToText` for descriptions — rather than reimplementing them. Two
 * copies of the money rule would drift, and the failure mode of drift on that
 * particular rule is a hundredfold pricing bug.
 *
 * ## Two things worth knowing before changing anything here
 *
 * **`legacyResourceId`, not `id`.** Verified by live schema introspection:
 * `ProductVariant.id` is a `gid://shopify/ProductVariant/…` and
 * `ProductVariant.legacyResourceId` is the numeric id. `IngestedVariant.id` is
 * documented as the stringified numeric id, and `lib/cart/permalink.ts` builds
 * `/cart/<variantId>:1` from it and refuses to build one from a non-numeric id.
 * So a mapper that used the gid would not crash — it would silently send every
 * app-backed shop to product pages instead of pre-filled carts, and the
 * existing guard would report that as correct. There is a test for this.
 *
 * **The fixtures are hand-built, so this is the least-proven file in the app.**
 * The field *names* below are verified against live introspection; the response
 * *shape* is written from the schema rather than recorded from a real call,
 * because this environment cannot make one. Stage 1 of the plan exists to
 * replace the fixtures with a recording, and it is first among the live stages
 * for exactly this reason. See SHOPIFY-APP.md §10.
 */

import { htmlToText } from "@/lib/ingest/html";
import { parseMoney } from "@/lib/ingest/products";
import type {
  Catalogue,
  IngestedImage,
  IngestedProduct,
  IngestedVariant,
} from "@/lib/ingest/types";

// --------------------------------------------------------------- the query
//
// Field names verified by introspection. Note `media` rather than `images`:
// `Product` has no plain `images` field under the current product model.
//
// `first:` values are the cost lever. GraphQL Admin rate limits are calculated
// query costs where a connection is "sized by first and last arguments", and a
// single query may not exceed 1,000 points — so a page of 50 products each
// pulling 100 variants and 10 media is how a backfill discovers that ceiling.

export const PRODUCTS_PAGE_QUERY = /* GraphQL */ `
  query PopuupCatalogue($first: Int!, $after: String, $variants: Int!, $media: Int!) {
    products(first: $first, after: $after, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        handle
        title
        descriptionHtml
        vendor
        productType
        tags
        status
        onlineStoreUrl
        publishedAt
        createdAt
        updatedAt
        media(first: $media) {
          nodes {
            ... on MediaImage {
              image {
                url
                width
                height
                altText
              }
            }
          }
        }
        variants(first: $variants) {
          nodes {
            id
            legacyResourceId
            title
            sku
            price
            compareAtPrice
            availableForSale
            selectedOptions {
              name
              value
            }
            image {
              url
            }
          }
        }
      }
    }
  }
`;

export interface ProductsPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: unknown[];
  };
}

export interface MapOptions {
  /** The merchant's public storefront origin, for building product URLs. */
  storeUrl: string;
  maxDescription?: number;
}

/**
 * One product node -> an `IngestedProduct`, or null if it cannot be one.
 *
 * Null on no readable variant, matching the public path exactly: "A product
 * with no readable variant has no price and no buy path. Keeping it would put a
 * card on the page that cannot be bought or priced."
 */
export function mapProduct(node: unknown, options: MapOptions): IngestedProduct | null {
  if (!isRecord(node)) return null;

  const handle = str(node["handle"]);
  const title = str(node["title"]);
  if (!handle || !title) return null;

  const variants = mapVariants(node["variants"]);
  if (variants.length === 0) return null;

  const prices = variants.map((v) => v.price);
  const storeUrl = new URL(options.storeUrl);

  return {
    handle,
    ...(str(node["id"]) ? { id: str(node["id"])! } : {}),
    title: title.trim(),
    description: htmlToText(str(node["descriptionHtml"]) ?? "", options.maxDescription ?? 1200),
    ...(str(node["vendor"]) ? { vendor: str(node["vendor"])! } : {}),
    ...(str(node["productType"]) ? { productType: str(node["productType"])! } : {}),
    tags: Array.isArray(node["tags"]) ? node["tags"].map(String).filter(Boolean) : [],
    // `onlineStoreUrl` is null for a product not published to the online store,
    // and the storefront URL is what a shopper has to be sent to — so fall back
    // to the canonical /products/<handle> the public path already builds.
    url: str(node["onlineStoreUrl"]) ?? new URL(`/products/${encodeURIComponent(handle)}`, storeUrl).toString(),
    images: mapImages(node["media"]),
    variants,
    price: { min: Math.min(...prices), max: Math.max(...prices) },
    available: variants.some((v) => v.available),
    /*
     * True, and this is a real difference from the public path worth stating.
     *
     * `availableForSale` is `Boolean!` in the schema — non-null — so an Admin
     * response always answers the availability question. The public ladder has
     * rungs that do not, which is why `availabilityKnown` exists at all. An
     * app-backed catalogue is therefore strictly better informed here, and the
     * renderer's "say nothing about stock we never read" branch simply stops
     * being reachable for these stores.
     */
    availabilityKnown: true,
    ...(str(node["publishedAt"]) ? { publishedAt: str(node["publishedAt"])! } : {}),
    ...(str(node["createdAt"]) ? { createdAt: str(node["createdAt"])! } : {}),
  };
}

function mapVariants(raw: unknown): IngestedVariant[] {
  const nodes = connectionNodes(raw);
  const out: IngestedVariant[] = [];

  for (const entry of nodes) {
    if (!isRecord(entry)) continue;

    // Money is a decimal string ("24.00"), so this takes parseMoney's string
    // branch. [unverified] on the wire — introspection gives the type, not the
    // encoding. If it ever arrives as a number, parseMoney reads it as minor
    // units, which is the documented convention on Shopify's JS-facing
    // surfaces and so is the right guess to be wrong in.
    const price = parseMoney(entry["price"]);
    if (price === null) continue;

    // The numeric id, never the gid. See the note at the top of this file.
    const id = str(entry["legacyResourceId"]);
    if (!id) continue;

    const compareAt = parseMoney(entry["compareAtPrice"]);
    const image = isRecord(entry["image"]) ? str(entry["image"]["url"]) : undefined;

    out.push({
      id,
      title: str(entry["title"]) ?? "Default",
      ...(str(entry["sku"]) ? { sku: str(entry["sku"])! } : {}),
      price,
      // Same rule as the public path: a compare-at at or below the price is a
      // leftover from an ended sale, not a discount, and printing it would
      // strike through a number that never was.
      ...(compareAt !== null && compareAt > price ? { compareAtPrice: compareAt } : {}),
      available: entry["availableForSale"] === true,
      options: mapSelectedOptions(entry["selectedOptions"]),
      ...(image ? { imageUrl: image } : {}),
    });
  }

  return out;
}

/** `[{name: "Size", value: "Small"}]` -> `["Small"]`, matching the public shape. */
function mapSelectedOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((option) => (isRecord(option) ? str(option["value"]) : undefined))
    .filter((value): value is string => Boolean(value));
}

function mapImages(raw: unknown): IngestedImage[] {
  const out: IngestedImage[] = [];
  const seen = new Set<string>();

  for (const node of connectionNodes(raw)) {
    // A media connection carries videos and 3D models alongside images; only
    // MediaImage has `image`, and the others come back as empty objects from
    // the inline fragment above.
    if (!isRecord(node)) continue;
    const image = node["image"];
    if (!isRecord(image)) continue;

    const url = str(image["url"]);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const width = posInt(image["width"]);
    const height = posInt(image["height"]);
    const alt = str(image["altText"]);
    out.push({
      url,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(alt ? { alt } : {}),
    });
  }

  return out;
}

export interface MapPageResult {
  products: IngestedProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
  /** Nodes that could not be mapped. Reported, never silently swallowed. */
  skipped: number;
}

export function mapProductsPage(data: unknown, options: MapOptions): MapPageResult {
  const products = isRecord(data) ? data["products"] : undefined;
  const page = isRecord(products) ? products : undefined;
  const nodes = page && Array.isArray(page["nodes"]) ? page["nodes"] : [];
  const pageInfo = page && isRecord(page["pageInfo"]) ? page["pageInfo"] : undefined;

  const mapped: IngestedProduct[] = [];
  let skipped = 0;
  for (const node of nodes) {
    const product = mapProduct(node, options);
    if (product) mapped.push(product);
    else skipped++;
  }

  return {
    products: mapped,
    hasNextPage: pageInfo?.["hasNextPage"] === true,
    endCursor: (pageInfo && str(pageInfo["endCursor"])) ?? null,
    skipped,
  };
}

/**
 * Every mapped page -> one `Catalogue`.
 *
 * `currency` is not on a product and has to come from the shop, so it is passed
 * in. Null when the caller did not read it — never defaulted to USD, which is
 * the ingester's rule and the reason it exists: "currency stays null when
 * undeclared rather than defaulting to USD".
 */
export function toCatalogue(
  products: IngestedProduct[],
  options: { currency: string | null; truncated?: boolean; productCount?: number },
): Catalogue {
  return {
    currency: options.currency,
    products,
    productCount: options.productCount ?? products.length,
    truncated: options.truncated ?? false,
  };
}

// ------------------------------------------------------------------ helpers

/** Accepts `{nodes: [...]}` and `{edges: [{node}]}`; the query above uses nodes. */
function connectionNodes(raw: unknown): unknown[] {
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw["nodes"])) return raw["nodes"];
  if (Array.isArray(raw["edges"])) {
    return raw["edges"].map((edge) => (isRecord(edge) ? edge["node"] : undefined));
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined;
  // `legacyResourceId` is an UnsignedInt64 and may deserialise as a number.
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function posInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
