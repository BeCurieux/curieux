/**
 * Weekly scheduling (§41).
 *
 * The cron endpoint fires hourly; this module decides what, if anything, is due
 * in each market at that moment. Doing it this way rather than with one cron
 * per market means adding London is a config change — the scheduler already
 * asks every live market what its local time is (§5).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { liveMarkets, type Market } from "@/config/markets";
import * as repo from "@/lib/db/repository";
import { enqueue, planJobKey } from "./queue";
import { localParts, upcomingWeekendDate } from "@/lib/util/time";

export interface ScheduleOutcome {
  market_id: string;
  action: "generation_queued" | "nothing_due";
  weekend_date: string;
  households: number;
}

/**
 * Queue generation for every market whose generation hour has just arrived.
 *
 * "Just arrived" means the current local hour equals the configured hour: with
 * an hourly cron this fires exactly once per week per market. Re-firing is
 * harmless anyway — the idempotency key deduplicates — but a plan generated
 * twice would waste provider spend, so the hour check is not merely cosmetic.
 */
export async function runScheduler(
  db: SupabaseClient,
  now: Date = new Date()
): Promise<ScheduleOutcome[]> {
  const outcomes: ScheduleOutcome[] = [];

  for (const market of liveMarkets()) {
    const weekendDate = upcomingWeekendDate(market, now);

    if (!isGenerationHour(market, now)) {
      outcomes.push({
        market_id: market.market_id,
        action: "nothing_due",
        weekend_date: weekendDate,
        households: 0,
      });
      continue;
    }

    const households = await repo.householdsDueForGeneration(db, market.market_id);

    for (const household of households) {
      await enqueue(
        db,
        "generate-weekend-plan",
        {
          household_id: household.household_id,
          weekend_date: weekendDate,
          attempt: 1,
        },
        planJobKey("generate-weekend-plan", household.household_id, weekendDate)
      );
    }

    outcomes.push({
      market_id: market.market_id,
      action: "generation_queued",
      weekend_date: weekendDate,
      households: households.length,
    });
  }

  return outcomes;
}

export function isGenerationHour(market: Market, now: Date): boolean {
  const parts = localParts(now, market.timezone);
  const [hour] = market.generation_time.split(":").map(Number);
  return parts.weekday === market.generation_day && parts.hour === hour;
}

/**
 * Queue a plan for a household that has just finished onboarding, so their
 * first weekend does not wait for the next Wednesday. Uses a distinct
 * idempotency key so it cannot collide with the scheduled run.
 */
export async function queueFirstPlan(
  db: SupabaseClient,
  householdId: string,
  market: Market,
  now: Date = new Date()
): Promise<string> {
  const weekendDate = upcomingWeekendDate(market, now);
  await enqueue(
    db,
    "generate-weekend-plan",
    { household_id: householdId, weekend_date: weekendDate, attempt: 1 },
    planJobKey("generate-weekend-plan", householdId, weekendDate)
  );
  return weekendDate;
}

/**
 * A check-in submitted after generation should change the plan (§41). We
 * discard the existing plan and regenerate rather than adjusting it: the
 * check-in changes the inputs to scoring, and re-running is both simpler and
 * more likely to be right than patching a plan built on stale assumptions.
 */
export async function regenerateAfterCheckin(
  db: SupabaseClient,
  householdId: string,
  weekendDate: string
): Promise<{ regenerated: boolean }> {
  const plans = await repo.getPlansForWeekend(db, householdId, weekendDate);
  const primary = plans.find((p) => p.plan_type === "PRIMARY");

  // A completed weekend is history; leave it alone.
  if (primary?.status === "COMPLETED") return { regenerated: false };

  if (plans.length > 0) {
    await db
      .from("plans")
      .update({ status: "REJECTED" })
      .in(
        "id",
        plans.map((p) => p.id)
      );
  }

  await enqueue(
    db,
    "generate-weekend-plan",
    { household_id: householdId, weekend_date: weekendDate, attempt: 1 },
    `${planJobKey("generate-weekend-plan", householdId, weekendDate)}:checkin:${Date.now()}`
  );

  return { regenerated: true };
}
