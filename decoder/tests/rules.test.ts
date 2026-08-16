/**
 * The rules engine and the onboarding that produces rules.
 */

import { describe, expect, it } from "vitest";
import { ParsedLabel, RuleSet } from "@/lib/schema";
import { ALL_PRESETS, presetByName } from "@/lib/rules/presets";
import { becauseFor, draftRules, draftRulesLocally, systemPrompt, vocabulary } from "@/lib/rules/author";
import { evaluate } from "@/lib/verdict/evaluate";
import { compare, comparisonHeadline } from "@/lib/verdict/compare";
import { FIXTURES } from "@/lib/fixtures";
import { DISPUTE_KINDS, disputeRate, isGraphFault, raiseDispute } from "@/lib/feedback";

const label = (texts: (string | { text: string; contains?: string[] })[], over = {}) =>
  ParsedLabel.parse({
    category: "snack",
    productName: "Test",
    ingredients: texts.map((t) =>
      typeof t === "string"
        ? { text: t, legibility: "clear", readConfidence: 1, contains: [] }
        : { text: t.text, legibility: "clear", readConfidence: 1, contains: t.contains ?? [] },
    ),
    containsStatement: [],
    truncated: false,
    note: null,
    ...over,
  });

/* -------------------------------------------------------------------------- */
/* Onboarding — §6                                                             */
/* -------------------------------------------------------------------------- */

describe("§6 — create my rules", () => {
  const EXAMPLE =
    "I'm vegan. I avoid artificial sweeteners and carrageenan. I don't care about seed oils. Flag anything with caffeine.";

  it("reproduces the brief's own example, including the opt-out", () => {
    const draft = draftRulesLocally(EXAMPLE);
    const byKind = (kind: string) => draft.ruleSet.rules.filter((r) => r.kind === kind).map((r) => r.label);

    expect(byKind("avoid")).toEqual(
      expect.arrayContaining(["Animal-derived ingredients", "Artificial sweeteners", "Carrageenan"]),
    );
    expect(byKind("flag")).toEqual(expect.arrayContaining(["Caffeine"]));
    // The half that is easy to lose: "I don't care about seed oils" has to
    // become a never-flag, not an avoid.
    expect(byKind("never-flag")).toEqual(["Seed oils"]);
  });

  it("makes the opt-out actually silence the rule", () => {
    const draft = draftRulesLocally(EXAMPLE);
    const verdict = evaluate(label(["Sunflower Oil"]), draft.ruleSet);
    expect(verdict.blockers).toEqual([]);
    expect(verdict.flags).toEqual([]);
  });

  it("writes the explanation itself rather than taking one from a model", () => {
    // §17 Rule 4 is a guarantee when the sentence is generated and a hope when
    // it is prompted.
    expect(becauseFor("avoid", "Seed oils")).toBe("You asked us to avoid seed oils.");
    expect(becauseFor("flag", "Caffeine")).toBe("You asked us to flag caffeine.");
    expect(becauseFor("never-flag", "Seed oils")).toBe("You told us not to flag seed oils.");
  });

  it("reports what it could not turn into a rule", () => {
    const draft = draftRulesLocally("I avoid ingredients grown within a mile of a motorway.");
    expect(draft.ruleSet.rules).toEqual([]);
    expect(draft.unmapped.length).toBeGreaterThan(0);
  });
});

