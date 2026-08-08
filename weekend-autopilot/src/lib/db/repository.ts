/**
 * Storage access for the planner and the jobs.
 *
 * Kept as plain functions over a SupabaseClient rather than an ORM: the queries
 * are few, the shapes are known, and the job runner needs to pass a service
 * client while request handlers pass a user client. Which client is supplied
 * determines what RLS permits, so the caller — not this module — decides
 * authority.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMarket } from "@/config/markets";
import type {
  CategoryStats,
  GenerationRun,
  Household,
  HouseholdMember,
  Plan,
  PlanEventType,
  PlanItem,
  PlanWithItems,
  PreferenceProfile,
  Subscription,
  TasteSignal,
  WeekendCheckin,
} from "@/lib/types";
import type { SignalDelta } from "@/lib/taste/signals";
import { applyDelta } from "@/lib/taste/signals";
import type { UsageRecord } from "@/lib/providers";
import type { AIRunRecord } from "@/lib/ai/provider";

// ------------------------------------------------------------ households

export async function getHouseholdForUser(
  db: SupabaseClient,
  userId: string
): Promise<Household | null> {
  const { data, error } = await db
    .from("households")
    .select("*, household_users!inner(user_id)")
    .eq("household_users.user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getHouseholdForUser: ${error.message}`);
  if (!data) return null;

  const { household_users: _members, ...household } = data as Household & {
    household_users: unknown;
  };
  return household;
}

export async function getHousehold(db: SupabaseClient, id: string): Promise<Household | null> {
  const { data, error } = await db.from("households").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getHousehold: ${error.message}`);
  return (data as Household) ?? null;
}

export async function getMembers(
  db: SupabaseClient,
  householdId: string
): Promise<HouseholdMember[]> {
  const { data, error } = await db
    .from("household_members")
    .select("*")
    .eq("household_id", householdId)
    .order("member_type", { ascending: true });
  if (error) throw new Error(`getMembers: ${error.message}`);
  return (data ?? []) as HouseholdMember[];
}

export async function getPreferences(
  db: SupabaseClient,
  householdId: string
): Promise<PreferenceProfile | null> {
  const { data, error } = await db
    .from("preference_profiles")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw new Error(`getPreferences: ${error.message}`);
  return (data as PreferenceProfile) ?? null;
}

export async function getTasteSignals(
  db: SupabaseClient,
  householdId: string
): Promise<TasteSignal[]> {
  const { data, error } = await db
    .from("taste_signals")
    .select("*")
    .eq("household_id", householdId);
  if (error) throw new Error(`getTasteSignals: ${error.message}`);
  return (data ?? []) as TasteSignal[];
}

export async function getCategoryStats(
  db: SupabaseClient,
  householdId: string
): Promise<CategoryStats[]> {
  const { data, error } = await db
    .from("category_stats")
    .select("*")
    .eq("household_id", householdId);
  if (error) throw new Error(`getCategoryStats: ${error.message}`);
  return (data ?? []) as CategoryStats[];
}

export async function getCheckin(
  db: SupabaseClient,
  householdId: string,
  weekendDate: string
): Promise<WeekendCheckin | null> {
  const { data, error } = await db
    .from("weekend_checkins")
    .select("*")
    .eq("household_id", householdId)
    .eq("weekend_date", weekendDate)
    .maybeSingle();
  if (error) throw new Error(`getCheckin: ${error.message}`);
  return (data as WeekendCheckin) ?? null;
}

// ------------------------------------------------------------ taste writes

/**
 * Merge signal deltas into the stored model.
 *
 * Read-modify-write on a per-household basis. Contention is not a concern —
 * a household's signals are only ever touched by its own generation or
 * feedback job, and those are serialised by the queue.
 */
