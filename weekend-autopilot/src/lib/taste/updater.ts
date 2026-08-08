/**
 * Learning from outcomes (§24, §18).
 *
 * The single most important behavioural signal in the product is "did you
 * actually do it?" — so this module is where the loop closes. It converts
 * delivery, opening, completion and feedback into structured signal deltas.
 *
 * Deliberately deterministic. The model may propose additional signals from
 * free text (`summariseFeedback`), but the core learning is rules we can test:
 * we know exactly what four rejected museums should do to the museum signal,
 * and there is a test asserting it.
 */

import type { CategoryId } from "@/config/taxonomy";
import type {
  CategoryStats,
  DidIt,
  NotDoneReason,
  PlanFeedback,
  PlanWithItems,
  Rating,
} from "@/lib/types";
import { TASTE_DIMENSIONS, type SignalDelta } from "./signals";

/** How strongly each rating moves the signals for the plan's categories. */
const RATING_DELTA: Record<Rating, number> = {
  LOVED: 0.9,
  GOOD: 0.5,
  FINE: 0.1,
  NOT_FOR_ME: -0.7,
};

/**
 * Turn one piece of feedback into signal deltas.
 *
 * The subtlety is attribution. "Too far" is evidence about travel tolerance
 * and says nothing about whether they like beaches; "loved it" on a coastal
 * walk is evidence for water and for that walking distance, but not equally
 * for the café they happened to stop at. Blunt attribution — moving every
 * category in the plan by the same amount — is how a recommendation engine
 * slowly learns nonsense.
 */
export function deltasFromFeedback(
  plan: PlanWithItems,
  feedback: Pick<PlanFeedback, "did_it" | "rating" | "not_done_reason">,
  categoriesByItem: Map<string, CategoryId[]>
): SignalDelta[] {
  const deltas: SignalDelta[] = [];

  const anchorItem = plan.items.find((i) => i.is_critical) ?? plan.items[0];
  const anchorCategories = anchorItem ? (categoriesByItem.get(anchorItem.id) ?? []) : [];
  const foodCategories = plan.items
    .filter((i) => i.item_type === "FOOD")
    .flatMap((i) => categoriesByItem.get(i.id) ?? []);

  if (feedback.did_it === "YES") {
    // Completion is the strongest positive we ever receive, whatever they
    // then say about it — they gave up a Saturday on our recommendation.
    for (const categoryId of anchorCategories) {
      deltas.push({
        dimension: TASTE_DIMENSIONS.CATEGORY,
        value: categoryId,
        delta: 0.4,
        source: "DID_IT",
        evidence: `Completed a plan anchored on ${categoryId}`,
      });
    }

    if (feedback.rating) {
      const magnitude = RATING_DELTA[feedback.rating];
      const source = feedback.rating === "LOVED" ? "LOVED_IT" : "RATING";

      for (const categoryId of anchorCategories) {
        deltas.push({
          dimension: TASTE_DIMENSIONS.CATEGORY,
          value: categoryId,
          delta: magnitude,
          source,
          evidence: `Rated ${feedback.rating} after doing it`,
        });
      }
      // Food gets a smaller share: people rarely rate a day on the café.
      for (const categoryId of foodCategories) {
        deltas.push({
          dimension: TASTE_DIMENSIONS.CATEGORY,
          value: categoryId,
          delta: magnitude * 0.4,
          source,
          evidence: `Food component of a plan rated ${feedback.rating}`,
        });
      }

      if (feedback.rating === "LOVED") {
        // Learn the shape of the day, not just its subject.
        deltas.push({
          dimension: TASTE_DIMENSIONS.WALK_PREFERRED_KM,
          value: bucketWalk(plan.total_activity_distance_km),
          delta: 0.5,
          source: "LOVED_IT",
          evidence: `Loved a plan with ${plan.total_activity_distance_km} km of walking`,
        });
        deltas.push({
          dimension: TASTE_DIMENSIONS.START_TIME,
          value: plan.start_time,
          delta: 0.35,
          source: "LOVED_IT",
          evidence: `Loved a plan starting at ${plan.start_time}`,
        });
      }
    }

    return deltas;
  }

  // -------------------------------------------------------- they did not do it
  const reason = feedback.not_done_reason;

  // "Plans changed" says nothing about taste. Recording it as a rejection is
  // how you teach the engine that someone hates beaches because their sister
  // visited. It is logged as an event, and it changes nothing here.
  if (!reason || reason === "PLANS_CHANGED") return deltas;

  switch (reason) {
    case "TOO_FAR":
      deltas.push({
        dimension: TASTE_DIMENSIONS.TRAVEL_MAX_MINUTES,
        value: String(Math.max(15, Math.round(plan.total_travel_minutes * 0.7))),
        delta: 0.6,
        source: "PLAN_REJECTED",
        evidence: `Rejected ${plan.total_travel_minutes} minutes of travel as too far`,
      });
      break;

    case "TOO_EXPENSIVE":
      deltas.push({
        dimension: TASTE_DIMENSIONS.SPEND_ACTIVITY,
        value: "low",
        delta: 0.6,
        source: "PLAN_REJECTED",
        evidence: `Rejected a plan estimated at ${plan.estimated_total_cost_min}–${plan.estimated_total_cost_max}`,
      });
      break;

    case "TOO_TIRED":
      // Tiredness on one weekend is situational, not a preference. It moves
      // the start time later and nudges nothing else.
      deltas.push({
        dimension: TASTE_DIMENSIONS.START_TIME,
        value: laterThan(plan.start_time),
        delta: 0.25,
        source: "PLAN_REJECTED",
        evidence: "Too tired for the planned start",
      });
      break;

    case "WEATHER":
      // Our weather logic failed, not their taste. Nothing to learn about them.
      break;

    case "DIDNT_APPEAL":
      // The only reason that is genuinely about the recommendation itself.
      for (const categoryId of anchorCategories) {
        deltas.push({
          dimension: TASTE_DIMENSIONS.CATEGORY,
          value: categoryId,
          delta: -0.6,
          source: "PLAN_REJECTED",
          evidence: `Said a plan anchored on ${categoryId} did not appeal`,
        });
      }
      break;

    case "SOMETHING_ELSE":
      break;
  }

  return deltas;
}

