/**
 * The ladder: four ways to get a catalogue, tried in order of how much they
 * cost the store we are reading.
 *
 *   1. /products.json                   — 1-4 requests, the whole catalogue.
 *   2. /collections/all/products.json   — same feed, different route. Some
 *                                         storefronts close one and not the other.
 *   3. sitemap -> /products/<handle>.js — one request per product. Slow, but it
 *                                         works when the list endpoints are off.
 *   4. rendered collection page         — a browser. Last resort, see renderer.ts.
 *
 * We stop at the first rung that yields products. Each attempt is recorded in
 * the trace whether it worked or not, because "why did this store come back
 * empty" is the question we will be asking thirty times during the kill-test.
 */

import type { HttpClient } from "./http";
import { looksLikeJson } from "./http";
import { decodeEntities } from "./html";
import { parseProductList, parseSingleProduct } from "./products";
import type { Renderer } from "./renderer";
import type { RobotsRules } from "./robots";
import type { CatalogueSource, IngestedProduct, TraceEntry } from "./types";
import { productHandleFromUrl } from "./url";

export interface CatalogueOptions {
  http: HttpClient;
  storeUrl: URL;
  robots: RobotsRules;
  renderer: Renderer | null;
  maxProducts: number;
  trace: TraceEntry[];
  warnings: string[];
}

export interface CatalogueOutcome {
  products: IngestedProduct[];
  source: CatalogueSource | null;
  truncated: boolean;
}

/** Shopify's own ceiling on the list endpoints. Asking for more returns 250. */
const PAGE_SIZE = 250;
const MAX_PAGES = 8;

/**
 * The per-product rungs fetch one URL per product, so an unbounded catalogue
 * would take minutes. A hundred and fifty products is far more than the twelve
 * a block can hold, and the alternative — a five-minute ingest — fails the
 * sixty-second bar in the definition of done.
 */
const FALLBACK_PRODUCT_LIMIT = 150;

export async function fetchCatalogue(options: CatalogueOptions): Promise<CatalogueOutcome> {
  const rungs: [CatalogueSource, () => Promise<IngestedProduct[]>][] = [
    ["products.json", () => fetchListEndpoint(options, "/products.json", "products.json")],
    ["collections-all.json", () => fetchListEndpoint(options, "/collections/all/products.json", "collections-all.json")],
    ["sitemap+product.js", () => fetchViaSitemap(options)],
    ["rendered", () => fetchViaRenderer(options)],
  ];

  for (const [source, run] of rungs) {
    const products = await run();
    if (products.length > 0) {
      const capped = products.slice(0, options.maxProducts);
      return { products: capped, source, truncated: capped.length < products.length };
    }
  }

  return { products: [], source: null, truncated: false };
}

// ---------------------------------------------------------------- rungs 1 & 2

async function fetchListEndpoint(
  options: CatalogueOptions,
  path: string,
  step: CatalogueSource,
): Promise<IngestedProduct[]> {
  const { http, storeUrl, robots, trace, maxProducts } = options;
  const products: IngestedProduct[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(path, storeUrl);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const target = url.toString();

    if (!allowed(robots, url, trace, step)) return [];

    const started = Date.now();
    const result = await http.get(target, { accept: "application/json" });
    const ms = Date.now() - started;

    if (!looksLikeJson(result)) {
      trace.push({
        step,
        url: target,
        outcome: page === 1 ? "failed" : "empty",
        detail: result.error ?? `HTTP ${result.status}${result.contentType ? ` (${result.contentType})` : ""}`,
        ms,
      });
      return page === 1 ? [] : products;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.body);
    } catch {
      trace.push({ step, url: target, outcome: "failed", detail: "unparseable JSON", ms });
      // A truncated body is a real possibility on a huge first page, and the
      // pages we already have are still good products.
      return products;
    }

    const batch = parseProductList(parsed, { storeUrl });
    for (const product of batch) {
      if (seen.has(product.handle)) continue;
      seen.add(product.handle);
      products.push(product);
    }

    trace.push({
      step,
      url: target,
      outcome: batch.length > 0 ? "ok" : "empty",
      detail: `page ${page}, ${batch.length} products`,
      ms,
    });

    // A short page is the last page. Shopify keeps serving page N+1 as an
    // empty array for ever, so this is also what stops the loop.
    if (batch.length < PAGE_SIZE) break;
    if (products.length >= maxProducts) break;
  }

  if (products.length >= maxProducts) {
    options.warnings.push(
      `Catalogue larger than the ${maxProducts}-product ingest cap; the newest ${maxProducts} were taken.`,
    );
  }

  return products;
}

// -------------------------------------------------------------------- rung 3

async function fetchViaSitemap(options: CatalogueOptions): Promise<IngestedProduct[]> {
  const handles = await collectHandlesFromSitemap(options);
  if (handles.length === 0) return [];
  return fetchProductsByHandle(options, handles, "sitemap+product.js", (url) =>
    options.http.get(url, { accept: "application/json" }).then((r) => {
      if (!looksLikeJson(r)) throw new Error(r.error ?? `HTTP ${r.status}`);
      return JSON.parse(r.body) as unknown;
    }),
  );
}

