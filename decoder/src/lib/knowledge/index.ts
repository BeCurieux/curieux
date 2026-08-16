/**
 * Matching label text to knowledge-base entries.
 *
 * Two failure modes, pulling in opposite directions, and both are the product
 * dying:
 *
 * - **Missing a match** on an allergen is the harmed child in BRIEF.md §10.1.
 * - **A wrong match** is the confidently-wrong screenshot in §6 — and the
 *   cheapest way to generate one is a substring search, where `coconut milk`
 *   reads as dairy and `cocoa butter` reads as dairy and every plant-based
 *   product on the shelf lights up red for a milk allergy.
 *
 * So matching is whole-token and exact after normalisation — never fuzzy, never
 * a substring — and a small table of exceptions blocks the compound terms that
 * contain an entry's name while meaning something else.
 */

import { KnowledgeEntry } from "@/lib/schema";
import { ENTRIES } from "@/lib/knowledge/entries";

export { KNOWLEDGE_VERSION, PROPRIETARY_BLEND_CAVEAT, PROPRIETARY_BLEND_SOURCE, FLAVOR_SOURCE } from "@/lib/knowledge/entries";

/**
 * Validated once at module load. A malformed entry — a red flag with no source,
 * a red flag with nothing to look for instead — fails here rather than at the
 * moment somebody photographs a label.
 */
export const KNOWLEDGE: KnowledgeEntry[] = ENTRIES.map((entry) => KnowledgeEntry.parse(entry));

/**
 * Compound terms that contain an entry's name but are not that entry.
 *
 * Every line here is a false positive somebody would otherwise screenshot.
 * `coconut milk` is not dairy; `cocoa butter` is not dairy; `milk thistle` is a
 * plant. The blocked entry is named explicitly rather than inferred, because a
 * clever rule here would be a new way to be wrong.
 */
const EXCEPTIONS: { phrase: string; blocks: string[] }[] = [
  { phrase: "coconut milk", blocks: ["milk"] },
  { phrase: "coconut cream", blocks: ["milk"] },
  { phrase: "coconut butter", blocks: ["milk"] },
  { phrase: "almond milk", blocks: ["milk"] },
  { phrase: "oat milk", blocks: ["milk"] },
  { phrase: "soy milk", blocks: ["milk"] },
  { phrase: "soya milk", blocks: ["milk"] },
  { phrase: "rice milk", blocks: ["milk"] },
  { phrase: "cashew milk", blocks: ["milk"] },
  { phrase: "hemp milk", blocks: ["milk"] },
  { phrase: "pea milk", blocks: ["milk"] },
  { phrase: "hazelnut milk", blocks: ["milk"] },
  { phrase: "milk thistle", blocks: ["milk"] },
  { phrase: "cocoa butter", blocks: ["milk"] },
  { phrase: "shea butter", blocks: ["milk"] },
  { phrase: "apple butter", blocks: ["milk"] },
  { phrase: "peanut butter", blocks: ["milk"] },
  { phrase: "almond butter", blocks: ["milk"] },
  { phrase: "cashew butter", blocks: ["milk"] },
  { phrase: "sunflower butter", blocks: ["milk"] },
  { phrase: "sunflower seed butter", blocks: ["milk"] },
  { phrase: "butterfly pea", blocks: ["milk"] },
  { phrase: "butternut", blocks: ["milk"] },
  { phrase: "cauliflower", blocks: ["wheat"] },
  { phrase: "buckwheat", blocks: ["wheat"] },
  { phrase: "coconut flour", blocks: ["wheat"] },
  { phrase: "almond flour", blocks: ["wheat"] },
  { phrase: "rice flour", blocks: ["wheat"] },
  { phrase: "corn flour", blocks: ["wheat"] },
  { phrase: "chickpea flour", blocks: ["wheat"] },
  { phrase: "oat flour", blocks: ["wheat"] },
  { phrase: "tapioca flour", blocks: ["wheat"] },
  { phrase: "cassava flour", blocks: ["wheat"] },
  { phrase: "nutmeg", blocks: ["tree-nut"] },
  { phrase: "water chestnut", blocks: ["tree-nut"] },
  { phrase: "shea nut", blocks: ["tree-nut"] },
  { phrase: "palm sugar", blocks: ["sugar"] },
  { phrase: "sugar alcohol", blocks: ["sugar"] },
  { phrase: "sugar cane fiber", blocks: ["sugar"] },
  { phrase: "no sugar added", blocks: ["sugar"] },
  { phrase: "olive oil", blocks: ["seed-oil"] },
  { phrase: "avocado oil", blocks: ["seed-oil"] },
  { phrase: "coconut oil", blocks: ["seed-oil"] },
  { phrase: "palm oil", blocks: ["seed-oil"] },
  { phrase: "sesame oil", blocks: ["seed-oil"] },
  { phrase: "flaxseed oil", blocks: ["seed-oil"] },
  { phrase: "fish oil", blocks: ["seed-oil"] },
  { phrase: "mct oil", blocks: ["seed-oil"] },
  // "Non-alcoholic" and "alcohol-free" are the label saying the opposite of
  // what the token says.
  { phrase: "non alcoholic", blocks: ["alcohol"] },
  { phrase: "nonalcoholic", blocks: ["alcohol"] },
  { phrase: "alcohol free", blocks: ["alcohol"] },
  { phrase: "sugar alcohols", blocks: ["alcohol"] },
  { phrase: "cetyl alcohol", blocks: ["alcohol"] },
  { phrase: "stearyl alcohol", blocks: ["alcohol"] },
];

