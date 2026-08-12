/**
 * Store URL in, catalogue and brand context out. Step 1 of the build order.
 *
 * The whole of the ingester's public surface is `ingestStore`. Everything it
 * returns is either something a storefront told us or an explicit admission
 * that it didn't, and the result is validated against `types.ts` on the way
 * out — the same discipline the brief demands of model output, applied to our
 * own, because the merchandiser downstream is entitled to assume its input is
 * the shape it claims to be.
 */

import { extractBrandContext } from "./brand";
import { fetchCatalogue } from "./catalogue";
import { detectCurrency } from "./currency";
import { extractStylesheetHrefs, extractStyleBlocks } from "./html";
import { collectColours } from "./colour";
import { createHttpClient, type FetchLike, type HttpClient } from "./http";
import { createPlaywrightRenderer, type Renderer } from "./renderer";
import { ALLOW_ALL, parseRobots, type RobotsRules } from "./robots";
import { IngestError, IngestResult, type TraceEntry } from "./types";
import { absoluteUrl, normaliseStoreUrl } from "./url";

export interface IngestOptions {
  /** Injected in tests. Everything above http.ts is pure. */
  fetchImpl?: FetchLike;
  http?: HttpClient;
  /**
   * `undefined` builds one from CHROMIUM_PATH and closes it afterwards;
   * `null` disables the browser rung entirely.
   */
  renderer?: Renderer | null;
  maxProducts?: number;
  respectRobots?: boolean;
  userAgent?: string;
  now?: () => Date;
}

const DEFAULT_MAX_PRODUCTS = 1000;

/** Below this many colours from inline CSS, it is worth fetching a stylesheet. */
const COLOUR_ENOUGH = 8;

