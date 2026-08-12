/**
 * The Genome pass end to end, and the rule that governs it: none of this is
 * ever allowed onto a page.
 */

import { describe, expect, it, vi } from "vitest";
import { enrichCatalogue, GenomeError, validateGenome } from "@/lib/genome/index";
import { staleFor } from "@/lib/genome/store";
import { readCatalogue } from "@/lib/genome/mock";
import type { GenomeProvider } from "@/lib/genome/provider";
import type { GenomeInference } from "@/lib/genome/inference";
import type { Catalogue, IngestResult, IngestedProduct } from "@/lib/ingest/types";

function product(over: Partial<IngestedProduct> = {}): IngestedProduct {
  return {
    handle: "oat-crew",
    title: "Oat Crew",
    description: "A boxy wool crew in undyed oat, knitted in Porto.",
    tags: ["wool", "knitwear"],
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

const PRODUCTS = [
  product(),
  product({
    handle: "wool-throw",
    title: "Wool Throw",
    productType: "Home",
    tags: ["wool", "home"],
    price: { min: 215, max: 215 },
  }),
  product({
    handle: "linen-tea-towel",
    title: "Linen Tea Towel",
    productType: "Home",
    tags: ["linen", "home"],
    price: { min: 18.5, max: 18.5 },
  }),
  product({
    handle: "sage-cardigan",
    title: "Sage Cardigan",
    productType: "Knitwear",
    tags: ["wool", "knitwear"],
    price: { min: 168, max: 168 },
  }),
];

const CATALOGUE: Catalogue = {
  currency: "GBP",
  products: PRODUCTS,
  productCount: PRODUCTS.length,
  truncated: false,
};

const INGEST = {
  store: { storeUrl: "https://kelpandcotton.com", ingestedAt: "2026-08-01T09:00:00.000Z" },
  brand: { name: "Kelp & Cotton", storeUrl: "https://kelpandcotton.com" },
  catalogue: CATALOGUE,
} as unknown as IngestResult;

function inferenceFor(over: Partial<GenomeInference["products"][number]>[] = []): GenomeInference {
  return {
    catalogueRead: "Small-run knitwear and homewares in wool and linen.",
    products: PRODUCTS.map((p, index) => ({
      handle: p.handle,
      problemSolved: "Keeps a room warm without a radiator.",
      audience: "Someone furnishing a first proper home.",
      occasions: [],
      role: index === 0 ? ("hero" as const) : ("supporting" as const),
      giftability: "medium" as const,
      complements: [],
      substitutes: [],
      confidence: "high" as const,
      ...(over[index] ?? {}),
    })),
  };
}

function providerReturning(...responses: unknown[]): GenomeProvider {
  let call = 0;
  return {
    name: "fake",
    read: vi.fn(async () => ({ inference: responses[Math.min(call++, responses.length - 1)], model: "fake-1" })),
  };
}

describe("enrichCatalogue", () => {
  it("merges the computed fields in rather than asking the model for them", async () => {
    const genome = await enrichCatalogue(INGEST, { provider: providerReturning(inferenceFor()) });

    const crew = genome.products.find((p) => p.handle === "oat-crew")!;
    expect(crew.priceTier).toBeDefined();
    expect(crew.photography.rating).toBe("adequate");
    expect(crew.photography.imageCount).toBe(1);

    // The tier came from the catalogue's own distribution, not from the model.
    expect(genome.priceBands.sampled).toBe(4);
    const towel = genome.products.find((p) => p.handle === "linen-tea-towel")!;
    expect(towel.priceTier).toBe("entry");
  });

  it("retries with the errors rather than storing a broken relationship graph", async () => {
    const broken = inferenceFor([{ complements: ["a-product-that-does-not-exist"] }]);
    const provider = providerReturning(broken, inferenceFor());

    const genome = await enrichCatalogue(INGEST, { provider });
    expect(genome.diagnostics.attempts).toBe(2);
    expect(genome.diagnostics.rejected[0]!.join(" ")).toContain("a-product-that-does-not-exist");
  });

  it("throws rather than storing half a read", async () => {
    // A Genome feeds every shop the store ever generates, so a partial one is
    // not a bad page — it is a bad page every time, invisibly.
    const provider = providerReturning({ catalogueRead: "x", products: [] });
    await expect(enrichCatalogue(INGEST, { provider, maxAttempts: 2 })).rejects.toBeInstanceOf(GenomeError);
  });

  it("refuses an empty catalogue instead of enriching nothing", async () => {
    const empty = { ...INGEST, catalogue: { ...CATALOGUE, products: [], productCount: 0 } };
    await expect(enrichCatalogue(empty, { provider: providerReturning(inferenceFor()) })).rejects.toMatchObject({
      code: "empty-catalogue",
    });
  });
});

describe("validation", () => {
  const offered = PRODUCTS.map((p) => p.handle);

  it("rejects a product that is its own complement", () => {
    const { errors } = validateGenome({
      inference: inferenceFor([{ complements: ["oat-crew"] }]),
      catalogue: CATALOGUE,
      offered,
    });
    expect(errors.join(" ")).toContain("lists itself");
  });

  it("rejects a handle that is both used-with and chosen-instead-of", () => {
    // Opposite claims. Both at once means the relationship was never decided,
    // and the merchandiser would read a coin flip as a fact.
    const { errors } = validateGenome({
      inference: inferenceFor([{ complements: ["wool-throw"], substitutes: ["wool-throw"] }]),
      catalogue: CATALOGUE,
      offered,
    });
    expect(errors.join(" ")).toContain("both a complement and a substitute");
  });

  it("rejects a missing product rather than quietly covering three of four", () => {
    const partial = inferenceFor();
    partial.products = partial.products.slice(0, 2);
    const { errors } = validateGenome({ inference: partial, catalogue: CATALOGUE, offered });
    expect(errors.join(" ")).toContain("Missing entries for 2");
  });

  it("keeps prices out of an analysis that outlives them", () => {
    const { errors } = validateGenome({
      inference: inferenceFor([{ problemSolved: "The £148 jumper that replaces three cheaper ones." }]),
      catalogue: CATALOGUE,
      offered,
    });
    expect(errors.join(" ")).toContain("currency amount");
  });

  it("keeps sync and review claims out too, because this feeds the page's copy", () => {
    const synced = validateGenome({
      inference: inferenceFor([{ audience: "Shoppers who want a real-time view of stock." }]),
      catalogue: CATALOGUE,
      offered,
    });
    expect(synced.errors.join(" ")).toContain("syncs with the store");

    const reviewed = validateGenome({
      inference: inferenceFor([{ problemSolved: "Rated 4.8 stars by buyers." }]),
      catalogue: CATALOGUE,
      offered,
    });
    expect(reviewed.errors.join(" ")).toContain("review or rating");
  });

  it("warns when the role field has stopped discriminating", () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      product({ handle: `p${i}`, price: { min: 10 + i, max: 10 + i } }),
    );
    const catalogue: Catalogue = { currency: "GBP", products, productCount: 10, truncated: false };
    const inference: GenomeInference = {
      catalogueRead: "x",
      products: products.map((p) => ({
        handle: p.handle,
        problemSolved: "A thing.",
        audience: "A person.",
        occasions: [],
        role: "hero" as const,
        giftability: "low" as const,
        complements: [],
        substitutes: [],
        confidence: "high" as const,
      })),
    };

    const { errors, warnings } = validateGenome({
      inference,
      catalogue,
      offered: products.map((p) => p.handle),
    });
    // Not an error: a genuine catalogue of ten strong products exists.
    expect(errors).toHaveLength(0);
    expect(warnings.join(" ")).toContain("not discriminating");
  });
});

