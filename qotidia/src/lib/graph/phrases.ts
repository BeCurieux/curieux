// The words a child says.
//
// The most affecting thing this product can notice is a phrase that stopped.
// A three-year-old calls bananas "nanas" for eight months and then one day
// doesn't, and nobody writes down the day it changed because nobody notices
// it changing. An archive that counts can.
//
// Which makes the extraction rule strict: **only what the child was recorded
// as saying.** Quotes and transcribed voice, never a parent's description of
// them. "She's started saying nanas" is the parent's sentence; "nanas" in a
// quote is the child's. The whole line depends on that difference, because
// the sentence we eventually produce puts the words in quotation marks and
// attributes them to a three-year-old.
//
// No dictionary and no cleverness. A phrase is a run of words that turns up
// in three or more separate things the child said — which is arithmetic, and
// which is why it can be said out loud.

/**
 * Words too ordinary to be anybody's phrase.
 *
 * A judgement, but a linguistic one rather than a claim about a family:
 * "the" recurring is a fact about English. Deliberately short — an
 * aggressive list would filter out the small words that make a toddler's
 * phrasing recognisable, and "I do it my byself" is mostly small words.
 */
const ORDINARY = new Set([
  "a", "an", "and", "the", "is", "it", "in", "on", "at", "of", "to", "for",
  "was", "were", "be", "been", "am", "are", "this", "that", "there", "here",
  "with", "but", "or", "so", "if", "then", "than", "as", "we", "he", "she",
  "they", "them", "his", "her", "their", "our", "its",
]);

/** Longest run of words treated as one phrase. */
export const MAX_WORDS = 4;

/**
 * A phrase as it will be matched: lower case, no punctuation, single spaces.
 *
 * Apostrophes survive, because "don't" and "dont" are the same phrase and
 * "byself" is not "by self".
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every run of words in one thing the child said.
 *
 * Runs of every length up to MAX_WORDS, because the phrase worth noticing is
 * as often "under under" as it is a single coinage, and there is no way to
 * know in advance which. What separates signal from noise here is not
 * cleverness at this step — it is the requirement, applied later, that the
 * same run turn up in three separate quotes.
 *
 * A run made entirely of ordinary words is dropped. "I do it" survives
 * because "do" is not on the list; "and the" does not.
 */
export function runsIn(text: string): string[] {
  const words = normalise(text).split(" ").filter(Boolean);
  const out = new Set<string>();

  for (let n = 1; n <= MAX_WORDS; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const run = words.slice(i, i + n);
      if (run.every((w) => ORDINARY.has(w))) continue;
      out.add(run.join(" "));
    }
  }

  return [...out];
}

/**
 * The phrase as it was actually said, for display.
 *
 * We match on the normalised run and show the original, so a line quotes the
 * child rather than quoting our lower-cased reduction of the child. Falls
 * back to the run itself when the original cannot be located — better a
 * plain-looking phrase than a wrong one.
 */
export function asSaid(run: string, source: string): string {
  const words = source.split(/(\s+)/);
  const wanted = run.split(" ");

  for (let i = 0; i < words.length; i++) {
    const window: string[] = [];
    let j = i;
    while (j < words.length && window.length < wanted.length) {
      if (words[j].trim()) window.push(words[j]);
      j++;
    }
    if (window.length < wanted.length) break;
    if (normalise(window.join(" ")) === run) {
      return window.join(" ").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
    }
  }

  return run;
}
