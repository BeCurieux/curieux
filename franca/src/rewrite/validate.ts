/**
 * The gate a draft has to clear before anybody sees it.
 *
 * This is law 1 applied to rewrites. The model drafts; the rules dispose. A
 * draft is accepted only when re-scanning it shows the rule it was written to
 * fix is gone and nothing new has appeared — which means the acceptance
 * criterion is the same deterministic engine that produced the finding, not
 * the model's opinion of its own work.
 *
 * Five checks, and the order matters: cheap and absolute first, judgement
 * last. Everything here is pure, so the whole gate runs in a test with no key.
 */

import { scan } from "../engine/evaluate.js";
import type { Finding, Jurisdiction } from "../engine/types.js";
import { fabricatedEvidence, fabricationReason } from "./fabrication.js";

export type RejectionCode =
  | "empty"
  | "unchanged"
  | "still-trips"
  | "trips-something-new"
  | "fabricates"
  | "too-short"
  | "too-long"
  | "off-topic";

export type Validation =
  | { ok: true }
  | { ok: false; code: RejectionCode; reason: string };

/**
 * A rewrite may be terse, but one that is a quarter of the claim has usually
 * deleted it rather than fixed it, and one many times its length is an essay
 * where a product page wants a sentence.
 *
 * The ratio alone was wrong, and a one-word mark showed it: the exact fix for
 * "recyclable" is "recyclable where facilities exist", which is three times
 * the length and obviously correct. So the upper bound is the ratio *or* a
 * flat allowance, whichever is more generous — a short phrase may become a
 * sentence, and a long one may not double.
 */
export const LENGTH_BAND = { min: 0.4, max: 2.5, headroom: 120 } as const;

/** How much of the claim's vocabulary a rewrite has to still be about. */
export const MIN_TOPIC_OVERLAP = 0.2;

/**
 * Below this many content words, the overlap check is switched off.
 *
 * Most marks are a two-word trigger — "eco-friendly", "clinically proven" —
 * and a good rewrite of a two-word trigger replaces both words. "Made with
 * plant-derived surfactants" shares nothing with "eco-friendly" and is exactly
 * right. Measuring overlap there rejects every correct answer, so the check
 * only runs where it means something: a claim long enough that abandoning its
 * whole vocabulary is evidence the draft abandoned the claim.
 */
export const TOPIC_CHECK_MIN_WORDS = 4;

const STOPWORDS = new Set(
  ("a an and are as at be been but by for from has have in is it its of on or that the this to " +
    "was were will with you your our we us not no").split(" "),
);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Does the rewrite still talk about what the claim talked about?
 *
 * The degenerate draft that passes every other check is "Contact us for
 * details." — no rule trips, no evidence invented, and the brand's claim has
 * simply been deleted. This is a heuristic and it is a weak one; it is here to
 * catch that shape rather than to judge quality.
 */
export function topicOverlap(claim: string, rewrite: string): number {
  const before = contentWords(claim);
  if (before.size === 0) return 1;
  const after = contentWords(rewrite);
  let shared = 0;
  for (const word of before) if (after.has(word)) shared += 1;
  return shared / before.size;
}

export type ValidateInput = {
  /** The phrase the rule matched, as it appears on the page. */
  claim: string;
  /** The draft replacement. */
  rewrite: string;
  /** The finding this draft is meant to answer. */
  finding: Finding;
  /**
   * The claim's surroundings. Used only by the fabrication check: a figure the
   * brand already published a line above is theirs to reuse, and only a figure
   * that appears nowhere is invented.
   */
  context?: string;
  /** Markets to re-scan against. The finding's own market is always included. */
  jurisdictions?: Jurisdiction[];
};

export function validateRewrite(input: ValidateInput): Validation {
  const { claim, finding } = input;
  const rewrite = input.rewrite.trim();
  const markets = [...new Set([finding.jurisdiction, ...(input.jurisdictions ?? [])])];

  if (rewrite.length === 0) return { ok: false, code: "empty", reason: "the draft is empty" };
  if (rewrite === claim.trim()) {
    return { ok: false, code: "unchanged", reason: "the draft is the claim, unchanged" };
  }

  const claimLength = Math.max(1, claim.trim().length);
  if (rewrite.length < claimLength * LENGTH_BAND.min) {
    return { ok: false, code: "too-short", reason: "the draft deletes the claim rather than rewriting it" };
  }
  if (rewrite.length > Math.max(claimLength * LENGTH_BAND.max, claimLength + LENGTH_BAND.headroom)) {
    return { ok: false, code: "too-long", reason: "the draft is an essay where the page wants a sentence" };
  }

  // The check that makes this law 1 and not a vibe: the same engine that
  // raised the finding decides whether the draft answers it.
  const after = scan({ text: rewrite, source: { kind: "paste" }, jurisdictions: markets }).findings;
  if (after.some((f) => f.ruleId === finding.ruleId)) {
    return { ok: false, code: "still-trips", reason: `the draft still trips ${finding.ruleId}` };
  }

  const before = new Set(
    scan({ text: claim, source: { kind: "paste" }, jurisdictions: markets }).findings.map((f) => f.ruleId),
  );
  const introduced = after.filter((f) => !before.has(f.ruleId));
  if (introduced.length > 0) {
    const names = [...new Set(introduced.map((f) => f.ruleId))].join(", ");
    return { ok: false, code: "trips-something-new", reason: `the draft trips ${names}, which the claim did not` };
  }

  const fabricated = fabricatedEvidence(input.context ?? claim, rewrite);
  const reason = fabricationReason(fabricated);
  if (reason) return { ok: false, code: "fabricates", reason };

  if (
    contentWords(claim).size >= TOPIC_CHECK_MIN_WORDS &&
    topicOverlap(claim, rewrite) < MIN_TOPIC_OVERLAP
  ) {
    return { ok: false, code: "off-topic", reason: "the draft is about something else" };
  }

  return { ok: true };
}
