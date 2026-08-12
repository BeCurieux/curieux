/**
 * `schema.ts` is the single contract between the merchandiser and the renderer,
 * and its length caps are the part with no runtime enforcement anywhere else.
 *
 * The failure they guard against is specific and nasty: `ShopConfig.parse` runs
 * on the very last line of generation, so a field that overflows throws *after*
 * the model call has been paid for — and it only ever overflows on a real
 * store, which is the one thing the fixtures cannot cover. Both bugs below were
 * found this way rather than in production, which is the only reason they are
 * cheap.
 */

import { describe, expect, it } from "vitest";
import { extractBrandContext } from "@/lib/ingest/brand";
import { assembleShopConfig } from "@/lib/merchandise/assemble";
import { ShopConfig } from "@/lib/schema";
import type { IngestResult } from "@/lib/ingest/types";
import type { MerchandisingPlan } from "@/lib/merchandise/plan";

const PLAN: MerchandisingPlan = {
  audience: "People arriving from the knitwear video",
  theme: {
    colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
    typography: "editorial-serif",
    mood: "editorial",
    density: "regular",
    cornerRadius: "soft",
  },
  blocks: [{ id: "hero", block: { type: "hero", headline: "Made to be mended" } }],
};

function ingestWith(brand: { name: string; tagline?: string }): IngestResult {
  return {
    store: { storeUrl: "https://example.com", ingestedAt: "2026-08-01T09:00:00.000Z" },
    brand: { ...brand, storeUrl: "https://example.com" },
    catalogue: { currency: "GBP", products: [], productCount: 0, truncated: false },
  } as unknown as IngestResult;
}

describe("ingested brand text against the contract's caps", () => {
  it("shortens a name that would fail the schema, and says it did", () => {
    // 119 characters, which is what an unstripped templated title looks like.
    const long = "Longbrand ".repeat(12).trim();
    const { config, warnings } = assembleShopConfig({
      plan: PLAN,
      ingest: ingestWith({ name: long }),
      prompt: "a shop",
      now: new Date("2026-08-01T09:00:00.000Z"),
    });

    expect(config.brand.name.length).toBeLessThanOrEqual(60);
    // Never quietly — a merchant reads their own name first.
    expect(warnings.join(" ")).toContain("brand name");
    expect(warnings.join(" ")).toContain("119 characters");
  });

  it("shortens an over-long tagline the same way", () => {
    const { config, warnings } = assembleShopConfig({
      plan: PLAN,
      ingest: ingestWith({ name: "Kelp & Cotton", tagline: "T".repeat(140) }),
      prompt: "a shop",
      now: new Date("2026-08-01T09:00:00.000Z"),
    });

    expect(config.brand.tagline!.length).toBeLessThanOrEqual(100);
    expect(warnings.join(" ")).toContain("tagline");
  });

  it("leaves text that already fits completely alone", () => {
    const { config, warnings } = assembleShopConfig({
      plan: PLAN,
      ingest: ingestWith({ name: "Kelp & Cotton", tagline: "Slow basics for a warm house" }),
      prompt: "a shop",
      now: new Date("2026-08-01T09:00:00.000Z"),
    });

    expect(config.brand.name).toBe("Kelp & Cotton");
    expect(config.brand.tagline).toBe("Slow basics for a warm house");
    expect(warnings).toEqual([]);
  });
});

describe("the ingester's own output fits the contract", () => {
  it("never returns a tagline one character over the cap", () => {
    // `.{10,100}[.!?]` matches 101 characters. The terminator counts, and the
    // contract says 100 — an off-by-one that only a real meta description with
    // a 101-character opening sentence would ever have surfaced.
    const sentence = `${"A".repeat(100)}.`;
    const html = `<html><head><title>Store</title>
      <meta property="og:site_name" content="Store">
      <meta name="description" content="${sentence} And more."></head><body></body></html>`;

    const { brand } = extractBrandContext({ html, storeUrl: new URL("https://example.com/") });
    expect(brand.tagline!.length).toBeLessThanOrEqual(100);
  });

  it("holds at every length around the boundary", () => {
    for (let length = 95; length <= 105; length++) {
      const sentence = `${"A".repeat(length)}.`;
      const html = `<html><head><title>Store</title>
        <meta property="og:site_name" content="Store">
        <meta name="description" content="${sentence} And more."></head><body></body></html>`;

      const { brand } = extractBrandContext({ html, storeUrl: new URL("https://example.com/") });
      expect(brand.tagline?.length ?? 0, `sentence of ${length}`).toBeLessThanOrEqual(100);
    }
  });
});

describe("the contract itself", () => {
  it("still holds the eight block types the renderer switches on", () => {
    // A block type added here without a renderer arm is a page that throws on
    // one merchant's shop and nobody else's.
    const options = ShopConfig.shape.blocks.element.shape.block.options.map(
      (option) => option.shape.type.value as string,
    );
    expect(options.sort()).toEqual(
      ["capture", "drop", "hero", "linkList", "offer", "productGrid", "reviews", "routine"].sort(),
    );
  });

  it("carries the provenance step 6 needs, and no more", () => {
    // prompt + stated audience + the decisions are already here; what a shop
    // *version* is belongs to the publish layer, not to what the AI produces.
    expect(Object.keys(ShopConfig.shape.meta.shape).sort()).toEqual(
      ["audience", "generatedAt", "prompt"].sort(),
    );
  });
});
