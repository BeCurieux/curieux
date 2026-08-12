import { describe, expect, it, vi } from "vitest";
import { ingestStore } from "@/lib/ingest/index";
import { createHttpClient, type FetchLike } from "@/lib/ingest/http";
import { IngestError, IngestResult } from "@/lib/ingest/types";
import type { Renderer } from "@/lib/ingest/renderer";
import { fakeFetch, HOMEPAGE_HTML, PRODUCTS_JSON, PRODUCT_JS, ROBOTS_TXT } from "./helpers/fixtures";

const ORIGIN = "https://kelpandcotton.com";

function client(fetchImpl: FetchLike) {
  // No throttle and no backoff sleeps: the manners are tested in http.test.ts,
  // and paying for them here would put seconds on every case in this file.
  return createHttpClient({ fetchImpl, minIntervalMs: 0, sleep: () => Promise.resolve() });
}

const HAPPY_ROUTES = {
  [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
  [`${ORIGIN}/robots.txt`]: { body: ROBOTS_TXT, contentType: "text/plain" },
  [`${ORIGIN}/products.json`]: { body: PRODUCTS_JSON, contentType: "application/json" },
};

async function ingestHappy(overrides: Record<string, { body: string; status?: number; contentType?: string }> = {}) {
  const { fetchImpl, requests } = fakeFetch({ ...HAPPY_ROUTES, ...overrides });
  const result = await ingestStore("kelpandcotton.com", {
    http: client(fetchImpl),
    renderer: null,
    now: () => new Date("2026-08-11T10:00:00.000Z"),
  });
  return { result, requests };
}

describe("ingestStore — a storefront that behaves", () => {
  it("returns a catalogue and a brand context that validate against the contract", async () => {
    const { result } = await ingestHappy();

    expect(() => IngestResult.parse(result)).not.toThrow();
    expect(result.store).toMatchObject({
      inputUrl: "kelpandcotton.com",
      storeUrl: `${ORIGIN}/`,
      platform: "shopify",
      catalogueSource: "products.json",
      ingestedAt: "2026-08-11T10:00:00.000Z",
    });
    expect(result.catalogue.productCount).toBe(2);
    expect(result.catalogue.currency).toBe("GBP");
    expect(result.brand.name).toBe("Kelp & Cotton");
    expect(result.brand.logoUrl).toBe("https://cdn.shopify.com/s/files/1/0001/logo.svg");
    expect(result.brand.suggestedColorway.accent).toBe("#2f5d50");
  });

  it("keeps sold-out products in the catalogue", async () => {
    const { result } = await ingestHappy();
    const teaTowel = result.catalogue.products.find((p) => p.handle === "linen-tea-towel")!;
    // The brief: shown and marked, never hidden. Dropping it here would make
    // that impossible downstream, whatever the renderer does.
    expect(teaTowel).toBeDefined();
    expect(teaTowel.available).toBe(false);
    expect(result.diagnostics.trace.some((t) => t.detail?.includes("sold out"))).toBe(true);
  });

  it("never claims reviews it did not read", async () => {
    const { result } = await ingestHappy();
    expect(result.reviews.available).toBe(false);
    expect(result.reviews.platformDetected).toBe("judge.me");
    expect(result.reviews.note).toMatch(/omit the reviews block/i);
  });

  it("asks for robots.txt before it crawls anything else", async () => {
    const { requests } = await ingestHappy();
    const robotsAt = requests.findIndex((u) => u.endsWith("/robots.txt"));
    const productsAt = requests.findIndex((u) => u.includes("/products.json"));
    expect(robotsAt).toBeGreaterThanOrEqual(0);
    expect(robotsAt).toBeLessThan(productsAt);
  });

  it("stops paginating on a short page instead of walking to the cap", async () => {
    const { requests } = await ingestHappy();
    expect(requests.filter((u) => u.includes("/products.json"))).toHaveLength(1);
  });
});

describe("ingestStore — settling the origin", () => {
  it("follows the apex-to-www redirect once, then stays there", async () => {
    const { fetchImpl, requests } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML, finalUrl: "https://www.kelpandcotton.com/" },
      "https://www.kelpandcotton.com/robots.txt": { body: ROBOTS_TXT, contentType: "text/plain" },
      "https://www.kelpandcotton.com/products.json": { body: PRODUCTS_JSON, contentType: "application/json" },
    });

    const result = await ingestStore("kelpandcotton.com", { http: client(fetchImpl), renderer: null });

    expect(result.store.storeUrl).toBe("https://www.kelpandcotton.com/");
    // Product links must not point through a redirect on the published shop.
    expect(result.catalogue.products[0]!.url).toBe("https://www.kelpandcotton.com/products/oat-crew");
    expect(requests.filter((u) => u.startsWith(`${ORIGIN}/`))).toHaveLength(1);
  });
});

