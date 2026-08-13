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
    expect(variables["--font-display"]).toContain("--font-brand-display");
    expect(variables["--plate-ratio"]).toBe("4 / 5");
  });

  it("keeps a real device font behind every brand face", () => {
    // The brand faces load with `font-display: swap`, so these tails are what
    // a shopper reads for the first few hundred milliseconds on mobile data.
    // A stack that bottomed out in bare `serif` would hand that moment to
    // whatever Times variant the phone happens to ship.
    for (const typography of ["editorial-serif", "modern-sans", "soft-rounded", "mono-utility"] as const) {
      const { variables } = buildTheme({ ...base, typography });
      for (const key of ["--font-display", "--font-body"]) {
        const stack = variables[key]!;
        expect(stack, `${typography} ${key}`).not.toMatch(/url\(|@import|https?:/);
        expect(stack, `${typography} ${key}`).toMatch(/serif|sans-serif|monospace|ui-rounded/);
        // A named family before the generic — not `var(--font-brand-sans), sans-serif`,
        // which is a webfont with no real fallback wearing one.
        const named = stack.split(",").filter((part) => !/^\s*(var\(|serif|sans-serif|monospace)\s*$/.test(part));
        expect(named.length, `${typography} ${key}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("never asks the browser for a font a shop's theme did not choose", () => {
    // A rounded or mono shop stays on device fonts entirely — the browser only
    // fetches a family something on the page uses, and that is only true while
    // these stacks stay clean.
    for (const typography of ["soft-rounded", "mono-utility"] as const) {
      const { variables } = buildTheme({ ...base, typography });
      expect(variables["--font-display"], typography).not.toContain("--font-brand");
      expect(variables["--font-body"], typography).not.toContain("--font-brand");
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

  it("keeps the soft pill's label readable on the soft pill", () => {
    // The board's look is a pale tint of the accent carrying the accent's own
    // hue in the label. That is only a good idea while it stays legible, and a
    // pale brand colour on a tint of itself is exactly where it stops being.
    for (const accent of ["#2f5d50", "#f4e04d", "#ffd166", "#6b55f6", "#ff6b8a", "#ffffff", "#111111"]) {
      const { variables } = buildTheme({ ...base, colorway: { ...base.colorway, accent } });
      const ratio = contrastRatio(parseColour(variables["--accent-ink"]!)!, parseColour(variables["--accent-soft"]!)!);
      expect(ratio, accent).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the quiet tones readable, however light the palette", () => {
    // --text-faint carries the colophon, the "as of" line and the sold-out
    // chip: all small, and small is where "quiet" turns into "cannot read it".
    // The intended mix measured 2.75:1 on the default palette, which is well
    // under AA — found by the browser suite, guarded here because it is
    // arithmetic and does not need a browser to check.
    const palettes = [
      { background: "#faf8f4", text: "#22201d" },
      { background: "#ffffff", text: "#000000" },
      // A page whose ink is already soft has the least room to give away.
      { background: "#fdfdfd", text: "#5a5a5a" },
      // And a dark page mixes the other way.
      { background: "#141414", text: "#f2f2f2" },
    ];

    for (const { background, text } of palettes) {
      const { variables } = buildTheme({ ...base, colorway: { ...base.colorway, background, text } });
      const bg = parseColour(background)!;
      for (const token of ["--text-soft", "--text-faint"] as const) {
        const ratio = contrastRatio(parseColour(variables[token]!)!, bg);
        expect(ratio, `${token} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("leaves a tone that already reads well exactly where it was asked to be", () => {
    // The readability guard is a floor, not an opinion. --text-soft clears the
    // bar on the default palette at the mix it asked for, and nudging it would
    // quietly flatten the gap between supporting copy and metadata.
    const { variables } = buildTheme(base);
    expect(variables["--text-soft"]).toBe("#676562");
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

  it("separates the moods on structure, not only on type", () => {
    // The failure this exists for is not "two moods are identical" — the test
    // above already catches that — but the subtler one that produced it: five
    // moods that differed only in weight, tracking and hero height, so every
    // shop had the same three-column grid with the same rhythm and the mood
    // token read as a font picker.
    //
    // Structure means the things a shopper sees before they read anything: how
    // many products across, whether the rows are level, whether the headline is
    // on the photograph or under it, whether the plate is square or portrait.
    const moods = ["clean", "editorial", "playful", "luxe", "utility"] as const;
    const shapes = moods.map((mood) => buildTheme({ ...base, mood }).shape);

    const structure = shapes.map((s) =>
      [s.gridColumns, s.gridStagger, s.plateRatio, s.heroCopy, s.cardMeta, s.heroFullBleed].join("|"),
    );
    expect(new Set(structure).size, structure.join("\n")).toBe(moods.length);

    // And each axis has to be doing work on its own. A set of five that is
    // distinct only because one field is a snowflake is the same failure in a
    // better disguise.
    expect(new Set(shapes.map((s) => s.gridColumns)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(shapes.map((s) => s.heroCopy)).size).toBe(2);
    expect(new Set(shapes.map((s) => s.cardMeta)).size).toBe(2);
    expect(new Set(shapes.map((s) => s.gridStagger)).size).toBeGreaterThanOrEqual(4);

    // Level rows are a legal answer, and exactly one mood should want them.
    expect(shapes.filter((s) => s.gridStagger === 0)).toHaveLength(1);
  });

  it("hands the grid numbers CSS can use", () => {
    for (const mood of ["clean", "editorial", "playful", "luxe", "utility"] as const) {
      const { variables, shape } = buildTheme({ ...base, mood });
      // Unitless, because `--grid-columns` goes into `repeat()` and the other
      // two into `calc(... * n)`. A stray "px" here fails silently: the
      // declaration is dropped and the grid falls back to its default.
      expect(variables["--grid-columns"]).toBe(String(shape.gridColumns));
      expect(variables["--grid-stagger"]).toBe(String(shape.gridStagger));
      expect(variables["--grid-gap"]).toBe(String(shape.gridGap));
      for (const name of ["--grid-columns", "--grid-stagger", "--grid-gap"]) {
        expect(Number.isFinite(Number(variables[name])), `${name} is ${variables[name]}`).toBe(true);
      }
    }
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
