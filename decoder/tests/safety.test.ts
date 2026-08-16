/**
 * BRIEF.md §10, as a test.
 *
 * Every rule in §10 is described as non-negotiable, and a non-negotiable rule
 * that lives only in a prompt or a code review is a rule that survives until
 * the first busy afternoon. So each one is asserted here, over the real
 * knowledge base and the real engine, against the labels most likely to break
 * it.
 *
 * If something in this file goes red, the fix is never to relax the assertion.
 */

import { describe, expect, it } from "vitest";
import { KNOWLEDGE } from "@/lib/knowledge";
import { PROFILES } from "@/lib/profile";
import { FIXTURES, HALF_READ_LABEL, PLAIN_OAT_CRACKERS } from "@/lib/fixtures";
import { verdictFor } from "@/lib/verdict/score";
import {
  ALLERGEN_PREAMBLE,
  FORBIDDEN_ALLERGEN_WORDS,
  allergenSentence,
  scoreHeadline,
} from "@/lib/verdict/language";
import { shareCard, verdictScreen } from "@/lib/render/card";
import { Allergen, type ParsedLabel } from "@/lib/schema";

const ALL_PROFILES = Object.values(PROFILES);
const ALL_LABELS = Object.values(FIXTURES);

/* -------------------------------------------------------------------------- */
/* §10.1 — never certify safety for an allergen                                */
/* -------------------------------------------------------------------------- */