describe("ingestStore — climbing the ladder", () => {
  it("falls through to /collections/all/products.json when the root feed is off", async () => {
    const { result, requests } = await ingestHappy({
      [`${ORIGIN}/products.json`]: { body: "<!doctype html>", status: 404 },
      [`${ORIGIN}/collections/all/products.json`]: { body: PRODUCTS_JSON, contentType: "application/json" },
    });
    expect(result.store.catalogueSource).toBe("collections-all.json");
    expect(result.catalogue.productCount).toBe(2);
    expect(requests.some((u) => u.includes("/collections/all/products.json"))).toBe(true);
  });

  it("falls through to the sitemap and the per-product endpoint", async () => {
    const { result } = await ingestHappy({
      [`${ORIGIN}/products.json`]: { body: "nope", status: 404 },
      [`${ORIGIN}/collections/all/products.json`]: { body: "nope", status: 404 },
      [`${ORIGIN}/sitemap.xml`]: {
        body: `<sitemapindex><sitemap><loc>${ORIGIN}/sitemap_products_1.xml?from=1&amp;to=9</loc></sitemap></sitemapindex>`,
        contentType: "application/xml",
      },
      [`${ORIGIN}/sitemap_products_1.xml`]: {
        body: `<urlset><url><loc>${ORIGIN}/products/wool-throw</loc></url><url><loc>${ORIGIN}/pages/about</loc></url></urlset>`,
        contentType: "application/xml",
      },
      [`${ORIGIN}/products/wool-throw.js`]: { body: PRODUCT_JS, contentType: "application/json" },
    });

    expect(result.store.catalogueSource).toBe("sitemap+product.js");
    expect(result.catalogue.products.map((p) => p.handle)).toEqual(["wool-throw"]);
    // .js gives minor units. 21500 is £215.00, not £21,500.
    expect(result.catalogue.products[0]!.price.min).toBe(215);
  });

  it("records that the browser rung was skipped rather than pretending it ran", async () => {
    const { fetchImpl } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
      [`${ORIGIN}/robots.txt`]: { body: ROBOTS_TXT, contentType: "text/plain" },
    });
    await expect(ingestStore("kelpandcotton.com", { http: client(fetchImpl), renderer: null })).rejects.toThrow(
      IngestError,
    );
  });

  it("uses the renderer as the last rung, through the browser's own context", async () => {
    const renderer: Renderer = {
      render: vi.fn(async () => ({
        url: `${ORIGIN}/collections/all`,
        html: `<a href="/collections/all/products/wool-throw">Wool Throw</a><a href="/products/wool-throw?variant=1">again</a>`,
      })),
      json: vi.fn(async () => JSON.parse(PRODUCT_JS)),
      close: vi.fn(async () => {}),
    };

    const { fetchImpl } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
      [`${ORIGIN}/robots.txt`]: { body: ROBOTS_TXT, contentType: "text/plain" },
    });

    const result = await ingestStore("kelpandcotton.com", { http: client(fetchImpl), renderer });

    expect(result.store.catalogueSource).toBe("rendered");
    expect(result.catalogue.products.map((p) => p.handle)).toEqual(["wool-throw"]);
    expect(renderer.json).toHaveBeenCalledTimes(1);
    // The caller passed the renderer, so the caller closes it.
    expect(renderer.close).not.toHaveBeenCalled();
  });
});

