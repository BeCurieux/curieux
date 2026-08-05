// Editorial rules (brief §13, §29).
// AI copy must be warm, observant, restrained, specific, natural, brief —
// and must prefer omission over invention. This module is the enforcement
// layer applied to every piece of AI-drafted copy, regardless of provider.

const BANNED_PHRASES = [
  "magical journey",
  "magical year",
  "precious memories",
  "cherish forever",
  "cherished memories",
  "filled with adventure",
  "filled with love",
  "filled with wonder",
  "little bundle of joy",
  "growing up so fast",
  "time flies",
  "blink of an eye",
  "milestone after milestone",
  "journey of discovery",
  "watching you grow",
];

// Words that almost always signal purple prose or invented emotion.
const SUSPECT_WORDS = ["magical", "adventure-filled", "wondrous", "enchanted", "unforgettable"];

// Confident claims about interior states or firsts that require explicit support.
const SPECULATIVE_PATTERNS = [
  /\b(loved|adored|hated|was thrilled|was overjoyed|couldn't wait)\b/i,
  /\bfirst (ever )?(swim|haircut|steps?|words?|day|birthday|holiday)\b/i,
];

export interface EditorialVerdict {
  ok: boolean;
  violations: string[];
}

/**
 * Lint a piece of drafted copy. `supported` should be true when the copy is
 * backed by parent-supplied text (a quote, an answer, a memory description)
 * that itself contains the claim — speculative patterns are allowed then.
 */
export function lintCopy(text: string, opts: { supported?: boolean } = {}): EditorialVerdict {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) violations.push(`banned phrase: "${phrase}"`);
  }
  for (const word of SUSPECT_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      violations.push(`suspect word: "${word}"`);
    }
  }
  if (!opts.supported) {
    for (const pattern of SPECULATIVE_PATTERNS) {
      const m = text.match(pattern);
      if (m) violations.push(`unsupported claim: "${m[0]}"`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Filter a set of drafted blocks: anything failing the lint is dropped,
 * never rewritten into existence. Omission over invention (§29).
 */
export function enforceEditorial<T extends { content: string; ai_generated: boolean }>(
  blocks: T[],
  isSupported: (block: T) => boolean
): { kept: T[]; dropped: { block: T; violations: string[] }[] } {
  const kept: T[] = [];
  const dropped: { block: T; violations: string[] }[] = [];
  for (const block of blocks) {
    if (!block.ai_generated) {
      kept.push(block); // parent copy is never censored
      continue;
    }
    const verdict = lintCopy(block.content, { supported: isSupported(block) });
    if (verdict.ok) kept.push(block);
    else dropped.push({ block, violations: verdict.violations });
  }
  return { kept, dropped };
}