export async function applySignalDeltas(
  db: SupabaseClient,
  householdId: string,
  deltas: SignalDelta[]
): Promise<void> {
  if (deltas.length === 0) return;

  const existing = await getTasteSignals(db, householdId);
  const index = new Map(existing.map((s) => [`${s.dimension}:${s.value}`, s]));

  const rows = deltas.map((delta) => {
    const current = index.get(`${delta.dimension}:${delta.value}`) ?? null;
    const { weight, confidence } = applyDelta(current, delta);
    return {
      household_id: householdId,
      dimension: delta.dimension,
      value: delta.value,
      weight,
      confidence,
      source: delta.source,
      evidence: delta.evidence,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await db
    .from("taste_signals")
    .upsert(rows, { onConflict: "household_id,dimension,value" });
  if (error) throw new Error(`applySignalDeltas: ${error.message}`);
}

export async function bumpCategoryStat(
  db: SupabaseClient,
  householdId: string,
  categoryId: string,
  counts: {
    suggested?: number;
    accepted?: number;
    completed?: number;
    loved?: number;
    rejected?: number;
    suggestedAt?: string;
    completedAt?: string;
  }
): Promise<void> {
  const { error } = await db.rpc("bump_category_stat", {
    p_household_id: householdId,
    p_category_id: categoryId,
    p_suggested: counts.suggested ?? 0,
    p_accepted: counts.accepted ?? 0,
    p_completed: counts.completed ?? 0,
    p_loved: counts.loved ?? 0,
    p_rejected: counts.rejected ?? 0,
    p_suggested_at: counts.suggestedAt ?? null,
    p_completed_at: counts.completedAt ?? null,
  });
  if (error) throw new Error(`bumpCategoryStat: ${error.message}`);
}

// ------------------------------------------------------------ plans

export async function getPlan(db: SupabaseClient, planId: string): Promise<PlanWithItems | null> {
  const { data, error } = await db
    .from("plans")
    .select("*, plan_items(*)")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`getPlan: ${error.message}`);
  if (!data) return null;

  const { plan_items, ...plan } = data as Plan & { plan_items: PlanItem[] };
  return { ...plan, items: [...plan_items].sort((a, b) => a.sequence - b.sequence) };
}

export async function getPlansForWeekend(
  db: SupabaseClient,
  householdId: string,
  weekendDate: string
): Promise<PlanWithItems[]> {
  const { data, error } = await db
    .from("plans")
    .select("*, plan_items(*)")
    .eq("household_id", householdId)
    .eq("weekend_date", weekendDate)
    .not("status", "in", "(REJECTED,FAILED)");
  if (error) throw new Error(`getPlansForWeekend: ${error.message}`);

  return (data ?? []).map((row) => {
    const { plan_items, ...plan } = row as Plan & { plan_items: PlanItem[] };
    return { ...plan, items: [...plan_items].sort((a, b) => a.sequence - b.sequence) };
  });
}

export async function getPlanHistory(
  db: SupabaseClient,
  householdId: string,
  limit = 30
): Promise<Array<Plan & { feedback: { did_it: string; rating: string | null } | null }>> {
  const { data, error } = await db
    .from("plans")
    .select("*, plan_feedback(did_it, rating)")
    .eq("household_id", householdId)
    .eq("plan_type", "PRIMARY")
    .in("status", ["DELIVERED", "OPENED", "COMPLETED"])
    .order("weekend_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getPlanHistory: ${error.message}`);

  return (data ?? []).map((row) => {
    const { plan_feedback, ...plan } = row as Plan & {
      plan_feedback: Array<{ did_it: string; rating: string | null }>;
    };
    return { ...plan, feedback: plan_feedback?.[0] ?? null };
  });
}

/** Mark a plan opened, exactly once. Drives the open-rate metric (§45). */
export async function markPlanOpened(db: SupabaseClient, planId: string): Promise<void> {
  const { error } = await db
    .from("plans")
    .update({ status: "OPENED", opened_at: new Date().toISOString() })
    .eq("id", planId)
    .in("status", ["DELIVERED", "READY"]);
  if (error) throw new Error(`markPlanOpened: ${error.message}`);
}

export async function recordPlanEvent(
  db: SupabaseClient,
  input: {
    householdId: string;
    planId?: string | null;
    type: PlanEventType;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await db.from("plan_events").insert({
    household_id: input.householdId,
    plan_id: input.planId ?? null,
    event_type: input.type,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`recordPlanEvent: ${error.message}`);
}

// ------------------------------------------------------------ generation runs

export async function startGenerationRun(
  db: SupabaseClient,
  householdId: string,
  weekendDate: string,
  attempt: number
): Promise<GenerationRun> {
  const { data, error } = await db
    .from("plan_generation_runs")
    .insert({ household_id: householdId, weekend_date: weekendDate, attempt })
    .select()
    .single();
  if (error) throw new Error(`startGenerationRun: ${error.message}`);
  return data as GenerationRun;
}

export async function finishGenerationRun(
  db: SupabaseClient,
  runId: string,
  input: {
    stage: string;
    succeeded: boolean;
    error?: string | null;
    providerCostCents: number;
    candidateCount: number;
    diagnostics: unknown;
  }
): Promise<void> {
  const { error } = await db
    .from("plan_generation_runs")
    .update({
      stage: input.stage,
      succeeded: input.succeeded,
      error: input.error ?? null,
      provider_cost_cents: input.providerCostCents,
      candidate_count: input.candidateCount,
      diagnostics: input.diagnostics,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`finishGenerationRun: ${error.message}`);
}

export async function updateGenerationStage(
  db: SupabaseClient,
  runId: string,
  stage: string
): Promise<void> {
  // Stage updates drive the live loading experience (§38), so a failure here
  // must not abort a generation that is otherwise going fine.
  await db.from("plan_generation_runs").update({ stage }).eq("id", runId);
}

export async function recordProviderUsage(
  db: SupabaseClient,
  runId: string,
  householdId: string,
  records: UsageRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const { error } = await db.from("provider_usage").insert(
    records.map((r) => ({
      provider: r.provider,
      operation: r.operation,
      requests: r.requests,
      estimated_cost_cents: r.estimated_cost_cents,
      household_id: householdId,
      generation_run_id: runId,
    }))
  );
  if (error) throw new Error(`recordProviderUsage: ${error.message}`);
}

export async function recordAIRun(db: SupabaseClient, record: AIRunRecord): Promise<void> {
  const { error } = await db.from("ai_runs").insert({
    provider: record.provider,
    model: record.model,
    prompt_version: record.prompt_version,
    operation: record.operation,
    input_hash: record.input_hash,
    output: record.output,
    latency_ms: record.latency_ms,
    input_tokens: record.input_tokens,
    output_tokens: record.output_tokens,
    estimated_cost_cents: record.estimated_cost_cents,
    success: record.success,
    validation_errors: record.validation_errors,
    attempts: record.attempts,
    household_id: record.household_id,
    generation_run_id: record.generation_run_id,
  });
  if (error) throw new Error(`recordAIRun: ${error.message}`);
}

// ------------------------------------------------------------ subscriptions

export async function getSubscription(
  db: SupabaseClient,
  householdId: string
): Promise<Subscription | null> {
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw new Error(`getSubscription: ${error.message}`);
  return (data as Subscription) ?? null;
}

/**
 * Households that should receive a plan for the given weekend.
 *
 * The commercial gate lives here rather than in the job: only active pilots
 * with deliveries remaining, and active subscribers, get a weekend planned.
 * A pilot that has had its four weekends stops generating rather than
 * quietly continuing to cost us provider calls (§29).
 */
export async function householdsDueForGeneration(
  db: SupabaseClient,
  marketId: string
): Promise<Array<{ household_id: string; user_id: string; pilot_week_number: number }>> {
  const { data, error } = await db
    .from("subscriptions")
    .select("household_id, user_id, pilot_week_number, status, households!inner(market_id, deleted_at)")
    .in("status", ["PILOT_ACTIVE", "ACTIVE", "TRIAL"])
    .eq("households.market_id", marketId)
    .is("households.deleted_at", null);
  if (error) throw new Error(`householdsDueForGeneration: ${error.message}`);

  return (data ?? [])
    .filter((row) => {
      const r = row as { status: string; pilot_week_number: number };
      return r.status !== "PILOT_ACTIVE" || r.pilot_week_number < 4;
    })
    .map((row) => {
      const r = row as { household_id: string; user_id: string; pilot_week_number: number };
      return {
        household_id: r.household_id,
        user_id: r.user_id,
        pilot_week_number: r.pilot_week_number,
      };
    });
}

export function marketFor(household: Household) {
  return getMarket(household.market_id);
}
