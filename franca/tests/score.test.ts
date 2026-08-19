import { describe, expect, it } from "vitest";
import {
  BAND_THRESHOLDS,
  badgeEligible,
  bandFor,
  PER_RULE_CAP_MULTIPLIER,
  scoreFindings,
} from "@/engine/score.js";
import { SEVERITY_WEIGHT, type Finding, type Severity } from "@/engine/types.js";

let n = 0;
const finding = (ruleId: string, severity: Severity): Finding => ({
  ruleId,
  ruleTitle: ruleId,
  jurisdiction: "AU",
  categories: ["efficacy"],
  severity,
  modality: "may_be_unsubstantiated",
  citation: { instrument: "Test instrument" },
  claimId: null,
  trigger: { text: "x", span: { start: n, end: ++n } },
  headline: "h",
  concern: "c",
  remedy: "r",
  rewriteGuidance: "g",
});

describe("a clean page", () => {
  it("scores 100 and is clear", () => {
    const score = scoreFindings([]);
    expect(score).toEqual({ value: 100, band: "clear", deductions: [] });
    expect(badgeEligible(score)).toBe(true);
  });
});

describe("where the bands sit, and where the badge sits with them", () => {
  const low = [finding("a", "low")];

  it("puts the boundary at 80, inclusive", () => {
    // Pinned because it moved once — 85 to 80 — and nothing failed, which
    // meant the number a brand's badge depends on was not written down
    // anywhere a reviewer would see it.
    expect(BAND_THRESHOLDS.clear).toBe(80);
    expect(bandFor(80, low)).toBe("clear");
    expect(bandFor(79, low)).toBe("review");
    expect(bandFor(60, low)).toBe("review");
    expect(bandFor(59, low)).toBe("rework");
  });

  it("gives the badge no bar of its own", () => {
    // The coupling is the point, and it is one of the four things CLAUDE.md
    // names as holding §9 up now the mark says "Claims Verified". A page whose
    // card reads *worth a look* while its PDP carries a mark reading *Claims
    // Verified* is the mark asserting what the card qualifies. Whoever gives
    // the badge a separate threshold has made a legal decision, and this test
    // is where they find that out.
    for (const value of [100, 90, 80, 79, 61, 60, 59, 0]) {
      const clear = bandFor(value, low) === "clear";
      expect(badgeEligible({ value, band: bandFor(value, low), deductions: [] })).toBe(clear);
    }
  });

  it("still refuses a high-severity page at any number", () => {
    // Unchanged by the move, and the reason the move was safe.
    expect(bandFor(99, [finding("b", "high")])).not.toBe("clear");
    expect(badgeEligible(scoreFindings([finding("b", "high")]))).toBe(false);
  });
});

describe("the arithmetic is the explanation", () => {
  it("gives every lost point a line naming the rule that took it", () => {
    const score = scoreFindings([finding("a", "medium"), finding("b", "low")]);
    expect(score.value).toBe(100 - SEVERITY_WEIGHT.medium - SEVERITY_WEIGHT.low);
    expect(score.deductions.map((d) => d.ruleId)).toEqual(["a", "b"]);
    expect(score.deductions.reduce((sum, d) => sum + d.points, 0)).toBe(100 - score.value);
  });

  it("charges a repeat of the same rule less than the first time", () => {
    const [first, second] = scoreFindings([finding("a", "medium"), finding("a", "medium")]).deductions;
    expect(first!.points).toBe(SEVERITY_WEIGHT.medium);
    expect(second!.points).toBeLessThan(first!.points);
    expect(second!.points).toBeGreaterThan(0);
  });

  it("stops charging once a rule has cost twice its weight", () => {
    const score = scoreFindings(Array.from({ length: 20 }, () => finding("a", "high")));
    const spent = score.deductions.reduce((sum, d) => sum + d.points, 0);
    expect(spent).toBe(SEVERITY_WEIGHT.high * PER_RULE_CAP_MULTIPLIER);
    expect(score.deductions.at(-1)!.points).toBe(0);
    expect(score.deductions.at(-1)!.reason).toContain("cap");
  });

  it("counts occurrences per rule, not across the page", () => {
    const score = scoreFindings([finding("a", "low"), finding("b", "low"), finding("a", "low")]);
    expect(score.deductions.map((d) => d.occurrence)).toEqual([1, 1, 2]);
  });

  it("never goes below zero", () => {
    const many = Array.from({ length: 12 }, (_, i) => finding(`rule-${i}`, "high"));
    expect(scoreFindings(many).value).toBe(0);
  });
});

describe("bands", () => {
  it("reads the thresholds off the number when nothing is high severity", () => {
    expect(bandFor(92, [])).toBe("clear");
    expect(bandFor(70, [])).toBe("review");
    expect(bandFor(12, [])).toBe("rework");
  });

  it("keeps a page carrying a high-severity finding out of clear at any number", () => {
    expect(bandFor(99, [finding("a", "high")])).toBe("review");
  });

  it("refuses the badge to anything but clear", () => {
    expect(badgeEligible(scoreFindings([finding("a", "high")]))).toBe(false);
    expect(badgeEligible(scoreFindings([finding("a", "low")]))).toBe(true);
  });
});
