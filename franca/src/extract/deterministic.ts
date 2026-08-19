/**
 * Claim extraction with no model in it.
 *
 * The brief puts a model on this step, and one will go here — it reads
 * marketing prose far better than a regular expression does, especially copy
 * that arrives as fragments off a product page. This exists underneath it for
 * three reasons, in ascending order of importance: the test suite needs a
 * scan that runs without a key, a founder mid-kill-test needs one that runs on
 * a plane, and — the real one — the engine has to keep working when the model
 * is unavailable, wrong, or slow.
 *
 * It can afford to be simple because of where claims sit in the design. They
 * group and attribute findings; they do not decide what gets read. `evaluate`
 * runs the corpus over the whole document, so a sentence this misses is still
 * scanned. A bad segmentation costs a finding its neat highlight, never its
 * existence.
 */

import { CLAIM_CATEGORIES, type Claim, type ClaimCategory, type Span } from "../engine/types.js";

/** Marketing copy breaks on bullets and line breaks as often as on full stops. */
const BOUNDARY = /(?<=[.!?])\s+|\n+|(?:\s+[•·—–]\s+)|(?:\s*\|\s*)/g;

const LEXICON: Record<ClaimCategory, RegExp> = {
  efficacy:
    /\b(reduces?|smooths?|firms?|lifts?|brightens?|clears?|repairs?|restores?|boosts?|improves?|increases?|eliminates?|fades?|targets?|fights?|treats?|heals?|prevents?|supports?|works?)\b/i,
  free_from:
    /\b(free[\s-]?from|free of|without|no\s+(nasties|parabens|sulphates|sulfates|silicones|fragrance)|non[\s-]?toxic|toxin[\s-]?free|chemical[\s-]?free|clean|pure|natural|vegan)\b/i,
  environmental:
    /\b(eco|green|sustainab\w*|recyclab\w*|compostab\w*|biodegradab\w*|carbon|climate|planet|plastic[\s-]?free|refillab\w*|zero[\s-]?waste)\b/i,
  clinical:
    /\b(clinical\w*|dermatologist|ophthalmologist|study|studies|trial|tested|proven|percent|%|participants?|weeks?\b.*\bstudy)\b/i,
  sensory:
    /\b(silky|velvety|glow\w*|dewy|luminous|soft|scent\w*|smells?|aroma\w*|fragranc\w*|texture|feels?|melts?|absorbs?|weightless|lightweight)\b/i,
};

/** Fragments shorter than this are navigation, prices and stray punctuation. */
const MIN_CLAIM_LENGTH = 12;

function segments(text: string): Span[] {
  const spans: Span[] = [];
  let cursor = 0;
  for (const m of text.matchAll(BOUNDARY)) {
    if (m.index === undefined) continue;
    spans.push({ start: cursor, end: m.index });
    cursor = m.index + m[0].length;
  }
  spans.push({ start: cursor, end: text.length });
  return spans;
}

/** Trim the span, not just the string, so offsets stay true to the source. */
function tighten(text: string, span: Span): Span {
  let { start, end } = span;
  while (start < end && /\s/.test(text[start] ?? "")) start += 1;
  while (end > start && /\s/.test(text[end - 1] ?? "")) end -= 1;
  return { start, end };
}

export function categoriesOf(sentence: string): ClaimCategory[] {
  return CLAIM_CATEGORIES.filter((category) => LEXICON[category].test(sentence));
}

/**
 * Every sentence-ish fragment of the document that reads like a claim about
 * the product, in document order, with true offsets into the source.
 */
export function extractClaims(text: string): Claim[] {
  const claims: Claim[] = [];
  for (const raw of segments(text)) {
    const span = tighten(text, raw);
    const body = text.slice(span.start, span.end);
    if (body.length < MIN_CLAIM_LENGTH) continue;
    const categories = categoriesOf(body);
    if (categories.length === 0) continue;
    claims.push({ id: `claim-${claims.length + 1}`, text: body, span, categories });
  }
  return claims;
}