/** Qualifiers that sit in front of an ingredient without changing what it is. */
const QUALIFIERS = new Set([
  "organic",
  "certified",
  "raw",
  "pure",
  "natural",
  "unbleached",
  "expeller",
  "pressed",
  "cold",
  "roasted",
  "dried",
  "dehydrated",
  "powdered",
  "ground",
  "whole",
  "fresh",
  "non",
  "gmo",
  "gmo-free",
  "unsweetened",
  "refined",
  "unrefined",
  "filtered",
  "concentrated",
  "granulated",
]);

/**
 * Lowercase, drop punctuation, and fold a trailing plural `s` on tokens of four
 * characters or more.
 *
 * The fold is applied to entry names and to label text by the same function, so
 * it cannot make the two disagree: `molasses` becomes `molasse` on both sides
 * and still matches itself, while `flavors` and `flavor` meet in the middle.
 */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token.length >= 4 && token.endsWith("s") ? token.slice(0, -1) : token));
}

/** Does `needle` appear as a run of whole tokens inside `haystack`? */
function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let hit = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

/** Names, pre-tokenised once. Longest first, so the specific entry wins. */
const INDEX = KNOWLEDGE.flatMap((entry) => {
  const names = entry.names.map((name) => ({ entry, tokens: tokenise(name) }));
  const eNumber = entry.eNumber ? [{ entry, tokens: tokenise(entry.eNumber) }] : [];
  return [...names, ...eNumber];
}).sort((a, b) => b.tokens.length - a.tokens.length);

const EXCEPTION_INDEX = EXCEPTIONS.map((e) => ({ tokens: tokenise(e.phrase), blocks: e.blocks }));

export type Match = {
  entry: KnowledgeEntry;
  /** The name that matched, for showing the user why. */
  matchedOn: string;
};

/**
 * Every entry this piece of label text refers to.
 *
 * More than one is normal and correct: `soy lecithin` is both the lecithin
 * entry (which carries the seed-oil nuance) and the soy entry (which carries
 * the allergen). The scorer collapses the duplicate concerns; the matcher's job
 * is not to lose either.
 */
export function match(text: string): Match[] {
  const tokens = tokenise(text);
  if (tokens.length === 0) return [];

  const blocked = new Set<string>();
  for (const exception of EXCEPTION_INDEX) {
    if (containsRun(tokens, exception.tokens)) {
      for (const id of exception.blocks) blocked.add(id);
    }
  }

  // Qualifiers are dropped only from the front. Stripping them anywhere would
  // turn "natural flavors" into "flavors" and lose the umbrella entry.
  let head = 0;
  while (head < tokens.length - 1 && QUALIFIERS.has(tokens[head] as string)) head += 1;
  const stripped = tokens.slice(head);

  const found = new Map<string, Match>();
  for (const candidate of INDEX) {
    if (blocked.has(candidate.entry.id)) continue;
    if (found.has(candidate.entry.id)) continue;
    if (containsRun(tokens, candidate.tokens) || containsRun(stripped, candidate.tokens)) {
      found.set(candidate.entry.id, {
        entry: candidate.entry,
        matchedOn: candidate.tokens.join(" "),
      });
    }
  }
  return [...found.values()];
}

/** Lookup by id, for tests and for rendering a flag's entry. */
export function entryById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE.find((entry) => entry.id === id);
}
