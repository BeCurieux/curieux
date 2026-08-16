/**
 * The cards.
 *
 * Not a pixel comparison — these assert the things that must be on the card
 * whatever the layout does, because the share card is the screen most likely to
 * be seen by somebody who did not take the photograph and cannot ask what the
 * missing part said.
 */

import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/fixtures";
import { PROFILES } from "@/lib/profile";
import { verdictFor } from "@/lib/verdict/score";
import { shareCard, verdictScreen } from "@/lib/render/card";
import { escapeXml, measure, wrap } from "@/lib/render/text";

const CARDS = [
  { name: "screen", render: verdictScreen, height: 1920 },
  { name: "share", render: shareCard, height: 1350 },
];

const CASES = Object.entries(FIXTURES).flatMap(([labelName, label]) =>
  Object.entries(PROFILES).map(([profileName, profile]) => ({
    what: `${labelName} / ${profileName}`,
    verdict: verdictFor(label, profile),
  })),
);

describe("every card, for every label and profile", () => {
  for (const card of CARDS) {
    it(`${card.name}: is well-formed SVG at its declared size`, () => {
      for (const { what, verdict } of CASES) {
        const svg = card.render(verdict);
        expect(svg, what).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(svg, what).toContain(`height="${card.height}"`);
        expect(svg.endsWith("</svg>"), what).toBe(true);
        // Unbalanced tags mean a rasteriser renders a blank card, and a blank
        // card is indistinguishable from a card nobody looked at.
        expect((svg.match(/<text /g) ?? []).length).toBe((svg.match(/<\/text>/g) ?? []).length);
      }
    });

    it(`${card.name}: never prints a score it does not have`, () => {
      for (const { what, verdict } of CASES) {
        const svg = card.render(verdict);
        if (verdict.score === null) {
          expect(svg, what).toContain("NO SCORE");
          expect(svg, what).not.toContain("/100");
        } else {
          expect(svg, what).toContain("/100");
        }
      }
    });

    it(`${card.name}: shows the incomplete banner whenever there is one`, () => {
      for (const { what, verdict } of CASES) {
        if (!verdict.incomplete) continue;
        expect(card.render(verdict), what).toMatch(/could not be read|hard to read/);
      }
    });

    it(`${card.name}: names the profile the verdict was computed for`, () => {
      // §5's whole argument: a generic score means nothing. A card with a
      // number and no profile beside it is the thing this product replaces.
      for (const { what, verdict } of CASES) {
        expect(card.render(verdict), what).toContain(escapeXml(verdict.profileLabel));
      }
    });

    it(`${card.name}: escapes label text into the SVG`, () => {
      const verdict = verdictFor(
        {
          category: "snack",
          productName: 'Bob & Sons "Best" <Crisps>',
          ingredients: [{ text: "Potatoes & Salt", legibility: "clear", readConfidence: 1, contains: [] }],
          containsStatement: [],
          truncated: false,
          note: null,
        },
        PROFILES["clean-label"]!,
      );
      const svg = card.render(verdict);
      expect(svg).toContain("&amp;");
      expect(svg).not.toMatch(/<Crisps>/);
    });
  }
});

describe("what the share card may not drop", () => {
  it("carries every allergen finding, even when the flags are trimmed for space", () => {
    // The share card renders fewer flags than the screen. The allergen block is
    // not a flag and is never what gets trimmed.
    for (const [name, profile] of Object.entries(PROFILES)) {
      for (const label of Object.values(FIXTURES)) {
        const verdict = verdictFor(label, profile);
        const svg = shareCard(verdict);
        for (const finding of verdict.allergens) {
          expect(svg, `${name}: ${finding.allergen}`).toContain(finding.state === "flagged" ? "flagged on this label" : finding.state === "not-flagged" ? "not flagged on this label" : "cannot be checked");
        }
      }
    }
  });

  it("says how many flags it did not show", () => {
    const verdict = verdictFor(FIXTURES["rainbow-snack"], PROFILES["clean-label"]!);
    const svg = shareCard(verdict);
    if (!svg.includes(verdict.flags[verdict.flags.length - 1]!.ingredient)) {
      expect(svg).toMatch(/\+ \d+ more flagged/);
    }
  });
});

describe("text measurement", () => {
  it("wraps to the width it was given", () => {
    const lines = wrap(
      "Partially hydrogenated cottonseed oil, an ingredient US regulators removed from the safe list",
      400,
      27,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      // A single word longer than the line is allowed to overflow rather than
      // be hyphenated, so the assertion is per-line-with-a-space.
      if (line.includes(" ")) expect(measure(line, 27)).toBeLessThanOrEqual(400);
    }
  });

  it("truncates rather than overflowing when the line budget runs out", () => {
    const lines = wrap("one two three four five six seven eight nine ten eleven twelve", 120, 24, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/…$/);
  });

  it("returns nothing for nothing", () => {
    expect(wrap("", 300, 20)).toEqual([]);
    expect(measure("", 20)).toBe(0);
  });
});
