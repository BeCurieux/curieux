/**
 * Job handlers (§40, §41).
 *
 * The weekly cycle for a market:
 *
 *   Wednesday evening   queue generation for every active household
 *   (generation)        build, verify, persist as READY or PENDING_REVIEW
 *   Thursday 07:30      deliver whatever is READY
 *   Sunday 18:30        ask "did you do it?"
 *   (on answer)         update the taste model, so next week is better
 *
 * Every handler is idempotent, because the queue will retry and because cron
 * fires are not exactly-once. Idempotency is enforced structurally — unique
 * indexes and idempotency keys — rather than by checking-then-acting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMarket } from "@/config/markets";
import { flags } from "@/config/flags";
import { GENERATION_CONFIG } from "@/config/planner";
import { brand, url } from "@/config/brand";
import { buildAIProvider } from "@/lib/ai";
import { buildProviders } from "@/lib/providers";
import { buildPlanningContext } from "@/lib/planner/context";
import { generateWeekend } from "@/lib/planner/generation";
import { persistPlan } from "@/lib/db/persist-plan";
import * as repo from "@/lib/db/repository";
import { buildNotificationProvider } from "@/lib/notifications";
import {
  feedbackRequestEmail,
  generationFailedEmail,
  pilotEndingEmail,
  weeklyPlanEmail,
} from "@/lib/notifications/templates";
import { advancePilotWeek } from "@/lib/billing/stripe";
import { deltasFromFeedback } from "@/lib/taste/updater";
import { track } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { addDays, deliveryInstant, displayDate, feedbackInstant } from "@/lib/util/time";
import { enqueue, planJobKey, type Job } from "./queue";
import type { PlanWithItems } from "@/lib/types";

export type JobHandler = (db: SupabaseClient, payload: Record<string, unknown>) => Promise<void>;

// ------------------------------------------------------------ generation

/**
 * Build a household's weekend (§41).
 *
 * The whole pipeline runs here. On failure we do not deliver anything: the run
 * is recorded with its diagnostics, a retry is queued, and if the retries are
 * exhausted the customer is told honestly that we are still working on it
 * rather than being sent a plan we do not believe in (§39).
 */
