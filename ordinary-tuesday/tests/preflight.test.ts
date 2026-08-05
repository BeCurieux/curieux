import { describe, expect, it } from "vitest";
import { effectiveDpi, runPreflight, type PlacedImage } from "@/lib/pdf/preflight";
import { pageGeometry } from "@/lib/pdf/html";
import { BOOK_SPEC } from "@/lib/book/structure";

const goodImage = (id = "a1"): PlacedImage => ({
  assetId: id,
  pixelWidth: 4000,
  pixelHeight: 3000,
  placedWidthInches: 8,
  placedHeightInches: 6,
});

const base = { pageCount: 48, images: [goodImage()], fontsEmbedded: true, overflowPages: [] };

describe("preflight (§18)", () => {
  it("passes a valid book", () => {
    const result = runPreflight(base);
    expect(result.passed).toBe(true);
  });

  it("computes effective dpi from placement", () => {
    expect(effectiveDpi(goodImage())).toBe(500);
  });

  it("rejects images below the minimum effective dpi", () => {
    const lowRes: PlacedImage = {
      assetId: "low",
      pixelWidth: 800,
      pixelHeight: 600,
      placedWidthInches: 8,
      placedHeightInches: 6,
    };
    const result = runPreflight({ ...base, images: [lowRes] });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "dpi_too_low")).toBe(true);
  });

  it("warns (but passes) between minimum and target dpi", () => {
    const midRes: PlacedImage = {
      assetId: "mid",
      pixelWidth: 1600,
      pixelHeight: 1200,
      placedWidthInches: 8,
      placedHeightInches: 6,
    };
    const result = runPreflight({ ...base, images: [midRes] });
    expect(result.passed).toBe(true);
    expect(result.issues.some((i) => i.code === "dpi_below_target")).toBe(true);
  });

  it("rejects missing assets", () => {
    const result = runPreflight({ ...base, images: [{ ...goodImage(), missing: true }] });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "asset_missing")).toBe(true);
  });

  it("rejects page counts outside the product spec", () => {
    expect(runPreflight({ ...base, pageCount: 20 }).passed).toBe(false);
    expect(runPreflight({ ...base, pageCount: 200 }).passed).toBe(false);
  });

  it("rejects odd page counts", () => {
    const result = runPreflight({ ...base, pageCount: 49 });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "page_count_odd")).toBe(true);
  });

  it("rejects unembedded fonts and overflow", () => {
    expect(runPreflight({ ...base, fontsEmbedded: false }).passed).toBe(false);
    expect(runPreflight({ ...base, overflowPages: [3] }).passed).toBe(false);
  });

  it("applies provider-specific page limits", () => {
    const result = runPreflight({
      ...base,
      pageCount: 48,
      provider: { minPages: 50, maxPages: 240, requiresEvenPages: true },
    });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "provider_page_count")).toBe(true);
  });
});

describe("print geometry (§17/§18)", () => {
  it("print target adds bleed on every side", () => {
    const print = pageGeometry("print");
    expect(print.width).toBeCloseTo(BOOK_SPEC.trimWidthInches + 2 * BOOK_SPEC.bleedInches);
    expect(print.height).toBeCloseTo(BOOK_SPEC.trimHeightInches + 2 * BOOK_SPEC.bleedInches);
  });

  it("digital target has no bleed", () => {
    const digital = pageGeometry("digital");
    expect(digital.width).toBeCloseTo(BOOK_SPEC.trimWidthInches);
    expect(digital.bleed).toBe(0);
  });
});