/**
 * Opening a plan and not doing it is weak evidence; never opening it at all is
 * evidence about the email, not the plan. Neither is strong enough to move
 * taste, but the first says a little about appeal.
 */
export function deltasFromNonCompletion(
  plan: PlanWithItems,
  anchorCategories: CategoryId[],
  opened: boolean
): SignalDelta[] {
  if (!opened) return [];
  return anchorCategories.map((categoryId) => ({
    dimension: TASTE_DIMENSIONS.CATEGORY,
    value: categoryId,
    delta: -0.15,
    source: "INFERRED" as const,
    evidence: "Opened the plan but did not report doing it",
  }));
}

/** Counter updates that accompany the signal deltas (§18). */
export function updatedStats(
  existing: CategoryStats,
  event: { didIt?: DidIt; rating?: Rating | null; suggested?: boolean; rejected?: boolean },
  at: string
): CategoryStats {
  const next = { ...existing };

  if (event.suggested) {
    next.suggested_count += 1;
    next.last_suggested_at = at;
  }
  if (event.didIt === "YES") {
    next.completed_count += 1;
    next.accepted_count += 1;
    next.last_completed_at = at;
  }
  if (event.didIt === "NO" || event.rejected) {
    next.rejected_count += 1;
  }
  if (event.rating === "LOVED") {
    next.loved_count += 1;
  }

  return next;
}

/**
 * The museum case from the brief (§18), stated as a function so it is
 * testable: has this household rejected a category often enough that we should
 * stop recommending it, regardless of what they selected at onboarding?
 */
export function shouldSuppress(stats: CategoryStats): boolean {
  return stats.rejected_count >= 3 && stats.completed_count === 0;
}

function bucketWalk(km: number): string {
  if (km < 2) return "0-2";
  if (km < 4) return "2-4";
  if (km < 7) return "4-7";
  if (km < 10) return "7-10";
  return "10+";
}

function laterThan(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const minutes = Math.min(12 * 60, (h ?? 9) * 60 + (m ?? 0) + 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Reason codes that should never move taste signals. Exported for the tests. */
export const NEUTRAL_REASONS: NotDoneReason[] = ["PLANS_CHANGED", "WEATHER", "SOMETHING_ELSE"];
