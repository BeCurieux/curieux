"use server";

/**
 * Server actions for the signed-in app.
 *
 * Every one of these follows the same shape: authenticate, validate with Zod
 * at the boundary (§50), confirm the caller owns the household, then act. RLS
 * is the backstop rather than the only line — several of these need the
 * service client to write tables customers cannot write directly, so the
 * ownership check here is doing real work.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, serviceClient, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { getMarket } from "@/config/markets";
import { GENERATION_CONFIG } from "@/config/planner";
import { sanitiseUserText } from "@/lib/security/sanitise";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { regenerateAfterCheckin } from "@/lib/jobs/scheduler";
import { enqueue } from "@/lib/jobs/queue";
import { track } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { upcomingWeekendDate } from "@/lib/util/time";
import type { Household } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Resolve the caller’s household, or fail. Used by every action below. */
async function requireHousehold(): Promise<{ household: Household; userId: string }> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  const household = await repo.getHouseholdForUser(userClient(), user.id);
  if (!household) throw new Error("No household found");

  return { household, userId: user.id };
}

// ------------------------------------------------------------ check-in

const checkinSchema = z.object({
  energy: z.enum(["LOW", "NORMAL", "HIGH"]).nullable(),
  budget: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  time: z.enum(["FEW_HOURS", "HALF_DAY", "WHOLE_DAY"]).nullable(),
  note: z.string().max(500).nullable(),
});

/**
 * The ten-second check-in (§10).
 *
 * If a plan already exists for this weekend it is regenerated (§41), because
 * the check-in changes the inputs to scoring — telling us you are exhausted
 * and then receiving the same twelve-kilometre walk would make the question
 * pointless.
 */
export async function submitCheckin(input: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid check-in" };

  const { household } = await requireHousehold();
  const market = getMarket(household.market_id);
  const weekendDate = upcomingWeekendDate(market);

  const db = serviceClient();
  const { error } = await db.from("weekend_checkins").upsert(
    {
      household_id: household.id,
      weekend_date: weekendDate,
      energy: parsed.data.energy,
      budget: parsed.data.budget,
      time: parsed.data.time,
      note: parsed.data.note ? sanitiseUserText(parsed.data.note, 500) : null,
    },
    { onConflict: "household_id,weekend_date" }
  );
  if (error) return { ok: false, error: "Couldn’t save that" };

  const { regenerated } = await regenerateAfterCheckin(db, household.id, weekendDate);

  track(household.id, ANALYTICS_EVENTS.CHECKIN_COMPLETED, { weekend_date: weekendDate });
  revalidatePath("/app");

  return {
    ok: true,
    message: regenerated
      ? "Got it — we’re rebuilding your weekend now."
      : "Got it. We’ll use this on Thursday.",
  };
}

// ------------------------------------------------------------ plan opened

export async function markOpened(planId: string): Promise<ActionResult> {
  const { household } = await requireHousehold();

  const db = serviceClient();
  const plan = await repo.getPlan(db, planId);
  if (!plan || plan.household_id !== household.id) return { ok: false, error: "Not found" };

  if (plan.status === "DELIVERED" || plan.status === "READY") {
    await repo.markPlanOpened(db, planId);
    await repo.recordPlanEvent(db, {
      householdId: household.id,
      planId,
      type: "PLAN_OPENED",
    });
    track(household.id, ANALYTICS_EVENTS.PLAN_OPENED, { plan_id: planId });
  }

  return { ok: true };
}

// ------------------------------------------------------------ feedback

const feedbackSchema = z.object({
  planId: z.string().uuid(),
  didIt: z.enum(["YES", "NO"]),
  rating: z.enum(["LOVED", "GOOD", "FINE", "NOT_FOR_ME"]).nullable(),
  reason: z
    .enum([
      "PLANS_CHANGED",
      "TOO_TIRED",
      "TOO_EXPENSIVE",
      "WEATHER",
      "TOO_FAR",
      "DIDNT_APPEAL",
      "SOMETHING_ELSE",
    ])
    .nullable(),
  note: z.string().max(500).nullable(),
});

/**
 * "Did you do it?" (§24) — the most valuable single interaction in the
 * product. The write is deliberately simple and the learning is queued, so
 * that answering never waits on the taste model.
 */