describe("the deterministic read", () => {
  it("always produces something the validator accepts", () => {
    const inference = readCatalogue(PRODUCTS);
    const { errors } = validateGenome({
      inference,
      catalogue: CATALOGUE,
      offered: PRODUCTS.map((p) => p.handle),
    });
    expect(errors).toEqual([]);
  });

  it("says plainly that it did not infer an audience", () => {
    // The baseline exists to be beaten. Dressing up what a heuristic knows
    // would make it flattering instead.
    const inference = readCatalogue(PRODUCTS);
    expect(inference.products[0]!.audience).toContain("Not inferred");
    expect(inference.products.every((p) => p.confidence !== "high")).toBe(true);
  });

  it("finds substitutes within a type and complements across types", () => {
    const inference = readCatalogue(PRODUCTS);
    const crew = inference.products.find((p) => p.handle === "oat-crew")!;
    expect(crew.substitutes).toContain("sage-cardigan");
    expect(crew.complements).toContain("wool-throw");
    expect(crew.complements).not.toContain("sage-cardigan");
  });
});

describe("staleness", () => {
  it("reports what a Genome no longer covers instead of being thrown away whole", async () => {
    const genome = await enrichCatalogue(INGEST, { provider: providerReturning(inferenceFor()) });

    const grown: Catalogue = {
      ...CATALOGUE,
      products: [...PRODUCTS, product({ handle: "ribbed-socks", title: "Ribbed Socks" })],
      productCount: 5,
    };

    const stale = staleFor(genome, grown);
    expect(stale.complete).toBe(false);
    expect(stale.missing).toEqual(["ribbed-socks"]);
    expect(stale.departed).toEqual([]);
  });
});