export const generateWeekendPlan: JobHandler = async (db, payload) => {
  const householdId = String(payload.household_id);
  const weekendDate = String(payload.weekend_date);
  const attempt = Number(payload.attempt ?? 1);

  const household = await repo.getHousehold(db, householdId);
  if (!household || household.deleted_at) return;

  const market = getMarket(household.market_id);

  // Already have a live plan for this weekend? Then this is a duplicate fire.
  const existing = await repo.getPlansForWeekend(db, householdId, weekendDate);
  if (existing.some((p) => p.plan_type === "PRIMARY")) return;

  const [members, preferences, taste, categoryStats, checkin] = await Promise.all([
    repo.getMembers(db, householdId),
    repo.getPreferences(db, householdId),
    repo.getTasteSignals(db, householdId),
    repo.getCategoryStats(db, householdId),
    repo.getCheckin(db, householdId, weekendDate),
  ]);

  if (!preferences || household.home_lat === null) {
    // Onboarding is incomplete. Not a failure worth alerting on.
    return;
  }

  const run = await repo.startGenerationRun(db, householdId, weekendDate, attempt);
  const providers = buildProviders();

  const ai = buildAIProvider({
    householdId,
    generationRunId: run.id,
    sink: (record) => repo.recordAIRun(db, record),
  });

  const weather = await providers.weather.getForecast({
    lat: household.home_lat,
    lng: household.home_lng ?? 0,
    date: weekendDate,
    timezone: market.timezone,
  });

  const ctx = buildPlanningContext({
    household,
    members,
    preferences,
    taste,
    categoryStats,
    checkin,
    market,
    weekendDate,
    weather,
  });

  const result = await generateWeekend(ctx, ai, providers, {
    onStage: (stage) => repo.updateGenerationStage(db, run.id, stage),
  });

  await repo.recordProviderUsage(db, run.id, householdId, providers.ledger.entries());
  await repo.finishGenerationRun(db, run.id, {
    stage: result.diagnostics.stage,
    succeeded: result.ok,
    error: result.failureReason,
    providerCostCents: providers.ledger.totalCents(),
    candidateCount: result.diagnostics.candidatesRetrieved,
    diagnostics: result.diagnostics,
  });

  if (!result.ok || !result.primary) {
    await handleGenerationFailure(db, {
      householdId,
      weekendDate,
      attempt,
      reason: result.failureReason ?? "unknown",
    });
    return;
  }

  const plan = await persistPlan(db, {
    ctx,
    market,
    bundle: result.primary,
    copy: result.copy.get(result.primary.bundle_id),
    planType: "PRIMARY",
    confidence: result.confidence,
    generationRunId: run.id,
    aiRunId: null,
  });

  if (result.backup) {
    await persistPlan(db, {
      ctx,
      market,
      bundle: result.backup,
      copy: result.copy.get(result.backup.bundle_id),
      planType: "BACKUP",
      confidence: result.confidence * 0.9,
      generationRunId: run.id,
      aiRunId: null,
    });
  }

  // Suggesting something counts, whether or not they do it (§18).
  for (const categoryId of result.primary.anchor.categories) {
    await repo.bumpCategoryStat(db, householdId, categoryId, {
      suggested: 1,
      suggestedAt: new Date().toISOString(),
    });
  }

  await repo.recordPlanEvent(db, {
    householdId,
    planId: plan.id,
    type: "PLAN_GENERATED",
    metadata: { confidence: result.confidence, base_score: result.primary.base_score },
  });
  track(householdId, ANALYTICS_EVENTS.PLAN_GENERATED, {
    plan_id: plan.id,
    weekend_date: weekendDate,
    market_id: market.market_id,
    confidence: result.confidence,
  });

  // Queue delivery for the market's Thursday morning. With founder review on
  // (§42) the delivery job will find the plan still PENDING_REVIEW and skip it
  // until a human approves — which itself re-queues delivery.
  await enqueue(
    db,
    "deliver-weekend-plan",
    { household_id: householdId, weekend_date: weekendDate },
    planJobKey("deliver-weekend-plan", householdId, weekendDate),
    deliveryInstant(market, weekendDate)
  );
};

async function handleGenerationFailure(
  db: SupabaseClient,
  input: { householdId: string; weekendDate: string; attempt: number; reason: string }
): Promise<void> {
  if (input.attempt < GENERATION_CONFIG.max_generation_attempts) {
    // Retry in an hour with a fresh key so the queue accepts it. Conditions
    // change: weather updates, provider hiccups pass.
    await enqueue(
      db,
      "generate-weekend-plan",
      {
        household_id: input.householdId,
        weekend_date: input.weekendDate,
        attempt: input.attempt + 1,
      },
      `${planJobKey("generate-weekend-plan", input.householdId, input.weekendDate)}:retry${input.attempt + 1}`,
      new Date(Date.now() + 60 * 60 * 1000)
    );
    return;
  }

  // Out of attempts: flag it for a human and tell the customer the truth (§39).
  await db.from("admin_flags").insert({
    household_id: input.householdId,
    reason: `Generation failed after ${input.attempt} attempts: ${input.reason}`,
  });

  const email = await recipientEmail(db, input.householdId);
  if (email) {
    const notifier = buildNotificationProvider();
    const rendered = generationFailedEmail({
      unsubscribeUrl: await unsubscribeUrl(db, input.householdId),
    });
    await notifier.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `failed:${input.householdId}:${input.weekendDate}`,
    });
  }
}

// ------------------------------------------------------------ delivery