export async function submitFeedback(input: unknown): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid feedback" };

  const { household } = await requireHousehold();
  const db = serviceClient();

  const plan = await repo.getPlan(db, parsed.data.planId);
  if (!plan || plan.household_id !== household.id) return { ok: false, error: "Not found" };

  const { error } = await db.from("plan_feedback").upsert(
    {
      plan_id: parsed.data.planId,
      household_id: household.id,
      did_it: parsed.data.didIt,
      rating: parsed.data.rating,
      not_done_reason: parsed.data.reason,
      note: parsed.data.note ? sanitiseUserText(parsed.data.note, 500) : null,
    },
    { onConflict: "plan_id" }
  );
  if (error) return { ok: false, error: "Couldn’t save that" };

  await enqueue(
    db,
    "process-feedback",
    { plan_id: parsed.data.planId, household_id: household.id },
    `process-feedback:${parsed.data.planId}`
  );

  if (parsed.data.rating) {
    track(household.id, ANALYTICS_EVENTS.PLAN_RATING, {
      plan_id: parsed.data.planId,
      rating: parsed.data.rating,
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/history");
  return { ok: true, message: "Thanks — next weekend will be better for it." };
}

// ------------------------------------------------------------ swap

const swapSchema = z.object({
  planId: z.string().uuid(),
  reason: z.enum(["MAKE_IT_EASIER", "SPEND_LESS", "STAY_CLOSER", "MORE_ACTIVE", "SURPRISE_ME"]),
});

/**
 * Swap this plan (§25).
 *
 * Buttons rather than a chat box, deliberately: a free-text "make it different"
 * is an invitation to a conversation, and the product’s whole claim is that you
 * do not have to have one. The reason is stored because why someone swapped is
 * excellent preference data.
 *
 * Regeneration is bounded per weekend so a customer cannot spend our provider
 * budget by tapping repeatedly (§25).
 */
export async function requestSwap(input: unknown): Promise<ActionResult> {
  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const { household } = await requireHousehold();
  const db = serviceClient();

  const plan = await repo.getPlan(db, parsed.data.planId);
  if (!plan || plan.household_id !== household.id) return { ok: false, error: "Not found" };
  if (plan.status === "COMPLETED") {
    return { ok: false, error: "That weekend has already happened" };
  }

  const limit = rateLimitKey(`swap:${household.id}:${plan.weekend_date}`, {
    limit: GENERATION_CONFIG.max_swaps_per_weekend,
    windowSeconds: 7 * 24 * 3600,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: "You’ve swapped this weekend a few times already — we’ll keep this one for now.",
    };
  }

  await repo.recordPlanEvent(db, {
    householdId: household.id,
    planId: plan.id,
    type: "PLAN_SWAPPED",
    metadata: { reason: parsed.data.reason },
  });

  await db
    .from("plans")
    .update({ status: "REJECTED", swap_reason: parsed.data.reason })
    .eq("id", plan.id);

  await enqueue(
    db,
    "generate-weekend-plan",
    {
      household_id: household.id,
      weekend_date: plan.weekend_date,
      attempt: 1,
      swap_reason: parsed.data.reason,
      exclude_plan_id: plan.id,
    },
    `swap:${plan.id}:${parsed.data.reason}`
  );

  track(household.id, ANALYTICS_EVENTS.PLAN_SWAP_REQUESTED, {
    plan_id: plan.id,
    swap_reason: parsed.data.reason,
  });

  revalidatePath("/app");
  return { ok: true, message: "Building you a different one — give it a minute." };
}

// ------------------------------------------------------------ preferences

const preferencesSchema = z.object({
  max_travel_minutes: z.number().int().min(15).max(120).optional(),
  budget_band: z.enum(["FREE", "UNDER_75", "75_150", "150_250", "FLEXIBLE"]).optional(),
  activity_level: z.enum(["GENTLE", "EASY", "MODERATE", "ACTIVE"]).optional(),
  desired_activity_level: z.enum(["GENTLE", "EASY", "MODERATE", "ACTIVE"]).optional(),
  nudge: z.enum(["NONE", "LITTLE", "YES"]).optional(),
  liked_categories: z.array(z.string().max(40)).max(40).optional(),
  dislikes: z.array(z.string().max(40)).max(20).optional(),
  hard_no: z.string().max(300).nullable().optional(),
  start_time_preference: z
    .enum(["EARLY", "AROUND_9", "AROUND_10", "LATE_MORNING", "FLEXIBLE"])
    .optional(),
  time_budget: z.enum(["FEW_HOURS", "HALF_DAY", "MOST_OF_DAY", "FULL_WEEKEND"]).optional(),
  transport_modes: z.array(z.enum(["DRIVING", "TRANSIT", "WALKING", "CYCLING"])).min(1).optional(),
  crowd_tolerance: z.number().min(0).max(1).optional(),
});

export async function updatePreferences(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid preferences" };

  const { household } = await requireHousehold();

  const patch = { ...parsed.data };
  if (patch.hard_no) patch.hard_no = sanitiseUserText(patch.hard_no, 300);

  // The user client is correct here: RLS permits a household member to update
  // their own preference row, and using it means a bug cannot touch another
  // household’s.
  const { error } = await userClient()
    .from("preference_profiles")
    .update(patch)
    .eq("household_id", household.id);

  if (error) return { ok: false, error: "Couldn’t save your preferences" };

  // A deliberate edit is stronger evidence than the original onboarding answer.
  if (patch.liked_categories) {
    await repo.applySignalDeltas(
      serviceClient(),
      household.id,
      patch.liked_categories.map((categoryId) => ({
        dimension: "category",
        value: categoryId,
        delta: 0.5,
        source: "MANUAL_EDIT" as const,
        evidence: "Selected when editing preferences",
      }))
    );
  }

  revalidatePath("/app/preferences");
  return { ok: true, message: "Saved." };
}

// ------------------------------------------------------------ account

/**
 * Account deletion (§52). Runs the SQL function, which removes personal data
 * and keeps financial records with identifying details stripped.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await serviceClient().rpc("delete_account", { p_user_id: user.id });
  if (error) return { ok: false, error: "Couldn’t delete the account — please email us" };

  return { ok: true, message: "Your account has been deleted." };
}

/** Data export (§52). Everything we hold about this household, as JSON. */
export async function exportData(): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { household } = await requireHousehold();
  const db = userClient();

  const [members, preferences, taste, stats, plans, feedback, checkins] = await Promise.all([
    repo.getMembers(db, household.id),
    repo.getPreferences(db, household.id),
    repo.getTasteSignals(db, household.id),
    repo.getCategoryStats(db, household.id),
    repo.getPlanHistory(db, household.id, 500),
    db.from("plan_feedback").select("*").eq("household_id", household.id),
    db.from("weekend_checkins").select("*").eq("household_id", household.id),
  ]);

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      household,
      members,
      preferences,
      taste_signals: taste,
      category_stats: stats,
      plans,
      feedback: feedback.data ?? [],
      checkins: checkins.data ?? [],
    },
  };
}
