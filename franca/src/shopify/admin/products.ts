/**
 * A store's product copy, read through the Admin API.
 *
 * Franca needs far less of a product than shopfront does: no variants, no
 * prices, no media. It needs the words a brand publishes about the product —
 * title, description, the search-result description — and enough identity to
 * rescan one product when a webhook says it changed. That is also why the app
 * asks for `read_products` and nothing else (brief §7).
 *
 * Both queries were validated against the live Admin schema on 2026-09-28 and
 * need only `read_products`.
 *
 * Every status is read, drafts included. §3 sells "launch copy that clears
 * review first time", and a draft is launch copy before launch. Whether a
 * product may carry a badge is a separate question the catalogue scan answers.
 */

import { fragmentToText } from "../../fetch/html.js";
import type { AdminClient } from "./client.js";

const PRODUCT_FIELDS = /* GraphQL */ `
  id
  legacyResourceId
  handle
  title
  descriptionHtml
  status
  onlineStoreUrl
  updatedAt
  seo {
    title
    description
  }
`;

export const PRODUCT_COPY_QUERY = /* GraphQL */ `
  query FrancaProductCopy($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {${PRODUCT_FIELDS}}
    }
  }
`;

export const ONE_PRODUCT_QUERY = /* GraphQL */ `
  query FrancaOneProduct($id: ID!) {
    product(id: $id) {${PRODUCT_FIELDS}}
  }
`;

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED" | "UNLISTED" | string;

/** One product, reduced to the copy Franca scans. */
export type ProductCopy = {
  /** `gid://shopify/Product/…` — what webhooks and the Admin API key on. */
  gid: string;
  legacyId: string;
  handle: string;
  title: string;
  status: ProductStatus;
  /** Null for a product not published to the online store, drafts included. */
  url: string | null;
  updatedAt: string;
  /**
   * Title, description and search description, as the scan reads them.
   *
   * Joined with blank lines so a finding's span still lands inside one of the
   * three. The search description is included because it is published copy —
   * it is the sentence a shopper reads on Google — and dropped only when the
   * description already contains it, which is the common theme default.
   */
  text: string;
};

type RawProduct = {
  id: string;
  legacyResourceId: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  status: string;
  onlineStoreUrl: string | null;
  updatedAt: string;
  seo: { title: string | null; description: string | null } | null;
};

type ProductsPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RawProduct[];
  };
};

export function toProductCopy(raw: RawProduct): ProductCopy {
  const title = raw.title.trim();
  const body = fragmentToText(raw.descriptionHtml ?? "");
  const seo = raw.seo?.description?.trim() ?? "";
  const seoIsNew = seo.length > 0 && !normalise(body).includes(normalise(seo));
  const text = [title, body, seoIsNew ? seo : ""].filter((part) => part.length > 0).join("\n\n");

  return {
    gid: raw.id,
    legacyId: String(raw.legacyResourceId),
    handle: raw.handle,
    title,
    status: raw.status,
    url: raw.onlineStoreUrl,
    updatedAt: raw.updatedAt,
    text,
  };
}

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface ReadCatalogueOptions {
  /** Products per request. 50 keeps a page's query cost small; see client.ts. */
  pageSize?: number;
  /**
   * Stop after this many products — the plan's product allowance (§6). The
   * result says it stopped, so the app can say "your first 50 of 312" instead
   * of implying 50 was everything.
   */
  limit?: number;
}

export type CatalogueCopy = { products: ProductCopy[]; truncated: boolean };

export async function readCatalogueCopy(
  client: AdminClient,
  options: ReadCatalogueOptions = {},
): Promise<CatalogueCopy> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 250);
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const products: ProductCopy[] = [];
  let after: string | null = null;

  for (;;) {
    const first = Math.min(pageSize, limit - products.length);
    if (first <= 0) return { products, truncated: true };

    const page: ProductsPage = (await client.request<ProductsPage>(PRODUCT_COPY_QUERY, { first, after })).data;
    products.push(...page.products.nodes.map(toProductCopy));

    const { hasNextPage, endCursor } = page.products.pageInfo;
    if (!hasNextPage || !endCursor) return { products, truncated: false };
    if (products.length >= limit) return { products, truncated: true };
    after = endCursor;
  }
}

/** One product by gid, or null when it no longer exists. */
export async function readProductCopy(client: AdminClient, gid: string): Promise<ProductCopy | null> {
  const { data } = await client.request<{ product: RawProduct | null }>(ONE_PRODUCT_QUERY, { id: gid });
  return data.product ? toProductCopy(data.product) : null;
}
