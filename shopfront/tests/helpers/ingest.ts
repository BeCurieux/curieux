/**
 * A complete `IngestResult`, built through the real ingest code rather than
 * hand-written. If normalisation changes shape, these fixtures change with it
 * — a hand-typed literal would drift and quietly stop testing anything.
 */

import { extractBrandContext } from "@/lib/ingest/brand";
import { parseProductList } from "@/lib/ingest/products";
import { IngestResult } from "@/lib/ingest/types";
import { HOMEPAGE_HTML, PRODUCTS_JSON } from "./fixtures";

const STORE_URL = new URL("https://kelpandcotton.com/");

/** The two fixture products plus a dearer one and one with no photograph. */
const EXTRA_PRODUCTS = {
  products: [
    {
      id: 7003,
      title: "Wool Throw",
      handle: "wool-throw",
      body_html: "<p>A heavy throw in undyed wool.</p>",
      product_type: "Home",
      tags: ["wool", "home"],
      variants: [{ id: 41020, title: "Default Title", available: true, price: "215.00" }],
      images: [{ id: 9020, position: 1, src: "https://cdn.shopify.com/s/files/1/0001/throw.jpg", width: 1200, height: 1600 }],
    },
    {
      id: 7004,
      title: "Care Card",
      handle: "care-card",
      body_html: "<p>How to wash wool.</p>",
      product_type: "Home",
      tags: [],
      variants: [{ id: 41030, title: "Default Title", available: true, price: "4.00" }],
      images: [],
    },
  ],
};

export function makeIngest(overrides: Partial<IngestResult> = {}): IngestResult {
  const products = [
    ...parseProductList(JSON.parse(PRODUCTS_JSON), { storeUrl: STORE_URL }),
    ...parseProductList(EXTRA_PRODUCTS, { storeUrl: STORE_URL }),
  ];
  const { brand, reviewPlatform } = extractBrandContext({ html: HOMEPAGE_HTML, storeUrl: STORE_URL });

  return IngestResult.parse({
    store: {
      inputUrl: "kelpandcotton.com",
      storeUrl: STORE_URL.toString(),
      platform: "shopify",
      catalogueSource: "products.json",
      ingestedAt: "2026-08-11T10:00:00.000Z",
    },
    brand,
    catalogue: { currency: "GBP", products, productCount: products.length, truncated: false },
    reviews: {
      available: false,
      platformDetected: reviewPlatform,
      note: "This store uses judge.me, but no review content was ingested. Omit the reviews block.",
    },
    diagnostics: { warnings: [], trace: [] },
    ...overrides,
  });
}

/** Handles in the fixture catalogue, for tests that need one that is not. */
export const FIXTURE_HANDLES = ["oat-crew", "linen-tea-towel", "wool-throw", "care-card"] as const;