/** Thursday morning (§23). Sends whatever is READY; skips what is not. */
export const deliverWeekendPlan: JobHandler = async (db, payload) => {
  const householdId = String(payload.household_id);
  const weekendDate = String(payload.weekend_date);

  const household = await repo.getHousehold(db, householdId);
  if (!household || household.deleted_at) return;
  const market = getMarket(household.market_id);

  const plans = await repo.getPlansForWeekend(db, householdId, weekendDate);
  const primary = plans.find((p) => p.plan_type === "PRIMARY");
  const backup = plans.find((p) => p.plan_type === "BACKUP") ?? null;

  if (!primary) return;

  // Founder review still pending, or already sent: either way, nothing to do.
  if (primary.status !== "READY") return;

  const preferences = await db
    .from("notification_preferences")
    .select("weekly_plan")
    .eq("household_id", householdId)
    .maybeSingle();
  if (preferences.data && preferences.data.weekly_plan === false) return;

  const email = await recipientEmail(db, householdId);
  if (!email) return;

  const rendered = weeklyPlanEmail({
    plan: primary,
    backup,
    market,
    recipientName: null,
    unsubscribeUrl: await unsubscribeUrl(db, householdId),
  });

  const idempotencyKey = `plan:${primary.id}`;
  const notifier = buildNotificationProvider();
  const result = await notifier.sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey,
  });

  await db.from("notifications").upsert(
    {
      household_id: householdId,
      plan_id: primary.id,
      kind: "WEEKLY_PLAN",
      subject: rendered.subject,
      provider_id: result.providerId,
      status: result.ok ? "sent" : "failed",
      error: result.error,
      idempotency_key: idempotencyKey,
      sent_at: result.ok ? new Date().toISOString() : null,
    },
    { onConflict: "idempotency_key" }
  );

  if (!result.ok) throw new Error(`Delivery failed: ${result.error}`);

  const now = new Date().toISOString();
  await db
    .from("plans")
    .update({ status: "DELIVERED", delivered_at: now })
    .in("id", [primary.id, ...(backup ? [backup.id] : [])]);

  await repo.recordPlanEvent(db, {
    householdId,
    planId: primary.id,
    type: "PLAN_DELIVERED",
  });
  track(householdId, ANALYTICS_EVENTS.PLAN_DELIVERED, {
    plan_id: primary.id,
    weekend_date: weekendDate,
    market_id: market.market_id,
  });

  // A delivery is what a pilot week actually is (§29) — not a payment, not a
  // calendar week. Four delivered weekends is the deal.
  const pilot = await advancePilotWeek(db, householdId);
  if (pilot.completed) {
    await enqueue(
      db,
      "subscription-conversion-reminder",
      { household_id: householdId },
      `convert:${householdId}`,
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
  }

  // Sunday evening: did you do it?
  if (flags().feedbackEmails) {
    await enqueue(
      db,
      "send-feedback-request",
      { household_id: householdId, plan_id: primary.id },
      `feedback:${primary.id}`,
      feedbackInstant(market, weekendDate)
    );
  }
};

// ------------------------------------------------------------ feedback

export const sendFeedbackRequest: JobHandler = async (db, payload) => {
  const householdId = String(payload.household_id);
  const planId = String(payload.plan_id);

  const plan = await repo.getPlan(db, planId);
  if (!plan) return;
  // Already answered — do not nag.
  if (plan.status === "COMPLETED") return;

  const existing = await db
    .from("plan_feedback")
    .select("id")
    .eq("plan_id", planId)
    .maybeSingle();
  if (existing.data) return;

  const household = await repo.getHousehold(db, householdId);
  if (!household) return;

  const preferences = await db
    .from("notification_preferences")
    .select("feedback_request, unsubscribe_token")
    .eq("household_id", householdId)
    .maybeSingle();
  if (preferences.data && preferences.data.feedback_request === false) return;

  const email = await recipientEmail(db, householdId);
  if (!email) return;

  const rendered = feedbackRequestEmail({
    plan,
    market: getMarket(household.market_id),
    token: String(preferences.data?.unsubscribe_token ?? ""),
    unsubscribeUrl: await unsubscribeUrl(db, householdId),
  });

  const idempotencyKey = `feedback:${planId}`;
  const result = await buildNotificationProvider().sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey,
  });

  await db.from("notifications").upsert(
    {
      household_id: householdId,
      plan_id: planId,
      kind: "FEEDBACK_REQUEST",
      subject: rendered.subject,
      provider_id: result.providerId,
      status: result.ok ? "sent" : "failed",
      error: result.error,
      idempotency_key: idempotencyKey,
      sent_at: result.ok ? new Date().toISOString() : null,
    },
    { onConflict: "idempotency_key" }
  );
};

