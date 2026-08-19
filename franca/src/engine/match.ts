/**
 * The matcher language, evaluated over a whole document.
 *
 * Two things this deliberately is not. It is not a model: the same text and
 * the same pack give the same spans on every run, on every machine, forever,
 * which is what lets a score be defended line by line. And it is not a
 * substring search: "free" inside "freedom" is not the word "free", and a
 * scanner that cannot tell the difference is one a brand stops trusting on
 * their first false positive.
 */

import type { Matcher, Span } from "./types.js";

/** How far either side of a hit a qualifier counts as qualifying it. Roughly a
 *  clause and a half: "recyclable where facilities exist" qualifies, a
 *  disclaimer three paragraphs down does not. */
export const DEFAULT_QUALIFIER_WINDOW = 120;

/** Word-ish boundaries. `\b` is wrong here — half these phrases contain
 *  hyphens and slashes, and `\b` fires inside "carbon-neutral". */
const OPEN = "(?<![\\p{L}\\p{N}])";
const CLOSE = "(?![\\p{L}\\p{N}])";

const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A phrase matches with flexible internal whitespace, so copy that wraps a
 * phrase across a line break or pads it with a non-breaking space still trips.
 * Hyphens and spaces are treated as the same separator: brands write
 * "carbon neutral", "carbon-neutral" and "carbon–neutral" interchangeably and
 * mean the identical thing.
 */
function phraseSource(phrase: string): string {
  const parts = phrase
    .trim()
    .split(/[\s ]+|(?<=\w)-(?=\w)/)
    .filter(Boolean)
    .map(escape);
  return OPEN + parts.join("[\\s\\u00a0]*[-‐-―]?[\\s\\u00a0]*") + CLOSE;
}

function findPhrases(text: string, phrases: string[]): Span[] {
  const spans: Span[] = [];
  for (const phrase of phrases) {
    const re = new RegExp(phraseSource(phrase), "giu");
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      spans.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  return spans;
}

function findPattern(text: string, source: string, flags: string | undefined): Span[] {
  const wanted = new Set([...(flags ?? "i"), "g"]);
  const re = new RegExp(source, [...wanted].join(""));
  const spans: Span[] = [];
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    if (m[0].length === 0) continue;
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

/** Drop hits that sit near one of their own disqualifying phrases. */
function withoutQualified(text: string, spans: Span[], unless: string[], window: number): Span[] {
  if (unless.length === 0) return spans;
  const qualifiers = findPhrases(text, unless);
  if (qualifiers.length === 0) return spans;
  return spans.filter((span) => {
    const from = span.start - window;
    const to = span.end + window;
    return !qualifiers.some((q) => q.end > from && q.start < to);
  });
}

/**
 * Longest wins where two hits overlap, and identical hits collapse. Without
 * this a rule listing both "proven" and "clinically proven" reports the same
 * sentence twice and deducts for it twice.
 */
export function normaliseSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const span of sorted) {
    const last = kept[kept.length - 1];
    if (last && span.start < last.end) {
      if (span.end > last.end) kept[kept.length - 1] = { start: last.start, end: span.end };
      continue;
    }
    kept.push(span);
  }
  return kept;
}

/**
 * Every place in `text` where `matcher` hits.
 *
 * `all` reports the spans of its first child only: in every rule that uses it
 * the first child is the claim and the rest are conditions on the document, so
 * the first child is the text a person should be shown.
 */
export function match(text: string, matcher: Matcher): Span[] {
  switch (matcher.kind) {
    case "phrase": {
      const hits = findPhrases(text, matcher.any);
      return normaliseSpans(
        withoutQualified(text, hits, matcher.unless ?? [], matcher.window ?? DEFAULT_QUALIFIER_WINDOW),
      );
    }
    case "pattern": {
      const hits = findPattern(text, matcher.source, matcher.flags);
      return normaliseSpans(
        withoutQualified(text, hits, matcher.unless ?? [], matcher.window ?? DEFAULT_QUALIFIER_WINDOW),
      );
    }
    case "any":
      return normaliseSpans(matcher.of.flatMap((child) => match(text, child)));
    case "all": {
      const perChild = matcher.of.map((child) => match(text, child));
      if (perChild.some((spans) => spans.length === 0)) return [];
      return perChild[0] ?? [];
    }
  }
}
