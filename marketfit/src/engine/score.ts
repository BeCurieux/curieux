/**
 * Findings → one headline per product per market.
 *
 *   blocked          a scored rule of severity `blocked` failed
 *   needs_attention  a scored rule of severity `needs_attention` failed
 *   not_assessed     nothing failed, but the engine cannot say "ready": no
 *                    verified rule applies here at all, or a scored rule
 *                    could not be checked
 *   ready            every scored rule was checked and passed
 *
 * BUILD_BRIEF.md §5 lists three states. The fourth exists because of §2.1 and
 * §9: "if a rule isn't in the database, the product says not assessed" and
 * "no score without verified rules". A market with no verified rules scored
 * `ready` would be a clean bill of health issued on silence — the one failure
 * this product cannot survive. Only scored findings (verified, non-advisory)
 * move the headline; everything else is shown beside it as advice.
 *
 * The word "compliant" never appears as a verdict (§2.4).
 */

import type { Finding } from "./assess.js";

export const SCORES = ["ready", "needs_attention", "blocked", "not_assessed"] as const;
export type Score = (typeof SCORES)[number];

export const SCORE_LABEL: Record<Score, string> = {
  ready: "Ready",
  needs_attention: "Needs attention",
  blocked: "Blocked",
  not_assessed: "Not assessed",
};

export function scoreFindings(findings: readonly Pick<Finding, "scored" | "status" | "severity">[]): Score {
  const scored = findings.filter((f) => f.scored);
  if (scored.some((f) => f.status === "fail" && f.severity === "blocked")) return "blocked";
  if (scored.some((f) => f.status === "fail" && f.severity === "needs_attention")) return "needs_attention";
  if (scored.length === 0 || scored.some((f) => f.status === "not_assessed")) return "not_assessed";
  return "ready";
}