describe("ingestStore — failing honestly", () => {
  it("fails with the trace when no rung produced a catalogue", async () => {
    const { fetchImpl } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
      [`${ORIGIN}/robots.txt`]: { body: ROBOTS_TXT, contentType: "text/plain" },
    });

    const error = await ingestStore("kelpandcotton.com", { http: client(fetchImpl), renderer: null }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(IngestError);
    const ingestError = error as IngestError;
    expect(ingestError.code).toBe("no-catalogue");
    // An empty catalogue is never returned: the merchandiser improvising over
    // one is exactly how a shop ends up full of products nobody sells.
    expect(ingestError.trace.map((t) => t.step)).toContain("products.json");
    expect(ingestError.trace.find((t) => t.step === "rendered")?.outcome).toBe("skipped");
  });

  it("stops when a store disallows crawling its products", async () => {
    const { fetchImpl } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
      [`${ORIGIN}/robots.txt`]: { body: "User-agent: *\nDisallow: /\n", contentType: "text/plain" },
      [`${ORIGIN}/products.json`]: { body: PRODUCTS_JSON, contentType: "application/json" },
    });

    const error = await ingestStore("kelpandcotton.com", { http: client(fetchImpl), renderer: null }).catch(
      (e: unknown) => e,
    );
    expect((error as IngestError).code).toBe("robots-denied");
  });

  it("proceeds when the merchant has connected the store themselves", async () => {
    const { fetchImpl } = fakeFetch({
      [`${ORIGIN}/`]: { body: HOMEPAGE_HTML },
      [`${ORIGIN}/robots.txt`]: { body: "User-agent: *\nDisallow: /\n", contentType: "text/plain" },
      [`${ORIGIN}/products.json`]: { body: PRODUCTS_JSON, contentType: "application/json" },
    });

    const result = await ingestStore("kelpandcotton.com", {
      http: client(fetchImpl),
      renderer: null,
      respectRobots: false,
    });
    expect(result.catalogue.productCount).toBe(2);
  });

  it("carries on with a thin brand context when the homepage is blocked", async () => {
    const { result } = await ingestHappy({ [`${ORIGIN}/`]: { body: "forbidden", status: 403 } });
    expect(result.catalogue.productCount).toBe(2);
    expect(result.diagnostics.warnings.some((w) => w.includes("homepage could not be read"))).toBe(true);
    // Currency is undeclared without the homepage, and is not guessed at.
    expect(result.catalogue.currency).toBeNull();
    expect(result.diagnostics.warnings.some((w) => w.includes("Currency not declared"))).toBe(true);
  });
});

describe("ingestStore — colour", () => {
  it("fetches a stylesheet only when the page did not already say enough", async () => {
    const thin = `<html><head><title>Plain Goods</title>
      <link rel="stylesheet" href="/theme.css"></head><body><h1>Plain Goods</h1></body></html>`;

    const { result, requests } = await ingestHappy({
      [`${ORIGIN}/`]: { body: thin },
      [`${ORIGIN}/theme.css`]: {
        body: `:root{--color-background:#ffffff;--color-text:#1a1a1a;--color-accent:#b4472f}`,
        contentType: "text/css",
      },
    });

    expect(requests).toContain(`${ORIGIN}/theme.css`);
    expect(result.brand.suggestedColorway.accent).toBe("#b4472f");
  });

  it("does not fetch a stylesheet when the theme inlined its scheme", async () => {
    const { requests } = await ingestHappy();
    expect(requests.some((u) => u.endsWith(".css"))).toBe(false);
  });
});
