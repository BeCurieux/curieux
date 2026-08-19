/**
 * The guardrail, as a test.
 *
 * The brief's legal section is short and absolute: everything is opinion and
 * guidance, nothing is a verdict, and the disclaimer is always present. That
 * survives one careful author and dies on the fortieth rule written at
 * midnight, so it is checked rather than remembered.
 */

import { describe, expect, it } from "vitest";
import { absolutesIn, BANNED_ABSOLUTES, CLAIM_DIRECTED_FIELDS, DISCLAIMER, headline } from "@/engine/framing.js";
import { allRules } from "@/engine/registry.js";
import { scan } from "@/engine/evaluate.js";
import { AURELIA_PDP } from "./fixtures/pdp.js";

const rules = allRules();

describe("no rule reaches a verdict", () => {
  for (const field of CLAIM_DIRECTED_FIELDS) {
    it(`keeps absolutes out of every rule's ${field}`, () => {
      const offenders = rules
        .map((rule) => ({ id: rule.id, words: absolutesIn(rule[field]) }))
        .filter((entry) => entry.words.length > 0);
      expect(offenders).toEqual([]);
    });
  }

  it("allows the law's own verbs where a rule is describing the law", () => {
    // Not a loophole, a distinction: `instrumentSays` is about an instrument,
    // and instruments do prohibit things. If this ever becomes the place
    // verdicts hide, the fix is to compose that field too — not to ban the
    // word from a sentence where it is simply true.
    expect(CLAIM_DIRECTED_FIELDS).not.toContain("instrumentSays");
    const describing = rules.filter((rule) => absolutesIn(rule.instrumentSays).length > 0);
    expect(describing.map((rule) => rule.id)).toContain("eu-ecgt-legal-requirement-as-feature");
  });

  it("has a headline for every rule, and every headline is a template", () => {
    const templates = [
      /^This wording is likely to be flagged under .+\.$/,
      /^This claim may be unsubstantiated as written under .+\.$/,
      /^Evidence is expected to be in hand before this wording is used, under .+\.$/,
      /^This claim reaches further than it needs to under .+\.$/,
    ];
    for (const rule of rules) {
      const line = headline(rule);
      expect(templates.some((t) => t.test(line)), `${rule.id}: ${line}`).toBe(true);
      expect(absolutesIn(line), rule.id).toEqual([]);
    }
  });

  it("names the instrument in the headline, so nothing is asserted in our own voice", () => {
    for (const rule of rules) {
      expect(headline(rule)).toContain(rule.citation.instrument);
    }
  });
});

describe("the disclaimer", () => {
  it("rides on the result rather than on each surface remembering it", () => {
    const result = scan({ text: AURELIA_PDP, source: { kind: "paste" }, jurisdictions: ["AU"] });
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it("says it is not legal advice, in those words", () => {
    expect(DISCLAIMER.toLowerCase()).toContain("not legal advice");
  });

  it("is on a clean result too, where there is nothing to disclaim about", () => {
    const result = scan({ text: "A serum. It smells of neroli.", source: { kind: "paste" }, jurisdictions: ["EU"] });
    expect(result.findings).toEqual([]);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });
});

describe("the banned list itself", () => {
  it("catches what it is for", () => {
    expect(absolutesIn("This is illegal and non-compliant.")).toContain("illegal");
    expect(absolutesIn("Your page violates the code.")).toContain("violat");
  });

  it("leaves ordinary guidance alone", () => {
    expect(absolutesIn("This wording may be read as a therapeutic claim.")).toEqual([]);
  });

  it("is not empty, which is the way this test silently stops working", () => {
    expect(BANNED_ABSOLUTES.length).toBeGreaterThan(8);
  });
});
