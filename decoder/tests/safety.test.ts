/**
 * BRIEF.md §17's Safety Architecture, as a test.
 *
 * > Safety cannot be left to disclaimers. It must shape the actual product.
 *
 * Six rules, each asserted over the real graph, the real presets and the real
 * engine, against the labels most likely to break them. If something here goes
 * red, the fix is never to relax the assertion.
 */

import { describe, expect, it } from "vitest";
import { KNOWLEDGE } from "@/lib/knowledge";
import { ALL_PRESETS, presetByName } from "@/lib/rules/presets";
import { FIXTURES, HALF_READ_LABEL, OAT_CRACKERS } from "@/lib/fixtures";
import { evaluate } from "@/lib/verdict/evaluate";
import { compare } from "@/lib/verdict/compare";
import {
  ALLERGEN_PREAMBLE,
  FORBIDDEN_ALLERGEN_WORDS,
  allergenSentence,
  clearSentence,
  matchHeadline,
} from "@/lib/verdict/language";
import { RULED_OUT, WORDMARK } from "@/lib/brand";
import { compareCard, matchCard, shareCard } from "@/lib/render/card";
import { ParsedLabel } from "@/lib/schema";
import { escapeXml } from "@/lib/render/text";

const LABELS = Object.values(FIXTURES);
const EVERY = ALL_PRESETS.flatMap((rules) => LABELS.map((label) => ({ rules, label, verdict: evaluate(label, rules) })));

/* -------------------------------------------------------------------------- */
/* Rule 1 — never certify allergen safety                                      */
/* -------------------------------------------------------------------------- */