/**
 * Learn from an answer (§24). This is the job that makes next week better, and
 * therefore the one that makes the product worth paying for twice.
 */
export const processFeedback: JobHandler = async (db, payload) => {
  const planId = String(payload.plan_id);
  const householdId = String(payload.household_id);

  const plan = await repo.getPlan(db, planId);
  if (!plan) return;

  const { data: feedbackRow } = await db
    .from("plan_feedback")
    .select("*")
    .eq("plan_id", planId)
    .maybeSingle();
  if (!feedbackRow) return;

  const feedback = feedbackRow as {
    did_it: "YES" | "NO";
    rating: "LOVED" | "GOOD" | "FINE" | "NOT_FOR_ME" | null;
    not_done_reason: string | null;
  };

  const categoriesByItem = await categoriesForPlanItems(db, plan);

  const deltas = deltasFromFeedback(
    plan,
    {
      did_it: feedback.did_it,
      rating: feedback.rating,
      not_done_reason: feedback.not_done_reason as never,
    },
    categoriesByItem
  );
  await repo.applySignalDeltas(db, householdId, deltas);

  const anchorItem = plan.items.find((i) => i.is_critical) ?? plan.items[0];
  const anchorCategories = anchorItem ? (categoriesByItem.get(anchorItem.id) ?? []) : [];
  const now = new Date().toISOString();

  for (const categoryId of anchorCategories) {
    await repo.bumpCategoryStat(db, householdId, categoryId, {
      completed: feedback.did_it === "YES" ? 1 : 0,
      accepted: feedback.did_it === "YES" ? 1 : 0,
      rejected: feedback.did_it === "NO" ? 1 : 0,
      loved: feedback.rating === "LOVED" ? 1 : 0,
      completedAt: feedback.did_it === "YES" ? now : undefined,
    });
  }

  if (feedback.did_it === "YES") {
    await db
      .from("plans")
      .update({ status: "COMPLETED", completed_at: now })
      .eq("id", planId);
  }

  await repo.recordPlanEvent(db, {
    householdId,
    planId,
    type: feedback.did_it === "YES" ? "DID_IT_YES" : "DID_IT_NO",
    metadata: { rating: feedback.rating, reason: feedback.not_done_reason },
  });

  track(
    householdId,
    feedback.did_it === "YES" ? ANALYTICS_EVENTS.DID_IT_YES : ANALYTICS_EVENTS.DID_IT_NO,
    { plan_id: planId, rating: feedback.rating ?? undefined, reason: feedback.not_done_reason ?? undefined }
  );
};

// ------------------------------------------------------------ lifecycle

export const expirePilot: JobHandler = async (db, payload) => {
  const householdId = String(payload.household_id);
  await db
    .from("subscriptions")
    .update({ status: "EXPIRED" })
    .eq("household_id", householdId)
    .eq("status", "PILOT_ACTIVE")
    .gte("pilot_week_number", 4);
};

export const subscriptionConversionReminder: JobHandler = async (db, payload) => {
  const householdId = String(payload.household_id);

  const { count } = await db
    .from("plan_events")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("event_type", "DID_IT_YES");

  const email = await recipientEmail(db, householdId);
  if (!email) return;

  const rendered = pilotEndingEmail({
    weekendsDone: 4,
    didItCount: count ?? 0,
    upgradeUrl: url("/app/billing?offer=annual"),
    unsubscribeUrl: await unsubscribeUrl(db, householdId),
  });

  const idempotencyKey = `pilot-ending:${householdId}`;
  const result = await buildNotificationProvider().sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey,
  });

  await db.from("notifications").upsert(
    {
      household_id: householdId,
      kind: "PILOT_ENDING",
      subject: rendered.subject,
      provider_id: result.providerId,
      status: result.ok ? "sent" : "failed",
      idempotency_key: idempotencyKey,
      sent_at: result.ok ? new Date().toISOString() : null,
    },
    { onConflict: "idempotency_key" }
  );

  track(householdId, ANALYTICS_EVENTS.PILOT_COMPLETED, {});
};

