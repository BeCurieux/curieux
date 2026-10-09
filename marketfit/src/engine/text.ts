/**
 * Text comparison for statements, phrases and ingredient names.
 *
 * Deliberately forgiving about typography and deliberately strict about
 * words. Case, runs of whitespace, curly versus straight quotes and the four
 * kinds of dash a label printer might use do not change what a statement
 * says; a missing word does. Accents are kept: "Ne pas dépasser" and "Ne pas
 * depasser" are different strings on a French label, and the engine is not the
 * place to decide that a mistake is close enough.
 */

export function normalise(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Is `needle` in `haystack` as whole words? "Iron" is in "ferrous iron
 * bisglycinate"; it is not in "ironwood". Letters and digits from any script
 * count as word characters, so this works for "Eisen" and "fer" too.
 */
export function containsPhrase(haystack: string, needle: string): boolean {
  const n = normalise(needle).replace(/[.!]+$/, "");
  if (!n) return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(n)}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(normalise(haystack));
}

/** Does an ingredient name match a substance name or any alias? */
export function nameMatches(ingredient: string, names: readonly string[]): string | null {
  for (const name of names) if (containsPhrase(ingredient, name)) return name;
  return null;
}
