import { describe, expect, it } from "vitest";
import { buildTheme } from "@/lib/render/theme";
import { contrastRatio, parseColour } from "@/lib/ingest/colour";
import type { z } from "zod";
import type { ThemeTokens as ThemeTokensSchema } from "@/lib/schema";

type Tokens = z.infer<typeof ThemeTokensSchema>;

const base: Tokens = {
  colorway: { background: "#faf8f4", surface: "#f0ebe1", text: "#22201d", accent: "#2f5d50" },
  typography: "editorial-serif",
  mood: "editorial",
  density: "regular",
  cornerRadius: "soft",
};

describe("buildTheme", () => {
  it("turns five tokens into the variables the stylesheet reads", () => {
    const { variables } = buildTheme(base);
    expect(variables["--bg"]).toBe("#faf8f4");
    expect(variables["--accent"]).toBe("#2f5d50");
    expect(variables["--font-display"]).toContain("Hoefler Text");
    expect(variables["--plate-ratio"]).toBe("4 / 5");
  });

  it("names no webfont, because a bio-link shop has one round trip to spend", () => {
    for (const typography of ["editorial-serif", "modern-sans", "soft-rounded", "mono-utility"] as const) {
      const { variables } = buildTheme({ ...base, typography });
      expect(variables["--font-display"], typography).not.toMatch(/url\(|@import/);
      expect(variables["--font-body"], typography).toMatch(/serif|sans-serif|monospace|ui-rounded/);
    }
  });

  it("picks a label colour a reader can actually see on the accent", () => {
    // --on-accent lands on buttons. Black on a dark green button is the kind
    // of thing that only shows up on one merchant's brand colour.
    for (const accent of ["#2f5d50", "#f4e04d", "#111111", "#ffffff", "#b4472f"]) {
      const { variables } = buildTheme({ ...base, colorway: { ...base.colorway, accent } });
      const ratio = contrastRatio(parseColour(variables["--on-accent"]!)!, parseColour(accent)!);
      expect(ratio, accent).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives its supporting tones from the brand's own two colours", () => {
    const { variables } = buildTheme(base);
    // Soft, faint and line are mixes towards the background, so they read as
    // one family rather than as a second, unrelated grey.
    for (const key of ["--text-soft", "--text-faint", "--line", "--line-strong"]) {
      const tone = parseColour(variables[key]!)!;
      const text = parseColour(base.colorway.text)!;
      const bg = parseColour(base.colorway.background)!;
      expect(tone.r, key).toBeGreaterThanOrEqual(Math.min(text.r, bg.r) - 1);
      expect(tone.r, key).toBeLessThanOrEqual(Math.max(text.r, bg.r) + 1);
    }
  });

  it("knows when the page is lit the other way up", () => {
    expect(buildTheme(base).dark).toBe(false);
    expect(buildTheme({ ...base, colorway: { ...base.colorway, background: "#101010", text: "#f4f4f4" } }).dark).toBe(true);
  });

  it("makes mood mean something rather than nudging a radius", () => {
    const shapes = (["clean", "editorial", "playful", "luxe", "utility"] as const).map(
      (mood) => buildTheme({ ...base, mood }).shape,
    );
    // If two moods produce the same shape, one of them was decoration.
    const fingerprints = shapes.map((s) => JSON.stringify(s));
    expect(new Set(fingerprints).size).toBe(5);
    expect(new Set(shapes.map((s) => s.plateRatio)).size).toBeGreaterThan(1);
    expect(new Set(shapes.map((s) => s.heroFullBleed)).size).toBe(2);
  });

  it("scales the whole spacing system from density", () => {
    const airy = buildTheme({ ...base, density: "airy" }).variables;
    const compact = buildTheme({ ...base, density: "compact" }).variables;
    expect(px(airy["--space-6"]!)).toBeGreaterThan(px(compact["--space-6"]!));
    expect(px(airy["--gutter"]!)).toBeGreaterThan(px(compact["--gutter"]!));
  });

  it("degrades to a plain page rather than a blank one on an unusable colour", () => {
    // The validator rejects these at generation time; a stored config from an
    // older schema should still render.
    const { variables } = buildTheme({ ...base, colorway: { ...base.colorway, background: "not a colour" } });
    expect(variables["--bg"]).toBe("#ffffff");
  });
});

function px(value: string): number {
  return Number.parseFloat(value);
}
