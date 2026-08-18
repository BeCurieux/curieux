import { describe, expect, it } from "vitest";
import { badgeEligible, bandFor, PER_RULE_CAP_MULTIPLIER, scoreFindings } from "@/engine/score.js";
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
