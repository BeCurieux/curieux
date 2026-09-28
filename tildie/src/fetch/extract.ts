/**
 * A product page down to the claims on it — the ladder, and why it is ordered
 * this way.
 *
 * The obvious approach is "strip the HTML and scan whatever is left". It is
 * wrong in a specific and expensive way: a PDP carries a related-products
 * carousel and a review widget, both full of claims about *other* products.
 * Scan the whole page and the card marks a phrase the founder cannot find on
 * it, which is the fastest way to lose them.
 *
 * So structured sources come first. A Shopify product endpoint returns exactly
 * this product's title and description and nothing about its neighbours, and
 * every brand in BRIEF.md §2 is Shopify-native. JSON-LD is the same bargain
 * for everyone else.
 *
 * The cost is the mirror image: theme sections — the hero line, the "our
 * promise" block, the sustainability paragraph — are not in the product
 * description, and those are where environmental claims usually live. So a
 * structured win still keeps the whole page alongside it, and the caller runs
 * the corpus over both. A character count was tried first and was useless: the
 * page that prompted this held one extra sentence, 118 characters long, and
 * the sentence was "we are a carbon neutral, eco-friendly brand". What matters
 * is not how much was missed but whether what was missed trips anything.
 */

import { findProduct, fragmentToText, htmlToText, jsonLdBlocks, mainRegion, titleOf } from "./html.js";

export type Via = "shopify-product-json" | "json-ld-product" | "main-region" | "whole-page";

export type Extracted = {
  title?: string;
  text: string;
  via: Via;
};

/** Copy shorter than this is almost always a redirect page or a JS shell. */
export const THIN_TEXT = 200;

/** `…/products/handle` → the JSON endpoints beside it, in preference order. */
export function shopifyEndpoints(pageUrl: string): string[] {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return [];
  }
  const match = /^(.*\/products\/[^/]+?)(?:\.js|\.json)?\/?$/.exec(url.pathname);
  if (!match?.[1]) return [];
  const base = `${url.origin}${match[1]}`;
  return [`${base}.js`, `${base}.json`];
}

type Jsonish = Record<string, unknown>;
const isObject = (value: unknown): value is Jsonish => typeof value === "object" && value !== null;
const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

/**
 * Shopify's `/products/handle.js` returns the product; `.json` wraps it in
 * `{ product: … }` and calls the description `body_html`. Both are handled
 * because a store's theme decides which one answers.
 */
export function fromShopifyProduct(payload: unknown): Extracted | null {
  if (!isObject(payload)) return null;
  const product = isObject(payload["product"]) ? (payload["product"] as Jsonish) : payload;
  const title = str(product["title"]);
  const body = str(product["description"]) ?? str(product["body_html"]);
  if (!title && !body) return null;

  const text = [title, body ? fragmentToText(body) : undefined].filter(Boolean).join("\n\n");
  if (text.trim().length === 0) return null;
  return { title, text, via: "shopify-product-json" };
}

export function fromJsonLd(html: string): Extracted | null {
  const product = findProduct(jsonLdBlocks(html));
  if (!product) return null;
  const title = str(product["name"]);
  const description = str(product["description"]);
  if (!title && !description) return null;

  const text = [title, description ? fragmentToText(description) : undefined].filter(Boolean).join("\n\n");
  if (text.trim().length === 0) return null;
  return { title, text, via: "json-ld-product" };
}

/** The page itself: the marked main region if there is one, else all of it. */
export function fromHtml(html: string): Extracted {
  const title = titleOf(html);
  const region = mainRegion(html);
  if (region) {
    const text = htmlToText(region);
    if (text.length >= THIN_TEXT) return { title, text, via: "main-region" };
  }
  return { title, text: htmlToText(html), via: "whole-page" };
}

/** Everything the page holds, for measuring what a structured source left out. */
export function wholePageText(html: string): string {
  return htmlToText(html);
}
