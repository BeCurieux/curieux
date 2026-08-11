import { describe, expect, it } from "vitest";
import {
  collectColours,
  contrastRatio,
  luminance,
  parseColour,
  saturation,
  suggestColorway,
  toHex,
} from "@/lib/ingest/colour";

describe("parseColour", () => {
  it("reads the notations that appear in theme CSS", () => {
    expect(parseColour("#2f5d50")).toEqual({ r: 47, g: 93, b: 80 });
    expect(parseColour("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColour("rgb(191, 87, 62)")).toEqual({ r: 191, g: 87, b: 62 });
    expect(parseColour("rgba(0, 0, 0, 0.5)")).toEqual({ r: 0, g: 0, b: 0 });
    expect(toHex(parseColour("hsl(36, 12%, 45%)")!)).toBe("#817665");
    expect(parseColour("white")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("reads Shopify's bare-triplet custom properties", () => {
    // `--color-background: 250 248 244` is composed into rgb() at use site.
    // Without this the richest colour source on a modern theme reads as noise.
    expect(parseColour("250 248 244")).toEqual({ r: 250, g: 248, b: 244 });
  });

  it("returns null for what is not a colour", () => {
    for (const input of ["", "inherit", "var(--x)", "12px", "transparent", "url(a.png)"]) {
      expect(parseColour(input)).toBeNull();
    }
  });
});

describe("luminance, saturation and contrast", () => {
  it("agrees with the WCAG reference points", () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 2);
  });

  it("separates greys from brand colours", () => {
    expect(saturation({ r: 128, g: 128, b: 128 })).toBe(0);
    expect(saturation({ r: 47, g: 93, b: 80 })).toBeGreaterThan(0.3);
  });
});

describe("collectColours", () => {
  it("weights the theme's declared custom properties above loose literals", () => {
    const colours = collectColours([
      `:root { --color-accent: #2f5d50; } .a { color: #123456; } .b { color: #123456; }`,
    ]);
    expect(colours[0]!.hex).toBe("#2f5d50");
    expect(colours.map((c) => c.hex)).toContain("#123456");
  });

  it("ignores CSS that declares no colours", () => {
    expect(collectColours([".a { margin: 0 }", ""])).toEqual([]);
  });
});

describe("suggestColorway", () => {
  it("builds a legible colourway from a brand's own palette", () => {
    const colours = collectColours([
      `:root {
        --color-background: 250 248 244;
        --color-text: #22201d;
        --color-accent: #2f5d50;
      }`,
    ]);
    const colorway = suggestColorway(colours, "#2f5d50");
    expect(colorway.background).toBe("#faf8f4");
    expect(colorway.text).toBe("#22201d");
    expect(colorway.accent).toBe("#2f5d50");
    expect(colorway.surface).not.toBe(colorway.background);
  });

  it("guarantees readable body text even when the brand's own greys are not", () => {
    // A shop nobody can read is worse than a shop that ignored the brand grey.
    const colours = collectColours([`:root { --color-background: #ffffff; --color-text: #f0f0f0; }`]);
    const colorway = suggestColorway(colours);
    const ratio = contrastRatio(parseColour(colorway.text)!, parseColour(colorway.background)!);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("handles a dark storefront by flipping the text, not the background", () => {
    const colours = collectColours([`:root { --color-background: #101010; --color-accent: #e8c07d; }`]);
    const colorway = suggestColorway(colours);
    expect(colorway.background).toBe("#101010");
    expect(contrastRatio(parseColour(colorway.text)!, parseColour(colorway.background)!)).toBeGreaterThanOrEqual(4.5);
    expect(luminance(parseColour(colorway.surface)!)).toBeGreaterThan(luminance(parseColour(colorway.background)!));
  });

  it("falls back to a neutral scheme when a store yields no colours at all", () => {
    const colorway = suggestColorway([]);
    expect(colorway.background).toBe("#ffffff");
    expect(contrastRatio(parseColour(colorway.text)!, parseColour(colorway.background)!)).toBeGreaterThanOrEqual(4.5);
  });
});
