/**
 * The catalogue, read from the Admin GraphQL API.
 *
 * The query was validated against the live Admin schema through the Shopify
 * docs tool on 2026-10-08 (needs `read_products` and nothing else). Nothing in
 * this file has run against a real store yet.
 */

import type { AdminClient } from "./client.js";

export const PRODUCTS_QUERY = `query CatalogueProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      handle
      status
      productType
      vendor
      tags
      description
      updatedAt
      variants(first: 50) { nodes { id sku title barcode } }
    }
  }
}`;

/** One product as the catalogue sync needs it. Kept whole as `raw_json`. */
export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
  description: string;
  updatedAt: string | null;
  variants: { id: string; sku: string | null; title: string; barcode: string | null }[];
};

type Page = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: (Omit<ShopifyProduct, "variants"> & { variants: { nodes: ShopifyProduct["variants"] } })[];
  };
};

export type CatalogueRead = { products: ShopifyProduct[]; truncated: boolean };

/**
 * Every product, page by page, up to `limit`. `truncated` says whether the
 * shop has more than were read — a sync that stops at a plan's allowance must
 * say so rather than present a partial catalogue as the whole one.
 */
export async function readCatalogue(admin: AdminClient, options: { limit?: number; pageSize?: number } = {}): Promise<CatalogueRead> {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const pageSize = options.pageSize ?? 100;
  const products: ShopifyProduct[] = [];
  let after: string | null = null;

  for (;;) {
    const first = Math.min(pageSize, limit - products.length);
    if (first <= 0) return { products, truncated: true };
    const page: Page = (await admin.request<Page>(PRODUCTS_QUERY, { first, after })).data;
    for (const node of page.products.nodes) products.push({ ...node, variants: node.variants.nodes });
    if (!page.products.pageInfo.hasNextPage) return { products, truncated: false };
    after = page.products.pageInfo.endCursor;
    if (products.length >= limit) return { products, truncated: true };
  }
}

/**
 * A `products/create` or `products/update` webhook payload → the same shape.
 *
 * Webhook payloads are REST-shaped (snake_case, comma-separated tags, HTML
 * body), whatever API the app otherwise uses. Returns null for a payload
 * without an id, which the route acknowledges without acting on.
 */
export function productFromWebhook(payload: unknown): ShopifyProduct | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = typeof p["admin_graphql_api_id"] === "string" ? p["admin_graphql_api_id"] : idFromNumeric(p["id"]);
  if (!id) return null;
  const str = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
  const variants = Array.isArray(p["variants"]) ? (p["variants"] as Record<string, unknown>[]) : [];
  return {
    id,
    title: str("title"),
    handle: str("handle"),
    status: str("status").toUpperCase(),
    productType: str("product_type"),
    vendor: str("vendor"),
    tags: str("tags").split(",").map((t) => t.trim()).filter(Boolean),
    description: htmlToText(str("body_html")),
    updatedAt: str("updated_at") || null,
    variants: variants.map((v) => ({
      id: typeof v["admin_graphql_api_id"] === "string" ? v["admin_graphql_api_id"] : String(v["id"] ?? ""),
      sku: typeof v["sku"] === "string" ? v["sku"] : null,
      title: typeof v["title"] === "string" ? v["title"] : "",
      barcode: typeof v["barcode"] === "string" ? v["barcode"] : null,
    })),
  };
}

/** A `products/delete` payload carries only the numeric id. */
export function idFromNumeric(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value)) return `gid://shopify/Product/${value}`;
  if (typeof value === "string" && /^\d+$/.test(value)) return `gid://shopify/Product/${value}`;
  return null;
}

/** Enough to make a description searchable; not a sanitiser and never rendered. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}
