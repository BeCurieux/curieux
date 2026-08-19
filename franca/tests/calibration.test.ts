/**
 * Is the corpus loud in the right places?
 *
 * The other suites ask whether each rule works. This one asks whether they
 * work *together* on a page, which is a different question and the one the
 * kill test will actually answer. A corpus drifts louder over time — every new
 * rule is added because something was missed, never because something was
 * over-flagged — so the bands here fail in both directions on purpose.
 *
 * `pnpm calibrate` prints the same thing with the marks listed, which is what
 * to run while editing a rule.
 */

import { describe, expect, it } from "vitest";
import { scan } from "@/engine/evaluate.js";
import { annotate } from "@/card/annotate.js";
import { supportedJurisdictions } from "@/engine/registry.js";
import { badgeEligible } from "@/engine/score.js";
import { CALIBRATION } from "./fixtures/calibration.js";

const markets = supportedJurisdictions();
const read = (text: string) => {
  const result = scan({ text, source: { kind: "paste" }, jurisdictions: markets });
  return { result, marks: annotate(text, result.findings).marks };
};

describe("every page reads inside the band a specialist would set", () => {
  for (const page of CALIBRATION) {
    it(`${page.slug} — ${page.expect.min}–${page.expect.max} marks`, () => {
      const { marks } = read(page.text);
      const listed = marks.map((m) => `${m.index}. ${m.text.trim()} (${m.findings[0]?.ruleId})`);
      expect(marks.length, `${page.slug}:\n  ${listed.join("\n  ")}`).toBeGreaterThanOrEqual(page.expect.min);
      expect(marks.length, `${page.slug}:\n  ${listed.join("\n  ")}`).toBeLessThanOrEqual(page.expect.max);
    });
  }
});

describe("the two ends of the range behave", () => {
  it("leaves careful copy completely alone, and lets it carry the mark", () => {
    const page = CALIBRATION.find((p) => p.slug === "careful-skincare")!;
    const { result, marks } = read(page.text);
    expect(marks).toEqual([]);
    expect(result.score.value).toBe(100);
    expect(badgeEligible(result.score)).toBe(true);
  });

  it("reads the supplement page loudly enough to be worth opening", () => {
    const page = CALIBRATION.find((p) => p.slug === "supplement-ad-disapproval")!;
    const { result } = read(page.text);
    expect(result.score.band).not.toBe("clear");
    expect(badgeEligible(result.score)).toBe(false);
  });
});

describe("the false positives that would end a demo", () => {
  it("says nothing about a caution panel that names conditions responsibly", () => {
    // "Speak to your doctor before use if you have asthma" is the most
    // responsible sentence on a supplement page. It was flagged high-severity
    // as a therapeutic claim until `pnpm calibrate` was pointed at it.
    const page = CALIBRATION.find((p) => p.slug === "safety-warnings")!;
    const { result, marks } = read(page.text);
    expect(marks.map((m) => m.text)).toEqual([]);
    expect(result.findings.map((f) => f.ruleId)).not.toContain("au-tga-serious-condition");
  });

  it("accepts every container word a real page uses to name its packaging", () => {
    // "Our cans are recyclable" names the component perfectly, and was flagged
    // for not naming one because nobody had written "can" into the rule.
    for (const container of ["can", "tin", "sachet", "pouch", "sleeve", "lid", "refill", "bottle", "carton"]) {
      const text = `Our ${container} is recyclable.`;
      const found = scan({ text, source: { kind: "paste" }, jurisdictions: ["EU"] }).findings;
      expect(found.map((f) => f.ruleId), container).not.toContain("eu-ecgt-whole-product-from-one-part");
    }
  });

  it("still catches a bare claim with no component anywhere near it", () => {
    const found = scan({
      text: "Fully recyclable, inside and out.",
      source: { kind: "paste" },
      jurisdictions: ["EU"],
    }).findings;
    expect(found.map((f) => f.ruleId)).toContain("eu-ecgt-whole-product-from-one-part");
  });

  it("still catches a serious condition claimed rather than warned about", () => {
    const found = scan({
      text: "A gentle daily ritual for hands living with arthritis.",
      source: { kind: "paste" },
      jurisdictions: ["AU"],
    }).findings;
    expect(found.map((f) => f.ruleId)).toContain("au-tga-serious-condition");
  });
});