export async function ingestStore(input: string, options: IngestOptions = {}): Promise<IngestResult> {
  const trace: TraceEntry[] = [];
  const warnings: string[] = [];
  const now = options.now ?? (() => new Date());

  let storeUrl = normaliseStoreUrl(input);

  const http =
    options.http ??
    createHttpClient({
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.userAgent ? { userAgent: options.userAgent } : {}),
    });

  const ownsRenderer = options.renderer === undefined;
  const renderer: Renderer | null = ownsRenderer ? createPlaywrightRenderer() : (options.renderer ?? null);

  try {
    // ---- homepage ----------------------------------------------------
    const homepageStarted = Date.now();
    let homepage = await http.get(storeUrl.toString());
    let html = homepage.ok ? homepage.body : "";

    if (homepage.ok) {
      // Redirects are how we learn whether this store lives on the apex or on
      // www. Settling it once, here, keeps every later URL on one origin —
      // and keeps the published shop's links off a redirect hop.
      const finalUrl = new URL(homepage.url);
      if (finalUrl.origin !== storeUrl.origin) {
        trace.push({ step: "homepage:redirect", url: homepage.url, outcome: "ok", detail: `${storeUrl.origin} -> ${finalUrl.origin}` });
        storeUrl = new URL(finalUrl.origin);
      }
      trace.push({ step: "homepage", url: homepage.url, outcome: "ok", ms: Date.now() - homepageStarted });
    } else {
      trace.push({
        step: "homepage",
        url: storeUrl.toString(),
        outcome: "failed",
        detail: homepage.error ?? `HTTP ${homepage.status}`,
        ms: Date.now() - homepageStarted,
      });

      // A homepage that blocks a plain fetch is usually a bot challenge, not
      // a dead store — and the catalogue endpoints are often still open. Try
      // the browser for the brand surface, then carry on regardless.
      if (renderer) {
        try {
          const rendered = await renderer.render(storeUrl.toString());
          html = rendered.html;
          trace.push({ step: "homepage:rendered", url: rendered.url, outcome: "ok" });
        } catch (error) {
          trace.push({
            step: "homepage:rendered",
            outcome: "failed",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!html) {
        warnings.push(
          `The homepage could not be read (${homepage.error ?? `HTTP ${homepage.status}`}); brand context will be thin.`,
        );
      }
    }

    // ---- robots ------------------------------------------------------
    const robots = options.respectRobots === false ? ALLOW_ALL : await loadRobots(http, storeUrl, trace);
    if (robots.crawlDelayMs) http.setMinIntervalMs(robots.crawlDelayMs);
    if (!robots.isAllowed("/products.json") && !robots.isAllowed("/collections/all")) {
      throw new IngestError(
        "robots-denied",
        `${storeUrl.hostname} disallows crawling its product pages. Pass respectRobots: false only when the merchant has connected this store themselves.`,
        trace,
      );
    }

    // ---- brand -------------------------------------------------------
    const stylesheets = await maybeFetchStylesheets(html, http, storeUrl, robots, trace);
    const extraction = extractBrandContext({ html, storeUrl, stylesheets });
    warnings.push(...extraction.warnings);

    // ---- catalogue ---------------------------------------------------
    const catalogueStarted = Date.now();
    const outcome = await fetchCatalogue({
      http,
      storeUrl,
      robots,
      renderer,
      maxProducts: options.maxProducts ?? DEFAULT_MAX_PRODUCTS,
      trace,
      warnings,
    });

    if (!outcome.source || outcome.products.length === 0) {
      throw new IngestError(
        "no-catalogue",
        `No public catalogue found at ${storeUrl.hostname}. Tried /products.json, /collections/all/products.json, the sitemap and a rendered collection page.`,
        trace,
      );
    }

    trace.push({
      step: "catalogue",
      outcome: "ok",
      detail: `${outcome.products.length} products via ${outcome.source}`,
      ms: Date.now() - catalogueStarted,
    });

    const currency = detectCurrency(html);
    if (!currency) {
      warnings.push(
        "Currency not declared anywhere on the storefront — prices are ingested as bare numbers and must be rendered without a symbol.",
      );
    }

    // The renderer has to flatter mediocre product photography, so it needs to
    // be told when there is none at all. A card with no image is a design
    // problem to solve, not a product to drop.
    const imageless = outcome.products.filter((p) => p.images.length === 0).length;
    if (imageless > 0) {
      warnings.push(
        `${imageless} of ${outcome.products.length} products have no imagery — the renderer must have a card treatment that does not depend on a photograph.`,
      );
    }

    const unknownStock = outcome.products.filter((p) => !p.availabilityKnown).length;
    if (unknownStock > 0) {
      warnings.push(
        `${unknownStock} products came from a surface that does not report stock; they are assumed available and must not be shown with a stock badge either way.`,
      );
    }

    const soldOut = outcome.products.filter((p) => !p.available).length;
    if (soldOut > 0) {
      // Not a warning about a problem — a note that the renderer has work to
      // do. Sold-out products are shown and marked, never dropped.
      trace.push({ step: "catalogue:stock", outcome: "ok", detail: `${soldOut} of ${outcome.products.length} products sold out` });
    }

    const result: IngestResult = {
      store: {
        inputUrl: input,
        storeUrl: storeUrl.toString(),
        platform: extraction.looksShopify || outcome.source !== "rendered" ? "shopify" : "unknown",
        catalogueSource: outcome.source,
        ingestedAt: now().toISOString(),
      },
      brand: extraction.brand,
      catalogue: {
        currency,
        products: outcome.products,
        productCount: outcome.products.length,
        truncated: outcome.truncated,
      },
      reviews: {
        available: false,
        platformDetected: extraction.reviewPlatform,
        note: extraction.reviewPlatform
          ? `This store uses ${extraction.reviewPlatform}, but no review content was ingested. Omit the reviews block.`
          : "No review data was ingested from this store. Omit the reviews block.",
      },
      diagnostics: { warnings, trace },
    };

    // Our own output, held to the contract we hold the model to.
    return IngestResult.parse(result);
  } finally {
    if (ownsRenderer) await renderer?.close();
  }
}

async function loadRobots(http: HttpClient, storeUrl: URL, trace: TraceEntry[]): Promise<RobotsRules> {
  const target = new URL("/robots.txt", storeUrl).toString();
  const result = await http.get(target, { accept: "text/plain" });
  if (!result.ok || !result.body.trim()) {
    trace.push({ step: "robots", url: target, outcome: "empty", detail: result.error ?? `HTTP ${result.status}` });
    return ALLOW_ALL;
  }
  const rules = parseRobots(result.body, http.userAgent);
  trace.push({
    step: "robots",
    url: target,
    outcome: "ok",
    ...(rules.crawlDelayMs ? { detail: `crawl-delay ${rules.crawlDelayMs}ms` } : {}),
  });
  return rules;
}

/**
 * Fetch a stylesheet or two, but only when the page did not already tell us
 * enough about its colours.
 *
 * Modern Shopify themes inline their colour schemes as custom properties in
 * the head, which is both the best source and free. Older ones put everything
 * in the theme bundle, and for those two extra requests is a fair price for
 * knowing what the brand's actual accent colour is.
 */
async function maybeFetchStylesheets(
  html: string,
  http: HttpClient,
  storeUrl: URL,
  robots: RobotsRules,
  trace: TraceEntry[],
): Promise<string[]> {
  if (!html) return [];
  const inline = collectColours(extractStyleBlocks(html));
  if (inline.length >= COLOUR_ENOUGH) {
    trace.push({ step: "stylesheets", outcome: "skipped", detail: `${inline.length} colours already inline` });
    return [];
  }

  const hrefs = extractStylesheetHrefs(html)
    .map((href) => absoluteUrl(href, storeUrl))
    .filter((url): url is string => Boolean(url))
    .filter((url) => new URL(url).hostname.endsWith(storeUrl.hostname) || new URL(url).hostname.endsWith("cdn.shopify.com"))
    .slice(0, 2);

  const bodies: string[] = [];
  for (const href of hrefs) {
    const url = new URL(href);
    if (url.hostname === storeUrl.hostname && !robots.isAllowed(url.pathname + url.search)) continue;
    const result = await http.get(href, { accept: "text/css" });
    if (result.ok && result.body) bodies.push(result.body);
    trace.push({
      step: "stylesheets",
      url: href,
      outcome: result.ok ? "ok" : "failed",
      ...(result.ok ? {} : { detail: result.error ?? `HTTP ${result.status}` }),
    });
  }
  return bodies;
}

export { IngestError } from "./types";
export type {
  BrandContext,
  Catalogue,
  IngestedImage,
  IngestedProduct,
  IngestedVariant,
  IngestResult,
  TraceEntry,
} from "./types";
export { createHttpClient } from "./http";
export { createPlaywrightRenderer } from "./renderer";
export type { Renderer } from "./renderer";
