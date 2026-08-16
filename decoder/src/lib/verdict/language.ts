/**
 * Every sentence the verdict can say, in one file.
 *
 * BRIEF.md §13 gives the vocabulary and §17 gives the rules, and both are the
 * kind of thing that erodes one convenient phrase at a time. Putting the
 * sentences here means there is exactly one place they can erode and one place
 * `tests/safety.test.ts` has to watch.
 *
 * §13, verbatim on what is never said:
 *
 * > BAD FOOD · TOXIC · DANGEROUS · GUILT-FREE · SIN · NEVER EAT THIS
 */

import type { AllergenNotice, Category, Finding, Verdict } from "@/lib/schema";

/* -------------------------------------------------------------------------- */
/* §17 Rule 1 — never certify allergen safety                                  */
/* -------------------------------------------------------------------------- */

/**
 * Words that must never appear in a sentence about a declared allergen.
 *
 * "Safe" and "free" are obvious. "Clear", "fine" and "OK" are here because they
 * are what a sentence drifts into when somebody is trying to avoid saying
 * "safe" — the reassurance survives the word swap, and the reassurance is the
 * thing that is not ours to give. §17 Rule 1 is explicit that absence from OCR
 * is not proof of anything.
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
  "none found",
  "no problem",
];

/**
 * §8's example, near enough verbatim:
 *
 * > ⚠️ PEANUT LISTED
 * > Peanuts appear in this ingredient list.
 * > We can't determine cross-contact or certify this product as safe for an allergy.
 */
/**
 * The short heading for a declared allergen — §8's "⚠️ PEANUT LISTED".
 *
 * Kept separate from the sentence so the card can shout the four words that
 * matter and then speak normally. Setting the whole sentence in capitals reads
 * as alarm rather than as information, which §17 Rule 5 rules out.
 */
export function allergenHeading(notice: AllergenNotice): string {
  return `${notice.label} listed`.toUpperCase();
}

/** Where it was found. Empty when there is nothing more to say. */
export function allergenDetail(notice: AllergenNotice): string {
  if (notice.state !== "listed" || notice.matches.length === 0) return "";
  return `Appears in: ${notice.matches.join(", ")}.`;
}

export function allergenSentence(notice: AllergenNotice): string {
  switch (notice.state) {
    case "listed": {
      const where = notice.matches.length > 0 ? ` — ${notice.matches.join(", ")}` : "";
      return `${notice.label} listed on this label${where}.`;
    }
    case "cannot-check":
      return `${notice.label}: we couldn't read enough of this label to check${notice.because ? ` — ${notice.because}` : ""}.`;
    case "not-listed-in-what-we-read":
      // The whole rule in one sentence. It reports what the text said, and it
      // declines to draw the conclusion the reader wants drawn. The state is
      // named for what it is so that no future refactor can shorten it to
      // "not-listed" and quietly change the meaning.
      return `${notice.label}: not listed in the text we could read.`;
  }
}

/** Sits under the allergen block, at full size rather than as small print. */
export const ALLERGEN_PREAMBLE =
  "We can't determine cross-contact, and we can't certify any product as safe for an allergy. Always check the packaging itself.";

/**
 * Why an umbrella term does not, by itself, hide a declared allergen.
 *
 * US labelling requires the nine major allergens to be declared even inside a
 * collective term like "natural flavors". That is a fact about the rules rather
 * than about this packet, and §2 points the product squarely at imported
 * products where those rules do not apply — so it is said out loud rather than
 * relied on silently.
 */
export const UMBRELLA_ALLERGEN_NOTE =
  'US labels must declare the nine major allergens even inside terms like "natural flavors" — but that is a US rule, and imported packaging may not follow it.';

/* -------------------------------------------------------------------------- */
/* §17 Rule 2 — uncertainty is not absence                                     */
/* -------------------------------------------------------------------------- */

/**
 * §17 Rule 2, verbatim:
 *
 * > Never say: No problem ingredients
 * > Say: No conflicts found in the text we could identify.
 *
 * The difference is the whole rule. The first sentence is a claim about the
 * product; the second is a claim about what we read, which is the only thing we
 * are in a position to claim.
 */
export function clearSentence(count: number, readComplete: boolean): string {
  if (count === 0) return "";
  const noun = count === 1 ? "1 other ingredient" : `${count} other ingredients`;
  return readComplete
    ? `${noun} — no conflicts found with your current rules.`
    : `${noun} — no conflicts found in the text we could read.`;
}

/** §8 Step 2 — "Never silently guess." */
export const VERIFY_PROMPT = "We couldn't read part of this label clearly. Retake the photo, or confirm the ingredients yourself.";

/* -------------------------------------------------------------------------- */
/* The match headline                                                          */
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

export function categoryNoun(category: Category): string {
  return CATEGORY_NOUN[category];
}

/**
 * The line under the percentage.
 *
 * §13: a translator and a rule checker, not a food morality system. So the
 * sentence describes the *fit between a label and a rule set* and never the
 * food — there is no "good", no "bad", no "healthy", and nothing that reads as
 * praise or permission. §17 Rule 4 is why: the app has no universal opinion to
 * express, only the user's rules to apply.
 */
export function matchHeadline(verdict: Pick<Verdict, "match" | "blockers" | "flags" | "uncertain">): string {
  if (verdict.match === null) return "Not enough of this label could be read to score it";

  const b = verdict.blockers.length;
  const f = verdict.flags.length + verdict.uncertain.length;

  if (b === 0 && f === 0) return "No conflicts with your rules";
  if (b === 0) return f === 1 ? "No blockers · 1 thing to know" : `No blockers · ${f} things to know`;

  const blockerPart = b === 1 ? "1 blocker" : `${b} blockers`;
  if (f === 0) return blockerPart;
  return f === 1 ? `${blockerPart} · 1 thing to know` : `${blockerPart} · ${f} things to know`;
}

/** §8's "High confidence" / "Limited information". */
export function confidenceWord(finding: Finding): string {
  return finding.confidence === "high" ? "High confidence" : "Limited information";
}

/** What the percentage is and is not. On the card, not in a settings screen. */
export const MATCH_FOOTNOTE =
  "How well this label matches the rules you set. It isn't a health score, and it says nothing about anyone else's rules.";

/**
 * §8 Step 2 and §17 Rule 2 — shown at the top when the read was not complete.
 * The share card is the screen most likely to be seen by somebody who did not
 * take the photograph and cannot ask what the missing part said.
 */
export function incompleteBanner(verdict: Verdict): string | null {
  if (verdict.match === null) {
    return "Part of this label couldn't be read, so there's no match score. What follows is only what we could read.";
  }
  if (!verdict.readComplete) return "Some print on this label was hard to read — worth checking anything below.";
  return null;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