export const retryFailedGeneration: JobHandler = async (db, payload) => {
  await generateWeekendPlan(db, { ...payload, attempt: 1 });
};

export const verifyWeekendPlan: JobHandler = async (db, payload) => {
  // Re-verification before delivery, for plans that sat in review for a day or
  // more. Rather than duplicate the pipeline, we regenerate: a plan built on
  // Wednesday whose anchor closed on Thursday should be replaced, not patched.
  const householdId = String(payload.household_id);
  const weekendDate = String(payload.weekend_date);

  const plans = await repo.getPlansForWeekend(db, householdId, weekendDate);
  const primary = plans.find((p) => p.plan_type === "PRIMARY");
  if (!primary) return;

  const staleHours = (Date.now() - new Date(primary.created_at).getTime()) / 3_600_000;
  if (staleHours < 36) return;

  await db.from("plans").update({ status: "REJECTED" }).eq("id", primary.id);
  await enqueue(
    db,
    "generate-weekend-plan",
    { household_id: householdId, weekend_date: weekendDate, attempt: 1 },
    `${planJobKey("generate-weekend-plan", householdId, weekendDate)}:refresh`
  );
};

export const HANDLERS: Record<string, JobHandler> = {
  "generate-weekend-plan": generateWeekendPlan,
  "verify-weekend-plan": verifyWeekendPlan,
  "deliver-weekend-plan": deliverWeekendPlan,
  "send-feedback-request": sendFeedbackRequest,
  "process-feedback": processFeedback,
  "expire-pilot": expirePilot,
  "subscription-conversion-reminder": subscriptionConversionReminder,
  "retry-failed-generation": retryFailedGeneration,
};

export async function runJob(db: SupabaseClient, job: Job): Promise<void> {
  const handler = HANDLERS[job.type];
  if (!handler) throw new Error(`No handler for job type ${job.type}`);
  await handler(db, job.payload);
}

// ------------------------------------------------------------ helpers

async function recipientEmail(db: SupabaseClient, householdId: string): Promise<string | null> {
  const { data } = await db
    .from("households")
    .select("owner_user_id, profiles:owner_user_id(email)")
    .eq("id", householdId)
    .maybeSingle();

  const profile = (data as { profiles?: { email?: string } | null } | null)?.profiles;
  return profile?.email ?? null;
}

async function unsubscribeUrl(db: SupabaseClient, householdId: string): Promise<string> {
  const { data } = await db
    .from("notification_preferences")
    .select("unsubscribe_token")
    .eq("household_id", householdId)
    .maybeSingle();

  const token = data?.unsubscribe_token as string | undefined;
  return token ? url(`/unsubscribe?t=${token}`) : url("/app/settings");
}

/**
 * Which categories a plan's items belonged to. Read from place_refs rather
 * than stored on the item, so a category taxonomy change does not require
 * rewriting history.
 */
async function categoriesForPlanItems(
  db: SupabaseClient,
  plan: PlanWithItems
): Promise<Map<string, string[]>> {
  const placeIds = plan.items
    .map((i) => i.provider_place_id)
    .filter((id): id is string => Boolean(id));

  if (placeIds.length === 0) return new Map();

  const { data } = await db
    .from("place_refs")
    .select("provider_place_id, categories")
    .in("provider_place_id", placeIds);

  const byPlaceId = new Map(
    (data ?? []).map((row) => {
      const r = row as { provider_place_id: string; categories: string[] };
      return [r.provider_place_id, r.categories];
    })
  );

  const result = new Map<string, string[]>();
  for (const item of plan.items) {
    if (!item.provider_place_id) continue;
    result.set(item.id, byPlaceId.get(item.provider_place_id) ?? []);
  }
  return result;
}

/** Used by the scheduler to describe when the first plan lands. */
export function firstDeliveryLabel(marketId: string, weekendDate: string): string {
  const market = getMarket(marketId);
  const deliveryDate = addDays(weekendDate, market.delivery_day - 6);
  return displayDate(deliveryDate, market.locale, market.timezone);
}
