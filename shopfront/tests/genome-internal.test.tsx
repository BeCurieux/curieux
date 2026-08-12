/**
 * "Genome fields are inferences and stay internal — never rendered as claims
 * on the page."
 *
 * That rule is easy to state and easy to break by accident, because the Genome
 * is the most quotable text in the system: `problemSolved` reads like a product
 * blurb and `audience` reads like a headline. Both are somebody's reading of a
 * marketing description, and a shopper meeting one as a claim about their own
 * life is the exact failure the internal/external line exists to prevent.
 *
 * So the line is enforced structurally rather than by discipline: the Genome is
 * not part of `ShopConfig`, and it is not part of what the renderer is handed.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { merchandise } from "@/lib/merchandise/index";
import { buildBrief } from "@/lib/merchandise/prompt";
import { ShopRenderInput } from "@/lib/render/store";
import { Shop } from "@/components/shop/Shop";
import { ShopConfig } from "@/lib/schema";
import type { CatalogueGenome } from "@/lib/genome/types";
import type { Catalogue, IngestResult, IngestedProduct } from "@/lib/ingest/types";
import type { MerchandiseProvider } from "@/lib/merchandise/provider";

/** A phrase that could only have come from the Genome. */
const TELLTALE = "ZZQX-genome-inference-leak";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "A boxy wool crew.",
    tags: [],
    productType: "Knitwear",
    url: "https://kelpandcotton.com/products/oat-crew",
    images: [{ url: "https://cdn/oat.jpg", width: 1600, height: 2000 }],
    variants: [{ id: "1", title: "S", price: 148, available: true, options: ["S"] }],
    price: { min: 148, max: 148 },
    available: true,
    availabilityKnown: true,
    ...over,
  };
}

const PRODUCTS = [product(), product({ handle: "wool-throw", title: "Wool Throw", price: { min: 215, max: 215 } })];

const CATALOGUE: Catalogue = { currency: "GBP", products: PRODUCTS, productCount: 2, truncated: false };

const INGEST = {
  store: { storeUrl: "https://kelpandcotton.com", ingestedAt: "2026-08-01T09:00:00.000Z" },
  brand: {
    name: "Kelp & Cotton",
    storeUrl: "https://kelpandcotton.com",
    links: [],
    socialLinks: [],
    palette: [],
    voice: { headings: [], sentences: [], buttonLabels: [] },
    suggestedColorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
  },
  catalogue: CATALOGUE,
  reviews: { available: false, note: "No review data is ingestable from a public storefront." },
} as unknown as IngestResult;

const GENOME: CatalogueGenome = {
  version: 1,
  storeUrl: "https://kelpandcotton.com",
  generatedAt: "2026-08-01T09:00:00.000Z",
  catalogueRead: `${TELLTALE} catalogue read`,
  products: PRODUCTS.map((p) => ({
    handle: p.handle,
    problemSolved: `${TELLTALE} solves the problem`,
    audience: `${TELLTALE} audience`,
    occasions: [`${TELLTALE}-occasion`],
    role: "hero",
    giftability: "high",
    complements: [],
    substitutes: [],
    confidence: "high",
    priceTier: "core",
    photography: { rating: "strong", imageCount: 1, dimensionsKnown: true, notes: [] },
  })),
  priceBands: { entryBelow: null, coreBelow: null, premiumBelow: null, sampled: 2 },
  diagnostics: {
    provider: "fake",
    model: "fake",
    attempts: 1,
    rejected: [],
    warnings: [],
    enriched: 2,
    catalogueSize: 2,
  },
};

const PLAN = {
  audience: "People arriving from the knitwear video",
  theme: {
    colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
    typography: "editorial-serif",
    mood: "editorial",
    density: "regular",
    cornerRadius: "soft",
  },
  blocks: [
    { id: "hero", block: { type: "hero", headline: "Made to be mended" } },
    {
      id: "grid",
      block: { type: "productGrid", title: "The edit", layout: "grid", products: [{ handle: "oat-crew" }] },
    },
  ],
};

function providerReturning(plan: unknown): MerchandiseProvider {
  return { name: "fake", generate: vi.fn(async () => ({ plan, model: "fake-1" })) };
}

describe("the Genome is internal", () => {
  it("reaches the merchandiser's brief, which is the whole point", () => {
    const brief = buildBrief(INGEST, "a warm gift edit", { catalogue: { genome: GENOME } });
    expect(brief.text).toContain(TELLTALE);
    expect(brief.text).toContain("genome:");
    // And the brief says out loud that it must not be repeated.
    expect(brief.text).toContain("None of it may appear on the page");
  });

  it("is not a field a ShopConfig can carry", async () => {
    const { config, diagnostics } = await merchandise(INGEST, "a warm gift edit", {
      provider: providerReturning(PLAN),
      genome: GENOME,
    });

    expect(diagnostics.genome).toBe(true);
    expect(diagnostics.catalogue.enriched).toBe(2);

    // zod strips anything the schema does not name, so a Genome smuggled onto a
    // config does not survive being parsed as one.
    const reparsed = ShopConfig.parse({ ...config, genome: GENOME });
    expect(JSON.stringify(reparsed)).not.toContain(TELLTALE);
    expect(JSON.stringify(config)).not.toContain(TELLTALE);
  });

  it("is not part of what the renderer is handed", () => {
    const input = ShopRenderInput.parse({
      config: ShopConfig.parse({
        version: 1,
        brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
        theme: PLAN.theme,
        blocks: PLAN.blocks,
        meta: { prompt: "a warm gift edit", generatedAt: "2026-08-01T09:00:00.000Z" },
      }),
      catalogue: CATALOGUE,
      ingestedAt: "2026-08-01T09:00:00.000Z",
      genome: GENOME,
    });

    expect(JSON.stringify(input)).not.toContain(TELLTALE);
    expect("genome" in input).toBe(false);
  });

  it("cannot appear in the markup, because the markup never receives it", () => {
    const config = ShopConfig.parse({
      version: 1,
      brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
      theme: PLAN.theme,
      blocks: PLAN.blocks,
      meta: { prompt: "a warm gift edit", generatedAt: "2026-08-01T09:00:00.000Z" },
    });

    const html = renderToStaticMarkup(<Shop config={config} catalogue={CATALOGUE} />);
    expect(html).not.toContain(TELLTALE);
    // The words the Genome uses for its own fields are not page vocabulary.
    for (const word of ["giftability", "priceTier", "problemSolved", "add-on", "substitutes"]) {
      expect(html, word).not.toContain(word);
    }
  });
});
