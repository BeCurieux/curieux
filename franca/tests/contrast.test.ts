/**
 * Contrast, as a test rather than as a habit.
 *
 * The palette moved four times in an hour — warm paper to night, then market
 * hues, then pink — and one of those passes shipped a 9px label at 3.82:1
 * because it looked right. It was caught by measuring, and measuring is not
 * something anyone reliably remembers to do while choosing a colour they like.
 *
 * So the ratios live here. Every value that carries text is asserted against
 * the ground it actually renders on, at the threshold its size earns:
 * 4.5:1 for body and label text, 3:1 for the large display numeral. A future
 * palette change that looks lovely and cannot be read fails CI.
 *
 * These are WCAG 2 relative-luminance ratios, computed rather than imported,
 * because a design system with one dependency for this is a design system that
 * stops checking when the dependency is awkward to install.
 */

import { describe, expect, it } from "vitest";
import {
  BADGE_NIGHT_PALETTE,
  BADGE_PALETTE,
  MARKET_ACCENT,
  PALETTE,
} from "@/card/tokens.js";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(Number.parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG 2 contrast ratio between two opaque colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = [Math.max(x, y), Math.min(x, y)];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe("everything that carries text can be read on its own ground", () => {
  const onPage: [string, string][] = [
    ["ink", PALETTE.ink],
    ["inkSoft", PALETTE.inkSoft],
    // Carries the 9px mono labels — the dates and market names. This is the
    // one that failed, at 3.82:1, and it is the reason this file exists.
    ["inkFaint", PALETTE.inkFaint],
    ["accent", PALETTE.accent],
  ];

  for (const [name, colour] of onPage) {
    it(`${name} clears AA on the page`, () => {
      expect(contrast(colour, PALETTE.paper)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  for (const [market, colour] of Object.entries(MARKET_ACCENT)) {
    it(`the ${market} hue clears AA on the page`, () => {
      expect(contrast(colour, PALETTE.paper)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it("keeps the copy readable through the wash behind a flagged phrase", () => {
    // The mark is a filled block, not a highlighter stripe, so the brand's own
    // words sit on top of it. Illegible here means the one thing the card is
    // for — showing somebody their own sentence — stops working.
    expect(contrast(PALETTE.ink, PALETTE.accentWash)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("each badge is measured against its own ground, not the page's", () => {
  // The two marks land on different surfaces and cannot share a threshold.
  // The night badge took the page's pink; the paper badge did not, because the
  // same pink measures 2.72:1 on near-white. This asserts the consequence
  // rather than the intention.
  for (const [ground, palette] of [
    ["paper", BADGE_PALETTE],
    ["night", BADGE_NIGHT_PALETTE],
  ] as const) {
    it(`${ground}: ink, soft ink and accent all clear AA`, () => {
      expect(contrast(palette.ink, palette.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(palette.inkSoft, palette.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(palette.accent, palette.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${ground}: the faint ink on the date line clears large-text AA`, () => {
      expect(contrast(palette.inkFaint, palette.paperRaised)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  }

  it("does not let the paper mark inherit a pink it cannot carry", () => {
    // Guards the specific mistake: making the two marks match by giving the
    // paper one the page accent, which renders at 2.72:1 and vanishes.
    expect(contrast(PALETTE.accent, BADGE_PALETTE.paperRaised)).toBeLessThan(AA_TEXT);
    expect(BADGE_PALETTE.accent).not.toBe(PALETTE.accent);
  });
});
