/**
 * What the fetch left behind — measured by scanning it, not by counting it.
 *
 * A structured source gives exactly this product and nothing about its
 * neighbours, which is why the ladder prefers one. What it does not give is
 * the hero line, the "our promise" block, or the sustainability paragraph, and
 * those are where environmental claims live.
 *
 * The first version of this compared character counts and warned above a
 * threshold. It was useless in the only case that mattered: the page that
 * prompted it held one extra sentence, 118 characters long, and the sentence
 * was "we are a carbon neutral, eco-friendly brand". What matters is not how
 * much of the page was missed but whether the missed part trips anything.
 *
 * So this runs the corpus over both and reports the difference. It sits here
 * rather than in `fetch.ts` because fetching should not depend on the engine;
 * this is a caller's convenience built from both.
 */

import { scan } from "../engine/evaluate.js";
import type { Finding, Jurisdiction } from "../engine/types.js";

export type Coverage = {
  /** Findings on the page that the fetched copy does not contain. */
  missed: Finding[];
  /** The distinct phrases behind them, in reading order, deduplicated. */
  phrases: string[];
};

/**
 * Findings the whole page has and the chosen copy does not.
 *
 * Compared by rule *and phrase* rather than by rule alone: a page whose hero
 * says "eco-friendly" and whose description says "eco friendly" has the same
 * rule twice and nothing is missing, while a page tripping the same rule on a
 * different phrase has something worth reading.
 */
export function coverageGap(
  chosenText: string,
  pageText: string,
  jurisdictions: Jurisdiction[],
): Coverage {
  if (!pageText || pageText === chosenText) return { missed: [], phrases: [] };

  const key = (finding: Finding) => `${finding.ruleId}::${finding.trigger.text.trim().toLowerCase()}`;
  const inCopy = new Set(
    scan({ text: chosenText, source: { kind: "paste" }, jurisdictions }).findings.map(key),
  );
  const missed = scan({ text: pageText, source: { kind: "paste" }, jurisdictions }).findings.filter(
    (finding) => !inCopy.has(key(finding)),
  );

  const phrases: string[] = [];
  for (const finding of missed) {
    const phrase = finding.trigger.text.trim();
    if (!phrases.some((seen) => seen.toLowerCase() === phrase.toLowerCase())) phrases.push(phrase);
  }
  return { missed, phrases };
}

/** One line for a terminal, or nothing when there is nothing to say. */
export function coverageNote(coverage: Coverage): string | null {
  if (coverage.phrases.length === 0) return null;
  const shown = coverage.phrases.slice(0, 4).map((p) => `"${p}"`).join(", ");
  const more = coverage.phrases.length > 4 ? `, and ${coverage.phrases.length - 4} more` : "";
  return (
    `elsewhere on the page, outside the product description: ${shown}${more}. ` +
    `Add those lines to the copy, or rescan with --whole.`
  );
}