describe("§10.1 — the app never certifies an allergen", () => {
  it("has no reassuring word in any allergen sentence, in any state", () => {
    for (const allergen of Allergen.options) {
      for (const state of ["flagged", "not-flagged", "cannot-verify"] as const) {
        const sentence = allergenSentence({
          allergen,
          state,
          matches: state === "flagged" ? ["Whey Protein"] : [],
          because: state === "cannot-verify" ? "part of the list is out of frame" : null,
        }).toLowerCase();

        for (const word of FORBIDDEN_ALLERGEN_WORDS) {
          expect(sentence, `"${sentence}" must not contain "${word}"`).not.toContain(word);
        }
      }
    }
  });

  it("says something about every allergen on the profile, on every label", () => {
    // The rule that cannot be satisfied by an absence. A user with a peanut
    // allergy gets a sentence about peanuts on every scan — including the
    // scans where nothing was found, which are the ones where a missing
    // sentence would read as reassurance.
    for (const profile of ALL_PROFILES) {
      for (const label of ALL_LABELS) {
        const verdict = verdictFor(label, profile);
        expect(verdict.allergens.map((a) => a.allergen).sort()).toEqual([...profile.allergens].sort());
      }
    }
  });

  it("never says not-flagged when the label was not fully read", () => {
    // The specific way this rule dies: an unreadable label produces a short
    // clean ingredient list, nothing matches, and the absence reads as safety.
    const verdict = verdictFor(HALF_READ_LABEL, PROFILES["allergy-household"]!);
    expect(verdict.allergens.length).toBeGreaterThan(0);
    for (const finding of verdict.allergens) {
      expect(finding.state).toBe("cannot-verify");
      expect(finding.because).toBeTruthy();
    }
  });

  it("withholds the score entirely when the ingredient set is unknown", () => {
    // Not merely a caveat under a number. The number is what gets screenshotted,
    // so on an unreadable label there is no number.
    for (const profile of ALL_PROFILES) {
      const verdict = verdictFor(HALF_READ_LABEL, profile);
      expect(verdict.score).toBeNull();
      expect(scoreHeadline(verdict.score, verdict.category)).not.toMatch(/nothing flagged/i);
    }
  });

  it("counts no illegible ingredient as having checked out", () => {
    const verdict = verdictFor(HALF_READ_LABEL, PROFILES["clean-label"]!);
    const legible = HALF_READ_LABEL.ingredients.filter((i) => i.legibility === "clear").length;
    expect(verdict.clearedCount).toBeLessThanOrEqual(legible);
  });

  it("puts the preamble and every allergen sentence on the rendered cards", () => {
    // A finding the engine produces and the card drops is the same bug one
    // layer down.
    const verdict = verdictFor(FIXTURES["protein-biscuit"], PROFILES["dairy-egg-household"]!);
    for (const svg of [verdictScreen(verdict), shareCard(verdict)]) {
      expect(svg).toContain(ALLERGEN_PREAMBLE.slice(0, 40));
      for (const finding of verdict.allergens) {
        // The sentence is XML-escaped in the SVG, so compare on the first clause.
        expect(svg).toContain(allergenSentence(finding).split(" —")[0]!.split(".")[0]!);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* §10.2 and §10.4 — no medical claims, no weight-loss framing                 */
/* -------------------------------------------------------------------------- */

/**
 * Words that turn a label reading into a health claim.
 *
 * The list is blunt on purpose. A knowledge-base entry that genuinely needs one
 * of these words is an entry making a claim the brief forbids — "linked to
 * cancer" is named in §10.2 as both an App Store rejection and an FTC problem —
 * and the correct response to a red run here is to rewrite the entry, not to
 * add an exception.
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
  "inflammation",
  "carcinogenic",
  "toxic",
  "poison",
  "damages",
  "causes ",
  "cures",
  "treats",
  "prevents",
];

/** §10.4 and §10.3 — not a weight-loss tool, and never a judgement of a person. */
const DIET_AND_MORAL_TERMS = [
  "calorie",
  "kcal",
  "fattening",
  "slimming",
  "weight loss",
  "guilt-free",
  "guilt free",
  "sinful",
  "cheat day",
  "cheat meal",
  "naughty",
  "bad for you",
  "junk",
  "clean eating",
  "detox",
  "superfood",
  "should not eat",
  "shouldn't eat",
  "don't eat",
];

/** Every string the product can put in front of a user, from the real data. */
function everyUserFacingString(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];

  for (const entry of KNOWLEDGE) {
    out.push({ where: `${entry.id}.plain`, text: entry.plain });
    if (entry.umbrellaNote) out.push({ where: `${entry.id}.umbrellaNote`, text: entry.umbrellaNote });
    for (const [i, concern] of entry.concerns.entries()) {
      out.push({ where: `${entry.id}.concerns[${i}].note`, text: concern.note });
      if (concern.lookFor) out.push({ where: `${entry.id}.concerns[${i}].lookFor`, text: concern.lookFor });
      for (const [j, source] of concern.sources.entries()) {
        out.push({ where: `${entry.id}.concerns[${i}].sources[${j}].cite`, text: source.cite });
      }
    }
  }

  for (const profile of ALL_PROFILES) {
    for (const label of ALL_LABELS) {
      const verdict = verdictFor(label, profile);
      const where = `verdict(${profile.id}, ${verdict.productName ?? "?"})`;
      out.push({ where, text: scoreHeadline(verdict.score, verdict.category) });
      for (const caveat of verdict.caveats) out.push({ where, text: caveat });
      for (const finding of verdict.allergens) out.push({ where, text: allergenSentence(finding) });
      for (const flag of verdict.flags) {
        out.push({ where: `${where}.reason`, text: flag.reason });
      }
    }
  }

  return out;
}

describe("§10.2 and §10.4 — no medical claims, no diet framing", () => {
  const strings = everyUserFacingString();

  it("has enough copy to be worth linting", () => {
    // Guards the guard: a refactor that empties the collector would make every
    // assertion below pass while checking nothing.
    expect(strings.length).toBeGreaterThan(200);
  });

  it("names no disease and makes no health claim", () => {
    const offenders = strings.filter(({ text }) =>
      MEDICAL_TERMS.some((term) => text.toLowerCase().includes(term)),
    );
    expect(offenders.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });

  it("frames nothing as calories, weight, or virtue", () => {
    const offenders = strings.filter(({ text }) =>
      DIET_AND_MORAL_TERMS.some((term) => text.toLowerCase().includes(term)),
    );
    expect(offenders.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* §10.3 — inform, don't farm anxiety                                          */
/* -------------------------------------------------------------------------- */

describe("§10.3 — a translator, not a judge", () => {
  it("gives every red flag something to look for instead", () => {
    for (const profile of ALL_PROFILES) {
      for (const label of ALL_LABELS) {
        for (const flag of verdictFor(label, profile).flags) {
          if (flag.severity !== "red") continue;
          expect(flag.lookFor, `${flag.ingredient} for ${profile.id}`).toBeTruthy();
        }
      }
    }
  });

  it("cites a source on every red flag that claims anything about the world", () => {
    for (const entry of KNOWLEDGE) {
      for (const concern of entry.concerns) {
        if (concern.severity !== "red") continue;
        if (concern.strength === "preference") continue;
        expect(concern.sources.length, `${entry.id} / ${concern.axis.kind}`).toBeGreaterThan(0);
      }
    }
  });

  it("names the category in every headline, so nothing is scored against broccoli", () => {
    for (const label of ALL_LABELS) {
      for (const profile of ALL_PROFILES) {
        const verdict = verdictFor(label, profile);
        if (verdict.score === null) continue;
        expect(scoreHeadline(verdict.score, verdict.category)).toMatch(/for a /);
      }
    }
  });

  it("does not alarm a plain label", () => {
    // The other half of §10.3. A product that reds everything is the anxiety
    // machine, and the check that catches it is a short honest label scoring
    // well for a profile that avoids a great deal.
    const verdict = verdictFor(PLAIN_OAT_CRACKERS, PROFILES["clean-label"]!);
    expect(verdict.flags).toEqual([]);
    expect(verdict.score).toBe(100);
  });

  it("scores an expected ingredient more gently in its own category", () => {
    const sugary = (category: ParsedLabel["category"]): ParsedLabel => ({
      category,
      productName: null,
      ingredients: [{ text: "Sugar", legibility: "clear", readConfidence: 1, contains: [] }],
      containsStatement: [],
      truncated: false,
      note: null,
    });

    const sweet = verdictFor(sugary("confectionery"), PROFILES["keto"]!);
    const sauce = verdictFor(sugary("condiment"), PROFILES["keto"]!);
    expect(sweet.score!).toBeGreaterThan(sauce.score!);
  });
});

/* -------------------------------------------------------------------------- */
/* §10.5 and §6 — the disclaimer, and determinism                              */
/* -------------------------------------------------------------------------- */

describe("the verdict is reproducible", () => {
  it("produces the same verdict for the same label and profile, every time", () => {
    // §6: "Trust is the entire product." A score that moves between runs cannot
    // be defended when somebody screenshots two of them.
    for (const label of ALL_LABELS) {
      for (const profile of ALL_PROFILES) {
        const a = verdictFor(label, profile);
        const b = verdictFor(label, profile);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it("records the engine and knowledge versions on every verdict", () => {
    const verdict = verdictFor(FIXTURES["rainbow-snack"], PROFILES["clean-label"]!);
    expect(verdict.provenance.engineVersion).toBeTruthy();
    expect(verdict.provenance.knowledgeVersion).toBeTruthy();
  });
});
