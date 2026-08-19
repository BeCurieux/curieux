/**
 * The Claim Confidence Score.
 *
 * The brief's requirement is that no point is lost to a judgement nobody can
 * see, so the score is arithmetic over findings and the arithmetic ships with
 * the result. `Score.deductions` is not a debug aid: it is what the score page
 * renders, and it is the reason a founder who disagrees with an 82 can argue
 * with a named rule instead of with a number.
 */

import { SEVERITY_WEIGHT, type Deduction, type Finding, type Score, type ScoreBand } from "./types.js";

/** A rule can cost at most twice its severity weight, however often it trips. */
export const PER_RULE_CAP_MULTIPLIER = 2;

/** What each repeat of an already-counted rule costs, as a share of the first. */
export const REPEAT_SHARE = 1 / 3;

/**
 * Where the bands sit, and therefore where the badge sits.
 *
 * `clear` was 85 and is 80 (owner's call, 2026-08-18). The reason for moving
 * it: carefully written copy — real ingredient claims, a qualified recyclable,
 * a substantiated trial figure — landed at 82 and could not display the mark.
 * A funnel that says "scan, fix, badge" and then withholds the badge from
 * copy a specialist would sign off is selling something it does not hand over.
 *
 * The badge threshold and the band threshold are deliberately the same number.
 * `badgeEligible` is `band === "clear"` and is not given a separate bar,
 * because a page whose own card says *worth a look* while its PDP carries a
 * mark reading *Claims Verified* is the §9 problem in miniature — the mark
 * asserting what the card qualifies. Lower one and you lower both, on purpose.
 */
export const BAND_THRESHOLDS = { clear: 80, review: 60 } as const;

/**
 * Repeats decay, and here is why. A product page says "eco-friendly" in the
 * hero, the bullets, the FAQ and the shipping note; a scanner that charges
 * full freight four times reports 34 for a page with one problem in it, and
 * the brand — correctly — stops believing the number. Repeats still cost
 * something, because saying it four times is four places to fix and four
 * chances to be screenshotted.
 */
function pointsFor(severity: Finding["severity"], occurrence: number, spentOnRule: number): number {
  const base = SEVERITY_WEIGHT[severity];
  const cap = base * PER_RULE_CAP_MULTIPLIER;
  const room = cap - spentOnRule;
  if (room <= 0) return 0;
  const raw = occurrence === 1 ? base : Math.max(1, Math.round(base * REPEAT_SHARE));
  return Math.min(raw, room);
}

function reasonFor(occurrence: number, points: number, capped: boolean): string {
  if (capped) return `Seen again (${ordinal(occurrence)} time); this rule has reached its cap, so no further points.`;
  if (occurrence === 1) return `First time this rule is tripped: −${points}.`;
  return `Seen again (${ordinal(occurrence)} time), at the reduced repeat rate: −${points}.`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

export function bandFor(value: number, findings: Finding[]): ScoreBand {
  // A high-severity finding keeps a page out of "clear" even when the
  // arithmetic would allow it. Today the weights make that impossible anyway;
  // it is written down so that a future reweighting cannot quietly badge a
  // page carrying the one kind of claim that gets ad accounts closed.
  if (findings.some((f) => f.severity === "high")) {
    return value >= BAND_THRESHOLDS.review ? "review" : "rework";
  }
  if (value >= BAND_THRESHOLDS.clear) return "clear";
  if (value >= BAND_THRESHOLDS.review) return "review";
  return "rework";
}

export function scoreFindings(findings: Finding[]): Score {
  const spent = new Map<string, number>();
  const seen = new Map<string, number>();
  const deductions: Deduction[] = [];

  for (const finding of findings) {
    const occurrence = (seen.get(finding.ruleId) ?? 0) + 1;
    seen.set(finding.ruleId, occurrence);
    const alreadySpent = spent.get(finding.ruleId) ?? 0;
    const points = pointsFor(finding.severity, occurrence, alreadySpent);
    spent.set(finding.ruleId, alreadySpent + points);
    deductions.push({
      ruleId: finding.ruleId,
      ruleTitle: finding.ruleTitle,
      severity: finding.severity,
      occurrence,
      points,
      reason: reasonFor(occurrence, points, points === 0),
    });
  }

  const total = deductions.reduce((sum, d) => sum + d.points, 0);
  const value = Math.max(0, 100 - total);
  return { value, band: bandFor(value, findings), deductions };
}

/**
 * Whether a result may display the badge.
 *
 * Kept next to the score because the badge is the product and this is the
 * single check standing between the brand and a public page asserting more
 * than the scan found. It is deliberately stricter than "a good score": a page
 * carrying a high-severity finding does not display a badge at any number.
 */
export function badgeEligible(score: Score): boolean {
  return score.band === "clear";
}