describe("the model may only name things that exist", () => {
  const scripted = (body: unknown) => ({ async draft() { return JSON.stringify(body); } });

  it("accepts a target inside the vocabulary", async () => {
    const draft = await draftRules(
      "whatever",
      scripted({ rules: [{ kind: "avoid", targetKind: "class", targetValue: "emulsifier" }], unmapped: [] }),
    );
    expect(draft.ruleSet.rules).toHaveLength(1);
    expect(draft.ruleSet.rules[0]!.label).toBe("Emulsifiers");
    expect(draft.ruleSet.rules[0]!.because).toBe("You asked us to avoid emulsifiers.");
  });

  it("refuses to invent a class, and says so instead of guessing", async () => {
    // Coercing to the nearest match would be the worst outcome available here:
    // the user sees a rule in their list that means something else.
    const draft = await draftRules(
      "whatever",
      scripted({ rules: [{ kind: "avoid", targetKind: "class", targetValue: "seed-oilz" }], unmapped: [] }),
    );
    expect(draft.ruleSet.rules).toEqual([]);
    expect(draft.unmapped).toContain("seed-oilz");
  });

  it("refuses to invent an ingredient", async () => {
    const draft = await draftRules(
      "whatever",
      scripted({ rules: [{ kind: "avoid", targetKind: "ingredient", targetValue: "unobtainium" }], unmapped: [] }),
    );
    expect(draft.ruleSet.rules).toEqual([]);
    expect(draft.unmapped).toContain("unobtainium");
  });

  it("puts the whole vocabulary in the prompt, so there is nothing to guess at", () => {
    const prompt = systemPrompt();
    const vocab = vocabulary();
    for (const cls of vocab.classes) expect(prompt).toContain(cls.id);
    expect(prompt).toContain("Never invent one");
  });

  it("survives a fenced response", async () => {
    const transport = {
      async draft() {
        return '```json\n{"rules":[{"kind":"flag","targetKind":"class","targetValue":"caffeine-source"}],"unmapped":[]}\n```';
      },
    };
    const draft = await draftRules("whatever", transport);
    expect(draft.ruleSet.rules).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

describe("nested sub-ingredients", () => {
  it("finds a conflict one level down, and names it rather than its parent", () => {
    const verdict = evaluate(
      label([{ text: "Chocolate Chips (Cocoa Mass, Cane Sugar)", contains: ["Cocoa Mass", "Cane Sugar"] }]),
      presetByName("low-added-sugar")!,
    );
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.blockers[0]!.ingredient).toBe("Cane Sugar (in Chocolate Chips)");
  });

  it("does not report the parent and its own sub-ingredient as two conflicts", () => {
    const verdict = evaluate(
      label([{ text: "Chocolate Chips (Cane Sugar, Soy Lecithin)", contains: ["Cane Sugar", "Soy Lecithin"] }]),
      presetByName("low-added-sugar")!,
    );
    expect(verdict.blockers.map((f) => f.ingredient)).toEqual(["Cane Sugar (in Chocolate Chips)"]);
  });

  it("still reads a parenthetical the parser did not split out", () => {
    const verdict = evaluate(label(["Sweetener (Sucralose)"]), presetByName("no-artificial-sweeteners")!);
    expect(verdict.blockers).toHaveLength(1);
  });

  it("reads the contains statement for allergen rules only", () => {
    const verdict = evaluate(
      label(["Water"], { containsStatement: ["Peanuts"] }),
      presetByName("peanut-listed")!,
    );
    expect(verdict.allergens.find((a) => a.ruleId === "allergen-peanut")!.state).toBe("listed");
    expect(verdict.blockers).toEqual([]);
    expect(verdict.match).toBe(100);
  });
});

describe("the match percentage", () => {
  it("stays inside 0–100 however many rules fire", () => {
    const everything = RuleSet.parse({
      id: "everything",
      label: "Everything",
      rules: ALL_PRESETS.filter((p) => p.id !== "none").flatMap((p) => p.rules.filter((r) => !r.allergen)),
    });
    const verdict = evaluate(FIXTURES["rainbow-snack"], everything);
    expect(verdict.match).toBeGreaterThanOrEqual(0);
    expect(verdict.match).toBeLessThanOrEqual(100);
  });

  it("ranks two products that both contain a blocker", () => {
    // §8 says a blocker overrides the score, not that it zeroes it — and
    // Compare mode cannot rank two flawed products if it does.
    const rules = presetByName("low-added-sugar")!;
    const worse = evaluate(label(["Sugar", "Corn Syrup", "Maltodextrin"]), rules);
    const better = evaluate(label(["Sugar", "Water", "Sea Salt", "Oats"]), rules);
    expect(better.match!).toBeGreaterThan(worse.match!);
  });

  it("is 100 when nothing at all matches", () => {
    expect(evaluate(label(["Water", "Sea Salt"]), presetByName("vegan")!).match).toBe(100);
  });
});

/* -------------------------------------------------------------------------- */
/* Compare — §9                                                                */
/* -------------------------------------------------------------------------- */

describe("§9 — Compare mode", () => {
  const rules = presetByName("simple-ingredients")!;

  it("picks the label with fewer blockers even when the other scores higher", () => {
    // A product with a higher percentage and a blocker has not won. A
    // comparison that said otherwise would mislead somebody in an aisle.
    const withBlocker = evaluate(label(["Red 40", "Water", "Oats", "Salt", "Rice", "Corn", "Barley flakes"]), rules);
    const withFlags = evaluate(label(["Maltodextrin", "Mono- and Diglycerides"]), rules);

    expect(withBlocker.match!).toBeGreaterThan(withFlags.match!);
    expect(compare(withBlocker, withFlags).winner).toBe("b");
  });

  it("gives every reason the winner won, not only the deciding one", () => {
    const a = evaluate(FIXTURES["protein-bar"], rules);
    const b = evaluate(FIXTURES["rival-bar"], rules);
    const result = compare(a, b);
    expect(result.winner).toBe("b");
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("refuses to compare labels checked against different rules", () => {
    const a = evaluate(FIXTURES["protein-bar"], presetByName("vegan")!);
    const b = evaluate(FIXTURES["rival-bar"], presetByName("keto")!);
    expect(() => compare(a, b)).toThrow(/same rules/);
  });

  it("reports a genuine tie rather than picking one", () => {
    const a = evaluate(label(["Water", "Sea Salt"]), rules);
    const b = evaluate(label(["Water", "Black Pepper"]), rules);
    const result = compare(a, b);
    expect(result.winner).toBeNull();
    expect(comparisonHeadline(result)).toMatch(/equally well/);
  });

  it("changes its answer when the rules change", () => {
    // §4's argument, at the level of two products rather than two people.
    const sugary = label(["Cane Sugar", "Wheat Flour", "Water"]);
    const additived = label(["Red 40", "Water", "Oats"]);

    const bySugar = compare(evaluate(sugary, presetByName("low-added-sugar")!), evaluate(additived, presetByName("low-added-sugar")!));
    const byAdditive = compare(evaluate(sugary, rules), evaluate(additived, rules));

    expect(bySugar.winner).toBe("b");
    expect(byAdditive.winner).toBe("a");
  });
});

/* -------------------------------------------------------------------------- */
/* Feedback — §16 and §25                                                      */
/* -------------------------------------------------------------------------- */

describe("§16 — this verdict looks wrong", () => {
  it("offers exactly the categories the brief lists", () => {
    expect(DISPUTE_KINDS).toEqual([
      "ingredient-missed",
      "ingredient-misread",
      "incorrect-classification",
      "incorrect-rule-match",
      "explanation-inaccurate",
      "other",
    ]);
  });

  it("records enough to re-derive the verdict and no more", () => {
    const verdict = evaluate(FIXTURES["protein-bar"], presetByName("vegan")!);
    const dispute = raiseDispute(verdict, "ingredient-misread", { finding: verdict.blockers[0]! });
    expect(dispute.provenance).toEqual(verdict.provenance);
    expect(dispute.ingredient).toBe(verdict.blockers[0]!.ingredient);
  });

  it("separates a camera fault from a graph fault", () => {
    // Different fixes and different owners: a misread goes to §15's failure
    // corpus, a wrong classification is one edit to an entry.
    expect(isGraphFault("ingredient-misread")).toBe(false);
    expect(isGraphFault("incorrect-classification")).toBe(true);
    expect(isGraphFault("incorrect-rule-match")).toBe(true);
  });

  it("computes §25's dispute rate, and refuses to divide by nothing", () => {
    expect(disputeRate(200, 3)).toBe(1.5);
    expect(disputeRate(0, 0)).toBeNull();
  });
});
