// Manufacturing facts, not design preferences. Each of these encodes a
// constraint that has ruined print runs when got wrong.

import { describe, expect, it } from "vitest";
import {
  FORMAT, ageInYears, isRightHandPage, pageMarginsMm, totalPdfPages, imageTier,
} from "@/lib/book/format";
import { AGE_COLOURS, colourForAge, contrastRatio, coverContrastOk } from "@/lib/book/colours";
import { pace, padToEven, rhythmPenalty, rhythmReport, type PagePlan } from "@/lib/book/rhythm";
import { ALL_ARCHETYPES, ARCHETYPES } from "@/lib/book/templates";
import { yearWord } from "@/lib/subjects/config";

describe("Prodigi page mapping (§16)", () => {
  it("wraps the interior in two covers", () => {
    expect(totalPdfPages(80)).toBe(82);
  });

  it("puts the first interior page on the right", () => {
    expect(isRightHandPage(1)).toBe(true);
    expect(isRightHandPage(2)).toBe(false);
  });

  it("mirrors margins so the inner edge always clears the gutter", () => {
    const right = pageMarginsMm(1);
    const left = pageMarginsMm(2);
    expect(right.left).toBe(FORMAT.innerMarginMm);
    expect(left.right).toBe(FORMAT.innerMarginMm);
    expect(FORMAT.innerMarginMm).toBeGreaterThan(FORMAT.gutterLossMm);
  });

  it("keeps every margin outside the safe area", () => {
    for (const n of [1, 2, 17, 40]) {
      const m = pageMarginsMm(n);
      for (const v of [m.top, m.bottom, m.left, m.right]) {
        expect(v).toBeGreaterThanOrEqual(FORMAT.safeMarginMm);
      }
    }
  });

  it("is A4 portrait exactly", () => {
    expect(FORMAT.trimWidthMm).toBe(210);
    expect(FORMAT.trimHeightMm).toBe(297);
  });
});

describe("the annual colour system (§5)", () => {
  it("covers ages zero to eighteen", () => {
    expect(AGE_COLOURS).toHaveLength(19);
    expect(AGE_COLOURS.map((c) => c.age)).toEqual([...Array(19).keys()]);
  });

  it("gives every age a distinct field colour", () => {
    expect(new Set(AGE_COLOURS.map((c) => c.hex)).size).toBe(AGE_COLOURS.length);
  });

  it("keeps every cover legible on stock that flattens contrast", () => {
    for (const colour of AGE_COLOURS) {
      expect(coverContrastOk(colour), `${colour.name} is too low contrast`).toBe(true);
    }
  });

  it("cycles rather than failing past the designed range", () => {
    expect(colourForAge(25).hex).toBeTruthy();
  });

  it("computes contrast symmetrically", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });
});

describe("editorial rhythm (§11)", () => {
  const plan = (archetype: keyof typeof ARCHETYPES, sectionIndex = 0): PagePlan =>
    ({ archetype, sectionIndex, payload: null });

  it("punishes the same layout twice running", () => {
    const repeated = [plan("portrait_plus_story"), plan("portrait_plus_story")];
    const varied = [plan("portrait_plus_story"), plan("quote_page")];
    expect(rhythmPenalty(repeated)).toBeGreaterThan(rhythmPenalty(varied));
  });

  it("punishes two dense pages in a row", () => {
    const dense = [plan("little_things"), plan("ordinary_days")];
    const paced = [plan("little_things"), plan("quote_page")];
    expect(rhythmPenalty(dense)).toBeGreaterThan(rhythmPenalty(paced));
  });

  it("leads each section with its chapter opener", () => {
    const paced = pace([
      plan("hero_photograph"), plan("quote_page"), plan("chapter_opener"),
    ]);
    expect(paced[0].archetype).toBe("chapter_opener");
  });

  it("never reorders across sections", () => {
    const paced = pace([
      plan("quote_page", 0), plan("hero_photograph", 1), plan("object_portrait", 0),
    ]);
    expect(paced.map((p) => p.sectionIndex)).toEqual([0, 0, 1]);
  });

  it("improves a photo/caption drone", () => {
    const drone = Array.from({ length: 8 }, () => plan("portrait_plus_story"));
    const mixed = [
      plan("chapter_opener"), plan("hero_photograph"), plan("quote_page"),
      plan("three_photo_sequence"), plan("object_portrait"), plan("little_things"),
      plan("then_now"), plan("closing_page"),
    ];
    expect(rhythmPenalty(mixed)).toBeLessThan(rhythmPenalty(drone));
  });

  it("pads to an even extent with a quiet page, never a filler photo", () => {
    const padded = padToEven([plan("hero_photograph")]);
    expect(padded).toHaveLength(2);
    expect(ARCHETYPES[padded[1].archetype].photoSlots).toBe(0);
  });

  it("reports variety across the archetype set", () => {
    const report = rhythmReport(ALL_ARCHETYPES.map((a) => plan(a.id)));
    expect(report.variety).toBe(1);
    expect(report.pageCount).toBe(12);
  });
});

describe("imperfect source material (§14)", () => {
  it("never promotes an image beyond what its pixels support", () => {
    const cases: [number, number][] = [[4000, 3000], [1500, 1000], [700, 500], [200, 150]];
    const tiers = cases.map(([w, h]) => imageTier(w, h));
    const rank = { unprintable: 0, intimate: 1, editorial: 2, hero: 3 };
    // Strictly non-increasing as the source gets worse.
    for (let i = 1; i < tiers.length; i++) {
      expect(rank[tiers[i]]).toBeLessThanOrEqual(rank[tiers[i - 1]]);
    }
  });

  it("treats a missing size as unprintable rather than guessing", () => {
    expect(imageTier(null, null)).toBe("unprintable");
  });
});

describe("cover words cover the whole shelf", () => {
  // The colour system runs 0–18 and the words stopped at 10, so the eleventh
  // cover printed FLORENCE / 11 at 96pt in a row of words. Caught by rendering
  // every cover and looking at them, which is the only way it was ever going
  // to surface.
  it("gives every age in the colour system a word, not a numeral", () => {
    for (const colour of AGE_COLOURS) {
      const word = yearWord(colour.age);
      expect(word, `age ${colour.age} has no word`).not.toMatch(/^\d+$/);
    }
  });

  it("names the first volume for what it is", () => {
    expect(`The Year You Were ${yearWord(0)}`).toBe("The Year You Were Born");
  });

  it("still degrades to a numeral past the designed range", () => {
    expect(yearWord(40)).toBe("40");
  });
});

describe("age, by the calendar", () => {
  const at = (s: string) => new Date(s + "T12:00:00Z");

  it("counts completed years, not elapsed milliseconds", () => {
    expect(ageInYears("2023-04-14", at("2026-04-13"))).toBe(2); // day before
    expect(ageInYears("2023-04-14", at("2026-04-14"))).toBe(3); // birthday
    expect(ageInYears("2023-04-14", at("2026-04-15"))).toBe(3);
  });

  it("does not drift across leap years", () => {
    // Four birthdays including two leap years — ms division loses a day a year.
    expect(ageInYears("2020-02-29", at("2024-02-29"))).toBe(4);
    expect(ageInYears("2020-03-01", at("2028-03-01"))).toBe(8);
  });

  it("never reports a negative age", () => {
    expect(ageInYears("2030-01-01", at("2026-01-01"))).toBe(0);
  });
});
