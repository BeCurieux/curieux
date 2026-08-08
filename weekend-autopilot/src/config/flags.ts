/**
 * Feature flags (§6, §42).
 *
 * Defaults are the launch posture: sell the four-week pilot only, review every
 * plan by hand before it goes out. Both of those are meant to be switched off
 * from the environment as confidence grows — the founder-review switch in
 * particular is a training wheel, not architecture (§42).
 */

import { envFlag } from "@/config/env";

export interface Flags {
  /** Show the A$29 four-week pilot on pricing. The initial public offer. */
  offerPilot: boolean;
  /** Show the annual plan. Enabled for the post-pilot conversion page first. */
  offerAnnual: boolean;
  /** Show monthly. Off at launch; kept behind a flag as a pricing experiment. */
  offerMonthly: boolean;
  /**
   * Hold generated plans in PENDING_REVIEW until a human approves them.
   * True for the first cohort so we learn where the autonomous system fails;
   * the goal is to turn it off, not to keep a person in the loop forever.
   */
  requirePlanReview: boolean;
  /** Sunday "did you do it?" email. */
  feedbackEmails: boolean;
  /** The swap buttons on plan detail (§25). */
  planSwaps: boolean;
  /** Overnight escapes (§31) — schema supports it, product does not yet. */
  overnightEscapes: boolean;
  /** Affiliate link decoration (§30). Off until we have a partner. */
  affiliateLinks: boolean;
}

export function flags(): Flags {
  return {
    offerPilot: envFlag("FLAG_OFFER_PILOT", true),
    offerAnnual: envFlag("FLAG_OFFER_ANNUAL", false),
    offerMonthly: envFlag("FLAG_OFFER_MONTHLY", false),
    requirePlanReview: envFlag("REQUIRE_PLAN_REVIEW", true),
    feedbackEmails: envFlag("FLAG_FEEDBACK_EMAILS", true),
    planSwaps: envFlag("FLAG_PLAN_SWAPS", true),
    overnightEscapes: envFlag("FLAG_OVERNIGHT_ESCAPES", false),
    affiliateLinks: envFlag("FLAG_AFFILIATE_LINKS", false),
  };
}