describe("§17 Rule 1 — never certify allergen safety", () => {
  it("has no reassuring word in any allergen sentence, in any state", () => {
    for (const state of ["listed", "not-listed-in-what-we-read", "cannot-check"] as const) {
      const sentence = allergenSentence({
        ruleId: "r",
        label: "Peanuts",
        state,
        matches: state === "listed" ? ["Peanut Butter"] : [],
        because: state === "cannot-check" ? "part of the list is out of frame" : null,
      }).toLowerCase();

      for (const word of FORBIDDEN_ALLERGEN_WORDS) {
        expect(sentence, `"${sentence}" must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it("names the state after what it means, so it cannot be shortened into a claim", () => {
    // "not-listed-in-what-we-read" rather than "not-listed". The long name is
    // load-bearing: absence from OCR is not absence from the product, and a
    // future refactor that tidies this would silently change the meaning.
    const verdict = evaluate(FIXTURES["oat-crackers"], presetByName("peanut-listed")!);
    expect(verdict.allergens[0]!.state).toBe("not-listed-in-what-we-read");
  });

  it("says something about every allergen rule, on every label", () => {
    // The rule that cannot be satisfied by an absence. A user watching for
    // peanuts gets a sentence about peanuts on every scan — including the scans
    // where nothing was found, which are the ones where a missing sentence
    // would read as reassurance.
    const rules = presetByName("peanut-listed")!;
    for (const label of LABELS) {
      const verdict = evaluate(label, rules);
      expect(verdict.allergens.map((a) => a.ruleId).sort()).toEqual(rules.rules.map((r) => r.id).sort());
    }
  });

  it("never reports not-listed when the label was not fully read", () => {
    const verdict = evaluate(HALF_READ_LABEL, presetByName("peanut-listed")!);
    expect(verdict.allergens.length).toBeGreaterThan(0);
    for (const notice of verdict.allergens) {
      expect(notice.state).toBe("cannot-check");
      expect(notice.because).toBeTruthy();
    }
  });

  it("keeps allergen findings out of the match percentage entirely", () => {
    // §8: the score becomes secondary when an allergen is listed. It must not
    // also be quietly adjusted by it — one fact, one place on the card.
    const base = presetByName("simple-ingredients")!;
    const withPeanuts = { ...base, rules: [...base.rules, ...presetByName("peanut-listed")!.rules] };

    const plain = evaluate(FIXTURES["rival-bar"], base);
    const watching = evaluate(FIXTURES["rival-bar"], withPeanuts);

    expect(watching.allergens.some((a) => a.state === "listed")).toBe(true);
    // Adding an allergen rule changes what is *said* and not what is scored:
    // the notice has its own place on the card and no share of the percentage.
    expect(watching.match).toBe(plain.match);
    const findings = [...watching.blockers, ...watching.flags, ...watching.uncertain];
    expect(findings.map((f) => f.ruleId)).not.toContain("allergen-peanut");
  });

  it("puts the preamble and every allergen sentence on the rendered cards", () => {
    const verdict = evaluate(FIXTURES["rival-bar"], presetByName("peanut-listed")!);
    for (const svg of [matchCard(verdict), shareCard(verdict)]) {
      // Apostrophes are XML-escaped on the way into the SVG, so the comparison
      // is against the escaped form rather than the source string.
      expect(svg).toContain(escapeXml(ALLERGEN_PREAMBLE).slice(0, 60));
      for (const notice of verdict.allergens) {
        const shown = notice.state === "listed" ? "LISTED" : allergenSentence(notice).split(":")[0]!;
        expect(svg).toContain(shown);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Rule 2 — separate uncertainty from absence                                  */
/* -------------------------------------------------------------------------- */

describe("§17 Rule 2 — uncertainty is not absence", () => {
  it('never says "no problem ingredients"', () => {
    // The rule quotes the exact phrase to avoid, and the exact phrase to use.
    for (const { verdict } of EVERY) {
      const cleared = clearSentence(verdict.clearCount, verdict.readComplete).toLowerCase();
      expect(cleared).not.toContain("no problem");
      if (cleared) expect(cleared).toContain("no conflicts found");
    }
  });

  it("says which text it is talking about when the read was incomplete", () => {
    const verdict = evaluate(HALF_READ_LABEL, presetByName("simple-ingredients")!);
    expect(clearSentence(verdict.clearCount, verdict.readComplete)).toContain("in the text we could read");
  });

  it("withholds the percentage entirely when the ingredient set is unknown", () => {
    for (const rules of ALL_PRESETS) {
      const verdict = evaluate(HALF_READ_LABEL, rules);
      expect(verdict.match).toBeNull();
      expect(matchHeadline(verdict)).not.toMatch(/no conflicts/i);
      expect(verdict.needsVerification).toBe(true);
    }
  });

  it("counts no illegible ingredient as having checked out", () => {
    const verdict = evaluate(HALF_READ_LABEL, presetByName("simple-ingredients")!);
    const legible = HALF_READ_LABEL.ingredients.filter((i) => i.legibility === "clear").length;
    expect(verdict.clearCount).toBeLessThanOrEqual(legible);
  });

  it("refuses to compare when either label could not be read", () => {
    const rules = presetByName("simple-ingredients")!;
    const result = compare(evaluate(HALF_READ_LABEL, rules), evaluate(FIXTURES["oat-crackers"], rules));
    expect(result.winner).toBeNull();
    expect(result.blockedBy).toBeTruthy();
  });

  it("surfaces an umbrella term even when no rule mentions one", () => {
    // §8's own verdict shows this line against a rule set that never mentions
    // flavourings. An umbrella term limits every rule at once, so it cannot be
    // opt-in.
    const verdict = evaluate(FIXTURES["protein-bar"], presetByName("avoid-seed-oils")!);
    expect(verdict.uncertain.some((f) => f.entryId === "natural-flavors")).toBe(true);
  });

  it("does not cloud a rule with an uncertainty about a different question", () => {
    // Mono- and diglycerides may be animal or plant derived, so a vegan rule
    // genuinely cannot be settled from the label. They are emulsifiers either
    // way, so a rule about emulsifiers is not in doubt at all.
    const label = ParsedLabel.parse({
      category: "snack",
      ingredients: [{ text: "Mono- and Diglycerides", legibility: "clear", readConfidence: 1, contains: [] }],
      containsStatement: [],
    });
    const asVegan = evaluate(label, presetByName("vegan")!);
    const asEmulsifier = evaluate(label, presetByName("brief-user-b")!);

    expect(asVegan.uncertain.map((f) => f.ingredient)).toContain("Mono- and Diglycerides");
    expect(asEmulsifier.blockers.map((f) => f.ingredient)).toContain("Mono- and Diglycerides");
  });
});

/* -------------------------------------------------------------------------- */
/* Rule 3 — no diagnoses or health-outcome claims                              */
/* -------------------------------------------------------------------------- */

/**
 * §17 Rule 3 names three: "Causes cancer." "Inflammatory." "Will damage your
 * gut." The list is blunt on purpose — anything here is a claim the brief
 * forbids without a legally reviewed evidence framework, and the correct
 * response to a red run is to rewrite the copy rather than add an exception.
 */
const MEDICAL_TERMS = [
  "cancer",
  "carcinogen",
  "tumour",
  "tumor",
  "diabetes",
  "diabetic",
  "obesity",
  "obese",
  "alzheimer",
  "dementia",
  "autism",
  "adhd",
  "hyperactivity",
  "infertility",
  "miscarriage",
  "birth defect",
  "cardiovascular",
  "heart disease",
  "stroke",
  "asthma",
  "eczema",
  "leaky gut",
  "inflammatory",
  "inflammation",
  "toxic",
  "poison",
  "damage your",
  "damages",
  "cures",
  "treats",
  "prevents",
];

/** §19 rules out weight loss and calorie tracking; §13 rules out moralising. */
const DIET_AND_MORAL_TERMS = [
  "calorie",
  "kcal",
  "macro",
  "fattening",
  "slimming",
  "weight loss",
  "guilt-free",
  "guilt free",
  "sinful",
  "cheat day",
  "cheat meal",
  "naughty",
  "bad food",
  "bad for you",
  "junk",
  "clean eating",
  "detox",
  "superfood",
  "never eat",
  "should not eat",
  "shouldn't eat",
  "dangerous",
];

function everyUserFacingString(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];

  for (const entry of KNOWLEDGE) {
    out.push({ where: `${entry.id}.plain`, text: entry.plain });
    for (const [i, u] of entry.uncertainty.entries()) out.push({ where: `${entry.id}.uncertainty[${i}]`, text: u.note });
    for (const [i, e] of entry.evidence.entries()) out.push({ where: `${entry.id}.evidence[${i}]`, text: e.cite });
  }

  for (const preset of ALL_PRESETS) {
    for (const rule of preset.rules) {
      out.push({ where: `${preset.id}/${rule.id}.label`, text: rule.label });
      out.push({ where: `${preset.id}/${rule.id}.because`, text: rule.because });
    }
  }

  for (const { rules, verdict } of EVERY) {
    const where = `verdict(${rules.id}, ${verdict.productName ?? "?"})`;
    out.push({ where, text: matchHeadline(verdict) });
    out.push({ where, text: clearSentence(verdict.clearCount, verdict.readComplete) });
    for (const note of verdict.notes) out.push({ where, text: note });
    for (const notice of verdict.allergens) out.push({ where, text: allergenSentence(notice) });
    for (const finding of [...verdict.blockers, ...verdict.flags, ...verdict.uncertain]) {
      out.push({ where: `${where}.because`, text: finding.because });
    }
  }

  return out.filter((s) => s.text.length > 0);
}

describe("§17 Rule 3 and §19 — no health claims, no diet framing", () => {
  const strings = everyUserFacingString();

  it("has enough copy to be worth linting", () => {
    // Guards the guard: a refactor that empties the collector would make every
    // assertion below pass while checking nothing.
    expect(strings.length).toBeGreaterThan(400);
  });

  it("names no disease and makes no health claim", () => {
    const offenders = strings.filter(({ text }) => MEDICAL_TERMS.some((t) => text.toLowerCase().includes(t)));
    expect(offenders.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });

  it("frames nothing as calories, weight, or virtue", () => {
    const offenders = strings.filter(({ text }) => DIET_AND_MORAL_TERMS.some((t) => text.toLowerCase().includes(t)));
    expect(offenders.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Rule 4 — no universal morality score                                        */
/* -------------------------------------------------------------------------- */

describe("§17 Rule 4 — compatibility is relative to the user's own rules", () => {
  it("attributes every blocker and flag to a rule the user set", () => {
    for (const { verdict, rules } of EVERY) {
      for (const finding of [...verdict.blockers, ...verdict.flags]) {
        expect(finding.ruleId, `${rules.id}: ${finding.ingredient}`).toBeTruthy();
        expect(rules.rules.map((r) => r.id)).toContain(finding.ruleId);
      }
    }
  });

  it("says whose decision it is, in every rule's own words", () => {
    for (const preset of ALL_PRESETS) {
      for (const rule of preset.rules) {
        expect(rule.because.toLowerCase(), `${preset.id}/${rule.id}`).toMatch(/\byou\b|\byour\b/);
      }
    }
  });

  it("finds nothing at all when the user has set no rules", () => {
    // §4: a verdict without rules is not a verdict. The app has no opinion of
    // its own to fall back on, and this is what that looks like.
    for (const label of LABELS) {
      const verdict = evaluate(label, presetByName("none")!);
      expect(verdict.blockers).toEqual([]);
      expect(verdict.flags).toEqual([]);
      expect(verdict.uncertain).toEqual([]);
      expect(verdict.allergens).toEqual([]);
    }
  });

  it("gives the same product different verdicts for different people", () => {
    // §4's key demonstration, asserted rather than assumed.
    const a = evaluate(FIXTURES["protein-bar"], presetByName("brief-user-a")!);
    const b = evaluate(FIXTURES["protein-bar"], presetByName("brief-user-b")!);
    expect(a.match).not.toBe(b.match);
    expect(a.blockers.map((f) => f.ingredient)).not.toEqual(b.blockers.map((f) => f.ingredient));
  });

  it("honours an explicit never-flag over a rule that would otherwise fire", () => {
    // §6's "Don't flag: seed oils". Without this the onboarding example
    // produces the opposite of what the user typed.
    const label = ParsedLabel.parse({
      category: "snack",
      ingredients: [{ text: "Sunflower Oil", legibility: "clear", readConfidence: 1, contains: [] }],
      containsStatement: [],
    });
    const withOptOut = evaluate(label, presetByName("brief-user-a")!);
    expect(withOptOut.blockers).toEqual([]);
    expect(withOptOut.flags).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Rule 5 — don't manufacture anxiety                                          */
/* -------------------------------------------------------------------------- */

describe("§17 Rule 5 — explain uncertainty rather than fill it with warnings", () => {
  it("leaves a plain label alone", () => {
    const verdict = evaluate(OAT_CRACKERS, presetByName("simple-ingredients")!);
    expect(verdict.blockers).toEqual([]);
    expect(verdict.flags).toEqual([]);
    expect(verdict.match).toBe(100);
  });

  it("gives an uncertain ingredient its own outcome, not a blocker", () => {
    for (const { verdict } of EVERY) {
      for (const finding of verdict.uncertain) {
        expect(finding.confidence).toBe("limited");
        expect(finding.outcome).not.toBe("blocker");
      }
    }
  });

  it("explains every uncertain finding rather than only marking it", () => {
    for (const { verdict } of EVERY) {
      for (const finding of verdict.uncertain) {
        expect(finding.because.length).toBeGreaterThan(20);
      }
    }
  });

  it("says something good about the losing product when there is something to say", () => {
    // §13 — this is one person choosing, not a competition between brands.
    const rules = presetByName("low-added-sugar")!;
    const result = compare(evaluate(FIXTURES["oat-crackers"], rules), evaluate(FIXTURES["rival-bar"], rules));
    expect(result.reasons.join(" ")).toMatch(/also has nothing|equally well/);
  });
});

/* -------------------------------------------------------------------------- */
/* Rule 6 — health data deserves heightened protection                         */
/* -------------------------------------------------------------------------- */

describe("§17 Rule 6 — minimise what is collected", () => {
  it("puts no rule content into a dispute record", async () => {
    const { raiseDispute } = await import("@/lib/feedback");
    const verdict = evaluate(FIXTURES["protein-bar"], presetByName("vegan")!);
    const blocker = verdict.blockers[0]!;
    const dispute = raiseDispute(verdict, "incorrect-rule-match", { finding: blocker });

    // The rule set contributes its id and nothing else. What somebody avoids is
    // the health-adjacent part, and it is not needed to fix a bad match.
    const serialised = JSON.stringify(dispute);
    expect(serialised).not.toContain("You asked us");
    expect(serialised).not.toContain("Animal-derived");
    expect(dispute.provenance.ruleSetId).toBe("vegan");
  });
});

/* -------------------------------------------------------------------------- */
/* §3 — the name, and reproducibility                                          */
/* -------------------------------------------------------------------------- */

describe("§3 — the dropped name stays dropped", () => {
  it("does not use a ruled-out name anywhere", async () => {
    const { readFile, glob } = await import("node:fs/promises");
    const path = await import("node:path");
    const src = path.join(process.cwd(), "src");

    const offenders: string[] = [];
    for await (const entry of glob("**/*.ts", { cwd: src })) {
      const file = entry as string;
      // `brand.ts` is where the decision is recorded, so it is the one file
      // that has to be able to name what was ruled out. Everywhere else the
      // rule is about behaviour, so comments are stripped before checking —
      // quoting the brief is not using the name.
      if (file === path.join("lib", "brand.ts")) continue;
      const text = (await readFile(path.join(src, file), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
      for (const name of RULED_OUT) {
        if (new RegExp(`\\b${name}\\b`, "i").test(text)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(WORDMARK).toBeTruthy();
    // The placeholder must not be one of the names the brief ruled out.
    expect(RULED_OUT.map((n) => n.toLowerCase())).not.toContain(WORDMARK.toLowerCase());
  });

  it("keeps the ruled-out name off every rendered card", () => {
    const verdict = evaluate(FIXTURES["protein-bar"], presetByName("vegan")!);
    for (const svg of [matchCard(verdict), shareCard(verdict)]) {
      for (const name of RULED_OUT) expect(svg.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });
});

describe("the verdict is reproducible", () => {
  it("produces the same verdict for the same label and rules, every time", () => {
    // §25 measures a verdict dispute rate, which means nothing if the verdict
    // drifts between runs.
    for (const { label, rules } of EVERY) {
      expect(JSON.stringify(evaluate(label, rules))).toBe(JSON.stringify(evaluate(label, rules)));
    }
  });

  it("records the engine, graph and rule-set versions on every verdict", () => {
    for (const { verdict } of EVERY) {
      expect(verdict.provenance.engineVersion).toBeTruthy();
      expect(verdict.provenance.knowledgeVersion).toBeTruthy();
      expect(verdict.provenance.ruleSetId).toBeTruthy();
    }
  });

  it("reproduces §8's worked example, and lands one point off it on purpose", () => {
    /**
     * §8 shows twenty ingredients, one blocker, two things to know, seventeen
     * clear, and prints 82%. This engine says 83%, and the difference is not
     * drift — it is the one place the brief's arithmetic and this engine's
     * disagree, so it is pinned rather than papered over.
     *
     * The brief's two "things to know" are not the same kind of thing: the
     * maltodextrin line is marked "High confidence" and the natural-flavours
     * line "Limited information". This engine credits an unresolvable
     * ingredient (0.70) slightly higher than a rule that definitely matched
     * (0.55), because §17 Rule 5 says uncertainty is not a conflict. Weighting
     * them identically would reproduce 82 exactly and would mean telling
     * somebody that "we couldn't check this" is as bad as "this breaks your
     * rule".
     *
     * If the scoring constants ever drift, this is what notices.
     */
    const label = ParsedLabel.parse({
      category: "snack",
      productName: "Worked example",
      ingredients: [
        { text: "Sunflower Oil", legibility: "clear", readConfidence: 1, contains: [] },
        { text: "Natural Flavors", legibility: "clear", readConfidence: 1, contains: [] },
        { text: "Maltodextrin", legibility: "clear", readConfidence: 1, contains: [] },
        ...Array.from({ length: 17 }, (_, i) => ({
          text: `Filler ${i}`,
          legibility: "clear" as const,
          readConfidence: 1,
          contains: [],
        })),
      ],
      containsStatement: [],
    });
    const rules = presetByName("avoid-seed-oils")!;
    const withStarch = {
      ...rules,
      rules: [
        ...rules.rules,
        {
          id: "flag-starch",
          kind: "flag" as const,
          target: { kind: "class" as const, value: "starch-refined" as const },
          label: "Refined starches",
          because: "You asked us to flag rapidly absorbed added carbohydrates.",
          origin: "preset" as const,
          allergen: false,
        },
      ],
    };
    const verdict = evaluate(label, withStarch);
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.flags.length + verdict.uncertain.length).toBe(2);
    expect(verdict.clearCount).toBe(17);
    expect(verdict.match).toBe(83);
  });
});

describe("the cards carry what the verdict carries", () => {
  it("never prints a percentage the verdict does not have", () => {
    for (const { verdict, rules } of EVERY) {
      for (const svg of [matchCard(verdict), shareCard(verdict)]) {
        if (verdict.match === null) {
          expect(svg, rules.id).toContain("NO MATCH SCORE");
          expect(svg, rules.id).not.toMatch(/>\d+%</);
        } else {
          expect(svg, rules.id).toContain(`${verdict.match}%`);
        }
      }
    }
  });

  it("names the rules on every card", () => {
    const rules = presetByName("vegan")!;
    const a = evaluate(FIXTURES["protein-bar"], rules);
    const b = evaluate(FIXTURES["rival-bar"], rules);
    expect(matchCard(a)).toContain(rules.label);
    expect(shareCard(a)).toContain(rules.label);
    expect(compareCard(compare(a, b))).toContain(rules.label);
  });
});
