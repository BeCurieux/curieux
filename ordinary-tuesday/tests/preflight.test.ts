// Preflight guards the three Prodigi rules that most often ruin a run:
// self-added bleed, odd extent, and content in the safe area or the gutter.

import { describe, expect, it } from "vitest";
import { effectiveDpi, runPreflight, type PlacedImage, type PreflightInput } from "@/lib/pdf/preflight";
import { FORMAT, imageTier, maxPrintWidthMm } from "@/lib/book/format";
import { colourForAge } from "@/lib/book/colours";

const goodImage = (id = "a1"): PlacedImage => ({
  assetId: id,
  pixelWidth: 3000,
  pixelHeight: 4000,
  placedWidthMm: 210,
  placedHeightMm: 280,
  tier: "hero",
});

const base = (over: Partial<PreflightInput> = {}): PreflightInput => ({
  interiorPages: 80,
  pageWidthMm: FORMAT.trimWidthMm,
  pageHeightMm: FORMAT.trimHeightMm,
  bleedAdded: false,
  cropMarksAdded: false,
  images: [goodImage()],
  fontsEmbedded: true,
  colourSpace: "RGB",
  transparencyFlattened: true,
  overflowPages: [],
  safeAreaViolations: [],
  spreadPages: [],
  blankPages: [],
  uncitedBlocks: 0,
  ...over,
});

describe("physical format", () => {
  it("passes a correctly built book", () => {
    expect(runPreflight(base()).passed).toBe(true);
  });

  it("rejects pages that are not exactly A4 trim", () => {
    const r = runPreflight(base({ pageWidthMm: 216 }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "wrong_dimensions")).toBe(true);
  });

  it("rejects artwork that adds its own bleed", () => {
    // Prodigi generates bleed itself; ours would mis-trim every page.
    const r = runPreflight(base({ bleedAdded: true }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "bleed_added")).toBe(true);
  });

  it("rejects crop marks", () => {
    expect(runPreflight(base({ cropMarksAdded: true })).passed).toBe(false);
  });

  it("rejects an odd interior extent", () => {
    const r = runPreflight(base({ interiorPages: 79 }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "page_count_odd")).toBe(true);
  });

  it("warns when a volume drifts far from the house extent", () => {
    const r = runPreflight(base({ interiorPages: 40 }));
    expect(r.passed).toBe(true);
    expect(r.issues.some((i) => i.code === "extent_drift")).toBe(true);
  });
});

describe("imagery", () => {
  it("computes effective dpi from the printed placement", () => {
    expect(Math.round(effectiveDpi(goodImage()))).toBe(363);
  });

  it("rejects an image claiming a tier its pixels cannot carry", () => {
    const r = runPreflight(base({
      images: [{ ...goodImage(), pixelWidth: 600, pixelHeight: 800 }],
    }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "resolution_below_tier")).toBe(true);
  });

  it("accepts the same weak image placed small instead", () => {
    const r = runPreflight(base({
      images: [{
        assetId: "weak", pixelWidth: 600, pixelHeight: 800,
        placedWidthMm: 70, placedHeightMm: 93, tier: "intimate",
      }],
    }));
    expect(r.passed).toBe(true);
  });

  it("rejects missing assets", () => {
    expect(runPreflight(base({ images: [{ ...goodImage(), missing: true }] })).passed).toBe(false);
  });
});

describe("tiering imperfect source material", () => {
  it("grades a good camera photo as hero", () => {
    expect(imageTier(4000, 3000)).toBe("hero");
  });

  it("grades a modest phone photo below hero", () => {
    expect(["editorial", "intimate"]).toContain(imageTier(1200, 900));
  });

  it("refuses to print a tiny screenshot at any size", () => {
    expect(imageTier(320, 240)).toBe("unprintable");
  });

  it("knows how wide a given image may honestly print", () => {
    expect(maxPrintWidthMm(2480, "hero")).toBeCloseTo(210, 0);
  });
});

describe("layout and editorial integrity", () => {
  it("rejects overflow, safe-area breaches and blanks", () => {
    expect(runPreflight(base({ overflowPages: [4] })).passed).toBe(false);
    expect(runPreflight(base({ safeAreaViolations: [7] })).passed).toBe(false);
    expect(runPreflight(base({ blankPages: [9] })).passed).toBe(false);
  });

  it("rejects any page designed across the spine", () => {
    const r = runPreflight(base({ spreadPages: [12] }));
    expect(r.passed).toBe(false);
    expect(r.issues.find((i) => i.code === "designed_spread")?.message).toMatch(/gutter/);
  });

  it("rejects generated copy with no supporting memory", () => {
    const r = runPreflight(base({ uncitedBlocks: 2 }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "missing_provenance")).toBe(true);
  });

  it("rejects unembedded fonts and the wrong colour space", () => {
    expect(runPreflight(base({ fontsEmbedded: false })).passed).toBe(false);
    expect(runPreflight(base({ colourSpace: "CMYK" })).passed).toBe(false);
    expect(runPreflight(base({ transparencyFlattened: false })).passed).toBe(false);
  });
});

describe("cover", () => {
  const cover = (over = {}) => ({
    colour: colourForAge(2),
    spineWidthMm: 12.8,
    spineAuthoritative: true,
    ...over,
  });

  it("passes an authoritative spine", () => {
    expect(runPreflight(base({ cover: cover() })).passed).toBe(true);
  });

  it("refuses to print a cover built on an estimated spine", () => {
    // Spine width belongs to the provider; guessing it puts the type
    // off-centre on every copy of the run.
    const r = runPreflight(base({ cover: cover({ spineAuthoritative: false }) }));
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "spine_not_authoritative")).toBe(true);
  });

  it("rejects a nonsensical spine width", () => {
    expect(runPreflight(base({ cover: cover({ spineWidthMm: 0 }) })).passed).toBe(false);
  });
});
