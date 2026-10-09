import { describe, expect, it } from "vitest";
import { assess } from "@/engine/assess.js";
import { SCORE_LABEL, scoreFindings } from "@/engine/score.js";
import { AS_OF, product, rule, snapshotOf } from "./helpers.js";

const f = (status: "pass" | "fail" | "not_assessed", severity: "blocked" | "needs_attention" | "advisory", scored = true) => ({
  status,
  severity,
  scored,
});

describe("scoreFindings", () => {
  it("blocked beats needs_attention beats not_assessed beats ready", () => {
    expect(scoreFindings([f("fail", "needs_attention"), f("fail", "blocked"), f("not_assessed", "blocked")])).toBe("blocked");
    expect(scoreFindings([f("fail", "needs_attention"), f("not_assessed", "blocked")])).toBe("needs_attention");
    expect(scoreFindings([f("pass", "blocked"), f("not_assessed", "needs_attention")])).toBe("not_assessed");
    expect(scoreFindings([f("pass", "blocked"), f("pass", "needs_attention")])).toBe("ready");
  });

  it("ignores findings that are not scored", () => {
    expect(scoreFindings([f("pass", "blocked"), f("fail", "blocked", false)])).toBe("ready");
  });

  it("is not_assessed when nothing is scored", () => {
    expect(scoreFindings([])).toBe("not_assessed");
    expect(scoreFindings([f("fail", "blocked", false)])).toBe("not_assessed");
  });

  it("never calls anything compliant", () => {
    for (const label of Object.values(SCORE_LABEL)) expect(label.toLowerCase()).not.toContain("complian");
  });
});

describe("advisories and unverified rules never change the score", () => {
  const verified = rule({ kind: "required_field", params: { facts: ["net_quantity"] } });
  const p = product({ net_quantity: "60 capsules" });

  it.each([
    ["advisory", rule({ kind: "required_field", severity: "advisory", params: { facts: ["daily_dose"] } })],
    ["drafted", rule({ kind: "required_field", severity: "blocked", confidence: "drafted", params: { facts: ["daily_dose"] } })],
    ["needs_review", rule({ kind: "required_field", severity: "blocked", confidence: "needs_review", params: { facts: ["daily_dose"] } })],
  ])("a failing %s rule leaves a ready product ready", (_, other) => {
    const result = assess(p, "EU", snapshotOf(verified, other), { asOf: AS_OF });
    expect(result.findings.find((x) => x.ruleKey === other.rule_key)?.status).toBe("fail");
    expect(result.score).toBe("ready");
  });
});