async function collectHandlesFromSitemap(options: CatalogueOptions): Promise<string[]> {
  const { http, storeUrl, robots, trace } = options;
  const handles: string[] = [];
  const seen = new Set<string>();
  const queue = [new URL("/sitemap.xml", storeUrl).toString()];
  const visited = new Set<string>();

  // The index plus a handful of product sitemaps. Shopify shards at 5,000
  // URLs each, and we cannot use more than the fallback limit anyway.
  while (queue.length > 0 && visited.size < 6 && handles.length < FALLBACK_PRODUCT_LIMIT) {
    const target = queue.shift()!;
    if (visited.has(target)) continue;
    visited.add(target);

    let url: URL;
    try {
      url = new URL(target);
    } catch {
      continue;
    }
    if (!allowed(robots, url, trace, "sitemap")) continue;

    const started = Date.now();
    const result = await http.get(target, { accept: "application/xml,text/xml" });
    const ms = Date.now() - started;
    if (!result.ok || !result.body) {
      trace.push({ step: "sitemap", url: target, outcome: "failed", detail: result.error ?? `HTTP ${result.status}`, ms });
      continue;
    }

    const locations = [...result.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => decodeEntities(m[1] ?? ""))
      .filter(Boolean);

    let found = 0;
    for (const location of locations) {
      if (/sitemap_products/i.test(location)) {
        queue.push(location);
        continue;
      }
      const handle = productHandleFromUrl(location);
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      handles.push(handle);
      found++;
      if (handles.length >= FALLBACK_PRODUCT_LIMIT) break;
    }

    trace.push({
      step: "sitemap",
      url: target,
      outcome: found > 0 || queue.length > 0 ? "ok" : "empty",
      detail: `${found} product URLs`,
      ms,
    });
  }

  return handles;
}

// -------------------------------------------------------------------- rung 4

async function fetchViaRenderer(options: CatalogueOptions): Promise<IngestedProduct[]> {
  const { renderer, storeUrl, robots, trace } = options;
  if (!renderer) {
    trace.push({
      step: "rendered",
      outcome: "skipped",
      detail: "no browser available (set CHROMIUM_PATH, or pass a renderer)",
    });
    return [];
  }

  const collectionUrl = new URL("/collections/all", storeUrl);
  if (!allowed(robots, collectionUrl, trace, "rendered")) return [];

  const started = Date.now();
  let html: string;
  try {
    ({ html } = await renderer.render(collectionUrl.toString()));
  } catch (error) {
    trace.push({
      step: "rendered",
      url: collectionUrl.toString(),
      outcome: "failed",
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    });
    return [];
  }

  const handles: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']*\/products\/[^"']+)["']/gi)) {
    const handle = productHandleFromUrl(match[1] ?? "");
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
    if (handles.length >= FALLBACK_PRODUCT_LIMIT) break;
  }

  trace.push({
    step: "rendered",
    url: collectionUrl.toString(),
    outcome: handles.length > 0 ? "ok" : "empty",
    detail: `${handles.length} product links in the rendered page`,
    ms: Date.now() - started,
  });

  if (handles.length === 0) return [];
  // Through the browser context, so the JSON request carries whatever cookies
  // got the collection page to render in the first place.
  return fetchProductsByHandle(options, handles, "rendered", (url) => renderer.json(url));
}

// -------------------------------------------------------------------- shared

async function fetchProductsByHandle(
  options: CatalogueOptions,
  handles: string[],
  step: string,
  load: (url: string) => Promise<unknown>,
): Promise<IngestedProduct[]> {
  const { storeUrl, trace, warnings, maxProducts } = options;
  const limit = Math.min(handles.length, maxProducts, FALLBACK_PRODUCT_LIMIT);
  if (limit < handles.length) {
    warnings.push(
      `${handles.length} products discovered but only ${limit} fetched — this store needs the per-product fallback, which is one request each.`,
    );
  }

  const products: IngestedProduct[] = [];
  let failures = 0;

  for (const handle of handles.slice(0, limit)) {
    const target = new URL(`/products/${encodeURIComponent(handle)}.js`, storeUrl).toString();
    try {
      const product = parseSingleProduct(await load(target), { storeUrl });
      if (product) products.push(product);
      else failures++;
    } catch {
      failures++;
      // A run of failures means the endpoint is closed, not that these
      // particular products are odd. Keep going long enough to be sure.
      if (failures >= 5 && products.length === 0) break;
    }
  }

  trace.push({
    step: `${step}:products`,
    outcome: products.length > 0 ? "ok" : "failed",
    detail: `${products.length} of ${limit} fetched${failures ? `, ${failures} failed` : ""}`,
  });

  return products;
}

function allowed(robots: RobotsRules, url: URL, trace: TraceEntry[], step: string): boolean {
  if (robots.isAllowed(url.pathname + url.search)) return true;
  trace.push({ step, url: url.toString(), outcome: "skipped", detail: "disallowed by robots.txt" });
  return false;
}
