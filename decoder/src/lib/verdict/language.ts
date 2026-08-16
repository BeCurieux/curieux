/**
 * Every sentence the verdict can say about an allergen, and the score wording.
 *
 * This file exists so that BRIEF.md §10.1 has exactly one place it can be
 * broken, and one place a test can watch:
 *
 * > "The app flags ingredients to check; it never says 'safe for your peanut
 * > allergy.' … Verdict language for allergy profiles is always 'flagged / not
 * > flagged on this label — always verify the packaging.'"
 *
 * Nothing else in the codebase composes an allergen sentence. If a renderer
 * wants to say something about an allergen it asks here, and what it gets back
 * is a sentence that has been through `tests/safety.test.ts`.
 */

import type { AllergenFinding, Category, Verdict } from "@/lib/schema";

/**
 * Words that must never appear in a sentence about an allergen.
 *
 * "Safe" and "free" are the obvious ones. "Clear", "fine" and "OK" are here
 * because they are what a sentence drifts into when somebody is trying to
 * avoid saying "safe" — the reassurance survives the word swap, and the
 * reassurance is the thing that is not ours to give.
 */
export const FORBIDDEN_ALLERGEN_WORDS = [
  "safe",
  "free from",
  "free of",
  "-free",
  "no risk",
  "risk-free",
  "guaranteed",
  "clear",
  "fine",
  "okay",
  "you can eat",
  "suitable for",
  "does not contain",
  "doesn't contain",
  "contains no",
];

const READABLE: Record<string, string> = {
  "tree-nut": "tree nuts",
  peanut: "peanuts",
  milk: "milk",
  egg: "egg",
  fish: "fish",
  shellfish: "shellfish",
  wheat: "wheat",
  soy: "soy",
  sesame: "sesame",
};

/** The sentence shown for one allergen on one scan. */
export function allergenSentence(finding: AllergenFinding): string {
  const name = READABLE[finding.allergen] ?? finding.allergen;
  switch (finding.state) {
    case "flagged": {
      const where = finding.matches.length > 0 ? ` — ${finding.matches.join(", ")}` : "";
      return `${capitalise(name)}: flagged on this label${where}.`;
    }
    case "cannot-verify":
      return `${capitalise(name)}: cannot be checked from this photograph${finding.because ? ` — ${finding.because}` : ""}.`;
    case "not-flagged":
      // The whole rule, in one sentence. It reports what the label did, and it
      // does not draw the conclusion the reader wants drawn.
      return `${capitalise(name)}: not flagged on this label. Always verify the packaging.`;
  }
}

/**
 * The line that sits above every allergen block. It is not a disclaimer in the
 * small-print sense — it is the reason the block is phrased the way it is, and
 * it renders at the same size as the findings.
 */
export const ALLERGEN_PREAMBLE =
  "This is a reading of one photograph of one label. Labels change, print gets missed, and cross-contamination is never on the label at all.";

/**
 * Why an umbrella term does not, by itself, make an allergen unverifiable.
 *
 * US labelling requires the nine major allergens to be declared even when they
 * arrive inside a collective term like "natural flavors" — so a compliant US
 * label with an umbrella term is not hiding a major allergen behind it. That is
 * a fact about the rules rather than about this packet, and §2 of the brief
 * points the product squarely at imported products where those rules do not
 * apply, so it is said out loud rather than relied on silently.
 */
export const UMBRELLA_ALLERGEN_CAVEAT =
  "US labels must declare the nine major allergens even inside terms like \"natural flavors\" — but that is a US rule, and imported packaging may not follow it.";

/* -------------------------------------------------------------------------- */
/* Score wording                                                               */
/* -------------------------------------------------------------------------- */

const CATEGORY_NOUN: Record<Category, string> = {
  snack: "snack",
  confectionery: "sweet",
  beverage: "drink",
  dairy: "dairy product",
  bakery: "baked product",
  condiment: "condiment",
  "ready-meal": "ready meal",
  cereal: "cereal",
  supplement: "supplement",
  "menu-item": "menu item",
  unknown: "product",
};

/**
 * The headline above the score.
 *
 * §10.3: the app is a translator, not a judge. So the wording describes the
 * label and the profile, never the food and never the person. There is no
 * "good", no "bad", no "healthy", and nothing that would read as praise or
 * permission.
 *
 * It always names the category, because a score with no category is the
 * cross-category comparison the same section rules out.
 */
export function scoreHeadline(score: number | null, category: Category): string {
  const noun = CATEGORY_NOUN[category];
  // No score is its own headline, and it says what happened rather than
  // reaching for a number. "Nothing flagged for you" on a label that was never
  // fully read is the sentence that ends the company.
  if (score === null) return `Not enough of this label could be read to score it`;
  if (score >= 85) return `Nothing flagged for you, for a ${noun}`;
  if (score >= 65) return `A couple of things to know, for a ${noun}`;
  if (score >= 40) return `Several things you avoid, for a ${noun}`;
  return `A lot here you avoid, for a ${noun}`;
}

/** The "everything else checks out" line from §6, made accurate. */
export function clearedSentence(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "1 other ingredient — nothing flagged for your profile.";
  return `${count} other ingredients — nothing flagged for your profile.`;
}

/** What the score is and is not, said on the card rather than in a settings screen. */
export const SCORE_FOOTNOTE =
  "Scored against other products in the same category, using the profile you set. It is not a health rating.";

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The single line a share card carries when anything was unreadable. §6 again:
 * where the model cannot verify, it says so — and the share card is the screen
 * most likely to be seen by somebody who did not take the photograph.
 */
export function incompleteBanner(verdict: Verdict): string | null {
  if (verdict.score === null) {
    return "Part of this label could not be read, so there is no score for it. What follows is only what was legible.";
  }
  if (!verdict.incomplete) return null;
  return "Some print on this label was hard to read — check anything below that looks wrong.";
}
