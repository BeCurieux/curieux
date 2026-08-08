/**
 * Scoring weights and penalties (brief §17).
 *
 * These live in config and NOT in a prompt, on purpose. Deterministic scoring
 * is what makes the recommendation engine testable: the same profile, weather
 * and candidate set must produce the same ranking every time, and when a plan
 * is wrong we need to be able to point at a number rather than re-read a
 * paragraph of English. The model reasons about the shortlist this produces;
 * it does not produce the shortlist.
 *
 * Dimensions sum to 100. If you change one, change another — the test in
 * tests/unit/scoring.test.ts asserts the total.
 */

export interface ScoringWeights {
  personal_interest_fit: number;
  household_fit: number;
  weather_fit: number;
  travel_fit: number;
  budget_fit: number;
  energy_fit: number;
  novelty: number;
  logistical_simplicity: number;
}

export const SCORING_WEIGHTS: ScoringWeights = {
  personal_interest_fit: 20,
  household_fit: 15,
  weather_fit: 15,
  travel_fit: 10,
  budget_fit: 10,
  energy_fit: 10,
  novelty: 10,
  logistical_simplicity: 10,
};

export const MAX_BASE_SCORE = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Penalties are absolute points subtracted after the weighted dimensions.
 * A plan can be driven below zero; the floor is applied at the end.
 */
export interface ScoringPenalties {
  /** Suggested to this household within the repeat window and not completed. */
  recently_suggested: number;
  /** They already did this anchor recently — unless they are a repeater (§18). */
  recently_completed: number;
  /** Category or venue the user explicitly dislikes. */
  explicit_dislike: number;
  /** Route doubles back on itself; feels badly planned even when it is fast. */
  route_backtracking: number;
  /** We could not confirm opening hours for a commercial venue. */
  uncertain_opening_hours: number;
  /** No trusted price for something where cost matters to budget fit. */
  uncertain_price: number;
  /** Busy place, crowd-averse household. */
  crowd_mismatch: number;
  /** Driving dominates the day. */
  too_much_driving: number;
  /** More components than the household's time budget makes relaxing. */
  too_many_components: number;
  /** Anchor is indoors-only on a beautiful day, or exposed in bad weather. */
  weather_risk: number;
}

export const SCORING_PENALTIES: ScoringPenalties = {
  recently_suggested: 12,
  recently_completed: 18,
  explicit_dislike: 40,
  route_backtracking: 8,
  uncertain_opening_hours: 10,
  uncertain_price: 6,
  crowd_mismatch: 10,
  too_much_driving: 12,
  too_many_components: 8,
  weather_risk: 15,
};

/**
 * Tunables the scorers read. Grouped rather than scattered as magic numbers so
 * that tuning the engine is a diff in one file.
 */
export const SCORING_CONFIG = {
  /** A plan below this base score is never shown, even if it is the best we have. */
  min_deliverable_score: 48,
  /** Below this we prefer to retry generation entirely (§39). */
  retry_threshold: 40,

  /** Weeks before a completed anchor may be suggested again to a non-repeater. */
  repeat_window_weeks: 12,
  /** Weeks before a *suggested but not done* anchor may reappear. */
  suggested_window_weeks: 6,

  /** Share of total elapsed time that may be travel before it feels like a commute. */
  max_travel_share: 0.35,
  /** Above this many minutes in the car, `too_much_driving` applies. */
  driving_penalty_minutes: 75,

  /** Plans should feel relaxed: 2–4 meaningful components (§16). */
  ideal_components: { min: 2, max: 4 },

  /**
   * Novelty is not automatically good (§18). A household's novelty appetite is
   * learned; this is the starting assumption before we have evidence.
   */
  default_novelty_appetite: 0.55,
} as const;

/**
 * How much a stated onboarding preference is worth relative to observed
 * behaviour (§18: "actual behaviour should gradually outweigh stated
 * preferences"). Applied in the taste model, used here for interest fit.
 */
export const EVIDENCE_WEIGHTS = {
  onboarding: 1.0,
  checkin: 1.1,
  plan_accepted: 1.2,
  plan_rejected: 1.4,
  did_it: 2.0,
  loved_it: 2.6,
  rating: 1.8,
  manual_edit: 2.2,
  inferred: 0.7,
} as const;

export type EvidenceSource = keyof typeof EVIDENCE_WEIGHTS;
