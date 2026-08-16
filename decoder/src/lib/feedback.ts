/**
 * "This verdict looks wrong."
 *
 * BRIEF.md §16 gives the categories and §25 makes the resulting number a
 * first-class metric with its own heading:
 *
 * > VERDICT DISPUTE RATE — percentage of scans users say are wrong.
 * > A growth product with untrustworthy answers is not succeeding.
 *
 * §15 items 6 and 7 are why the disputes are worth more than the metric: the
 * failure corpus and the human evaluation dataset are the parts of the moat
 * that only exist if somebody captures them from the first scan onwards.
 *
 * ## What a dispute deliberately does not contain
 *
 * §17 Rule 6 — minimise collection. A dispute carries the ingredient text, the
 * category, and the versions needed to re-derive the verdict. It does not carry
 * the photograph, the user's rules, or anything identifying them. Every one of
 * those would make the dataset richer and every one of them is health-adjacent
 * personal data this product has no business holding to improve its own
 * accuracy.
 */

import { Dispute, type DisputeKind, type Finding, type Verdict } from "@/lib/schema";

/** §16's list, in the order it presents them, with the wording a user sees. */
export const DISPUTE_LABELS: Record<DisputeKind, string> = {
  "ingredient-missed": "An ingredient on the label is missing here",
  "ingredient-misread": "An ingredient was read wrong",
  "incorrect-classification": "This ingredient isn't what you say it is",
  "incorrect-rule-match": "This doesn't conflict with my rule",
  "explanation-inaccurate": "The explanation is wrong",
  other: "Something else",
};

export const DISPUTE_KINDS = Object.keys(DISPUTE_LABELS) as DisputeKind[];

/**
 * Build a dispute from a verdict and, optionally, the finding the user tapped.
 *
 * The rule set contributes its id and nothing else. That is enough to reproduce
 * the verdict from a preset, and for a custom rule set it is enough to know
 * that the answer is not reproducible from this record alone — which is the
 * honest trade §17 Rule 6 asks for.
 */
export function raiseDispute(
  verdict: Verdict,
  kind: DisputeKind,
  options: { finding?: Finding; note?: string } = {},
): Dispute {
  return Dispute.parse({
    kind,
    ingredient: options.finding?.ingredient ?? null,
    entryId: options.finding?.entryId ?? null,
    note: options.note ?? null,
    provenance: verdict.provenance,
  });
}

/**
 * §25's headline trust metric.
 *
 * Deliberately a plain function over counts rather than anything cleverer: the
 * number has to be arguable with, and a weighted trust index nobody can
 * recompute by hand is a number that stops being believed the first time it
 * disagrees with somebody's intuition.
 */
export function disputeRate(scans: number, disputes: number): number | null {
  if (scans <= 0) return null;
  return Math.round((disputes / scans) * 1000) / 10;
}

/**
 * Which disputes point at the graph rather than at the camera.
 *
 * Worth separating because they have different fixes and different owners: a
 * misread is a parse problem and goes to §15's failure corpus, a wrong
 * classification is a data problem and is one edit to an entry. Reporting them
 * as one number would hide which of the two is actually degrading.
 */
export function isGraphFault(kind: DisputeKind): boolean {
  return kind === "incorrect-classification" || kind === "incorrect-rule-match" || kind === "explanation-inaccurate";
}
