/**
 * The cards.
 *
 * Not a pixel comparison — these assert what must be on a card whatever the
 * layout does. BRIEF.md §11 makes the share card a core acquisition mechanism,
 * which means it travels to readers who did not take the photograph and cannot
 * check what it left out.
 */

import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/fixtures";
import { ALL_PRESETS, presetByName } from "@/lib/rules/presets";
import { evaluate } from "@/lib/verdict/evaluate";
import { compare } from "@/lib/verdict/compare";
import { compareCard, matchCard, shareCard, twoPeopleCard } from "@/lib/render/card";
import { escapeXml, measure, wrap } from "@/lib/render/text";

const CARDS = [
  { name: "result", render: matchCard },
  { name: "share", render: shareCard },
];

const CASES = ALL_PRESETS.flatMap((rules) =>
  Object.entries(FIXTURES).map(([labelName, label]) => ({
    what: `${labelName} / ${rules.id}`,
    verdict: evaluate(label, rules),
  })),
);

describe("every card, for every label and rule set", () => {
  for (const card of CARDS) {
    it(`${card.name}: is well-formed SVG at 1080×1920`, () => {
      for (const { what, verdict } of CASES) {
        const svg = card.render(verdict);
        expect(svg, what).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(svg, what).toContain('height="1920"');
        expect(svg.endsWith("</svg>"), what).toBe(true);
        // Unbalanced tags mean a rasteriser renders a blank card, and a blank
        // card is indistinguishable from a card nobody looked at.
        expect((svg.match(/<text /g) ?? []).length).toBe((svg.match(/<\/text>/g) ?? []).length);
      }
    });

    it(`${card.name}: never prints a percentage it does not have`, () => {
      for (const { what, verdict } of CASES) {
        const svg = card.render(verdict);
        if (verdict.match === null) {
          expect(svg, what).toContain("NO MATCH SCORE");
          expect(svg, what).not.toMatch(/>\d+%</);
        } else {
          expect(svg, what).toContain(`${verdict.match}%`);
        }
      }
    });

    it(`${card.name}: shows the incomplete banner whenever there is one`, () => {
      for (const { what, verdict } of CASES) {
        if (verdict.readComplete) continue;
        expect(card.render(verdict), what).toMatch(/couldn&apos;t be read|hard to read/);
      }
    });

    it(`${card.name}: names the rules the verdict was computed against`, () => {
      // §4: a percentage with no rules beside it is the thing this product
      // replaces.
      for (const { what, verdict } of CASES) {
        expect(card.render(verdict), what).toContain(escapeXml(verdict.ruleSetLabel));
      }
    });

    it(`${card.name}: carries every allergen notice, whatever its state`, () => {
      // The share card renders fewer findings than the result screen. The
      // allergen block is not a finding and is never what gets trimmed — a card
      // reading "96% match · watching for peanuts" with no qualifier says *no
      // peanuts* to everyone who sees it.
      for (const { what, verdict } of CASES) {
        const svg = card.render(verdict);
        for (const notice of verdict.allergens) {
          const expected =
            notice.state === "listed"
              ? "LISTED"
              : notice.state === "cannot-check"
                ? "couldn&apos;t read enough"
                : "not listed in the text we could read";
          expect(svg, `${what}: ${notice.label}`).toContain(expected);
        }
      }
    });

    it(`${card.name}: escapes label text into the SVG`, () => {
      const verdict = evaluate(
        {
          category: "snack",
          productName: 'Bob & Sons "Best" <Crisps>',
          ingredients: [{ text: "Potatoes & Salt", legibility: "clear", readConfidence: 1, contains: [] }],
          containsStatement: [],
          truncated: false,
          note: null,
        },
        presetByName("simple-ingredients")!,
      );
      const svg = card.render(verdict);
      expect(svg).toContain("&amp;");
      expect(svg).not.toMatch(/<Crisps>/);
    });
  }
});

describe("the compare card", () => {
  const rules = presetByName("simple-ingredients")!;
  const a = evaluate(FIXTURES["protein-bar"], rules);
  const b = evaluate(FIXTURES["rival-bar"], rules);

  it("shows both percentages and the verdict", () => {
    const svg = compareCard(compare(a, b));
    expect(svg).toContain(`${a.match}%`);
    expect(svg).toContain(`${b.match}%`);
    // The headline wraps, so it lands as two <text> elements — assert on a
    // fragment that survives the break.
    expect(svg).toContain("fits your rules");
    expect(svg).toContain("has nothing on your avoid list");
  });

  it("says why it cannot compare, rather than picking one", () => {
    const unreadable = evaluate(FIXTURES["half-read"], rules);
    const svg = compareCard(compare(unreadable, b));
    expect(svg).toContain("can&apos;t compare");
  });
});

describe("the two-people card", () => {
  it("shows both people's percentages and names their rules", () => {
    const left = evaluate(FIXTURES["protein-bar"], presetByName("brief-user-a")!);
    const right = evaluate(FIXTURES["protein-bar"], presetByName("brief-user-b")!);
    const svg = twoPeopleCard(left, right);

    expect(svg).toContain(`${left.match}%`);
    expect(svg).toContain(`${right.match}%`);
    expect(svg).toContain(escapeXml(left.ruleSetLabel));
    expect(svg).toContain(escapeXml(right.ruleSetLabel));
    expect(svg).toContain("Same food. Totally different result.");
  });

  it("refuses to pretend two different products are one", () => {
    const left = evaluate(FIXTURES["protein-bar"], presetByName("vegan")!);
    const right = evaluate(FIXTURES["rival-bar"], presetByName("keto")!);
    expect(() => twoPeopleCard(left, right)).toThrow(/products differ/);
  });
});

describe("text measurement", () => {
  it("wraps to the width it was given", () => {
    const lines = wrap("Partially hydrogenated cottonseed oil, an ingredient regulators withdrew", 400, 27);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      // A single word longer than the line overflows rather than hyphenating,
      // so the assertion is per-line-with-a-space.
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
