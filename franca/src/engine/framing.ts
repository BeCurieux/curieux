/**
 * How the product is allowed to speak about somebody's copy.
 *
 * The brief's legal guardrails are the reason this file exists as code rather
 * than as a note in a style guide. A rule author writes a `concern` and a
 * `remedy`; they never write the sentence at the top of a finding. That
 * sentence is composed here from the rule's `modality` and its citation, so
 * the set of assertions this product can make is the set of members of
 * `Modality` — four — and adding a fifth is a decision somebody has to make on
 * purpose.
 *
 * The verdicts this shape cannot express are the point: there is no template
 * that says a claim is unlawful, no template that says a page fails, and no
 * path by which a rule's prose becomes the headline.
 */

import type { Citation, Modality, Rule } from "./types.js";

/**
 * Words that assert an outcome only a court or a regulator can assert. Banned
 * from every rule field that talks about the brand's copy — `concern`,
 * `remedy`, `rewriteGuidance`, `title` — and checked by tests/framing.test.ts.
 *
 * Not banned from `instrumentSays`, which describes what a law does. "The
 * ECGT prohibits generic environmental claims" is a true sentence about an
 * instrument; "your page is prohibited" is a verdict this product does not
 * get to reach. The distinction is the whole guardrail: describe the rule,
 * characterise the risk, never rule on the page.
 */
export const BANNED_ABSOLUTES = [
  "illegal",
  "unlawful",
  "non-compliant",
  "noncompliant",
  "in breach",
  "breach of",
  "violat",
  "is prohibited",
  "are prohibited",
  "you must",
  "will be rejected",
  "will be fined",
  "we certify",
  "we guarantee",
  "this fails",
] as const;

/** Every field of a rule whose words are about the brand's page. */
export const CLAIM_DIRECTED_FIELDS = ["title", "concern", "remedy", "rewriteGuidance"] as const;

export function citationLabel(citation: Citation): string {
  return citation.locator ? `${citation.instrument}, ${citation.locator}` : citation.instrument;
}

const TEMPLATES: Record<Modality, (where: string) => string> = {
  likely_to_be_flagged: (where) => `This wording is likely to be flagged under ${where}.`,
  may_be_unsubstantiated: (where) => `This claim may be unsubstantiated as written under ${where}.`,
  requires_substantiation: (where) =>
    `Evidence is expected to be in hand before this wording is used, under ${where}.`,
  narrowing_suggested: (where) => `This claim reaches further than it needs to under ${where}.`,
};

/** The one sentence a finding leads with. Composed, never authored. */
export function headline(rule: Rule): string {
  return TEMPLATES[rule.modality](citationLabel(rule.citation));
}

/**
 * Carried on every ScanResult rather than left to each surface to remember.
 * A score card that renders the result and forgets the disclaimer is a
 * screenshot of this product asserting something it does not assert.
 */
export const DISCLAIMER =
  "This is an opinion about language, not legal advice. It reviews wording against " +
  "published rules and cannot see your evidence, your contracts or your market. " +
  "Check anything consequential with a qualified adviser.";

/** The offending words in a piece of prose, for the test and for eyeballing. */
export function absolutesIn(prose: string): string[] {
  const lower = prose.toLowerCase();
  return BANNED_ABSOLUTES.filter((word) => lower.includes(word));
}
