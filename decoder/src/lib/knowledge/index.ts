/**
 * Matching label text to entries in the graph.
 *
 * Two failure modes pull in opposite directions and both are the product dying:
 *
 * - **Missing a match.** For an allergen rule that is BRIEF.md §17 Rule 1's
 *   territory; for any other rule it is a verdict that quietly answers the
 *   wrong question.
 * - **A wrong match.** §25 makes verdict dispute rate a first-class metric, and
 *   the cheapest way to inflate it is a substring search, where `coconut milk`
 *   reads as dairy and every plant-based product on the shelf lights up for a
 *   milk rule.
 *
 * So matching is whole-token and exact after normalisation — never fuzzy, never
 * a substring — with a table of exceptions for the compounds that contain a
 * name while meaning something else.
 */

import { KnowledgeEntry, type ClassId } from "@/lib/schema";
import { ENTRIES } from "@/lib/knowledge/entries";
import { isA } from "@/lib/knowledge/classes";

export { KNOWLEDGE_VERSION } from "@/lib/knowledge/entries";
export { ALL_CLASSES, CLASS_TREE, ancestry, classLabel, isA } from "@/lib/knowledge/classes";

/**
 * Validated once at module load, so a malformed entry fails here rather than at
 * the moment somebody photographs a label.
 */
export const KNOWLEDGE: KnowledgeEntry[] = ENTRIES.map((entry) => KnowledgeEntry.parse(entry));

/**
 * Compound terms that contain an entry's name but are not that entry.
 *
 * Every line is a dispute somebody would otherwise file. The blocked entry is
 * named explicitly rather than inferred, because a clever rule here would be a
 * new way to be wrong.
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
  { phrase: "sugar alcohol", blocks: ["sugar", "alcohol"] },
  { phrase: "no sugar added", blocks: ["sugar"] },
  { phrase: "sugar cane fiber", blocks: ["sugar"] },
  { phrase: "non alcoholic", blocks: ["alcohol"] },
  { phrase: "nonalcoholic", blocks: ["alcohol"] },
  { phrase: "alcohol free", blocks: ["alcohol"] },
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
  /** The name that matched, for §16's inspect panel. */
  matchedOn: string;
};

/**
 * Every entry this piece of label text refers to.
 *
 * More than one is normal and correct — `soy lecithin` is both the lecithin
 * entry, which classes it as an emulsifier, and the soy entry, which classes it
 * as a declared allergen. The engine reconciles them; the matcher's job is not
 * to lose either.
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
      found.set(candidate.entry.id, { entry: candidate.entry, matchedOn: candidate.tokens.join(" ") });
    }
  }
  return [...found.values()];
}

export function entryById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE.find((entry) => entry.id === id);
}

/** Every entry that falls under a class, following the parent links. */
export function entriesInClass(target: ClassId): KnowledgeEntry[] {
  return KNOWLEDGE.filter((entry) => isA(entry.classes, target));
}
