/**
 * Persisting a generated bundle as a plan (§11).
 *
 * This is where the in-memory bundle becomes rows, and where provenance is
 * attached: every factual field on a plan item records which provider supplied
 * it and when, and which fields the model merely wrote copy for (§53). If a
 * customer ever asks "how do you know it's open?", the answer is in the row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "@/config/markets";
import { flags } from "@/config/flags";
import type { PlanCopy } from "@/lib/ai/schemas";
import type { Plan, PlanStatus, PlanType, SourceProvenance } from "@/lib/types";
import type { Bundle, BundleItem, PlanningContext } from "@/lib/planner/types";
import { sanitiseProviderText } from "@/lib/security/sanitise";
import { safeExternalUrl } from "@/lib/security/sanitise";

export interface PersistInput {
  ctx: PlanningContext;
  market: Market;
  bundle: Bundle;
  copy: PlanCopy | undefined;
  planType: PlanType;
  confidence: number;
  generationRunId: string | null;
  aiRunId: string | null;
  swappedFromPlanId?: string | null;
  swapReason?: string | null;
}

/**
 * Insert the plan and its items.
 *
 * The initial status honours the founder-review switch (§42): with review on,
 * plans land in PENDING_REVIEW and wait for a human; with it off, they go
 * straight to READY and the Thursday job delivers them. Nothing else about the
 * pipeline changes between those two modes, which is the point — turning
 * review off is a config change, not a different product.
 */
export async function persistPlan(db: SupabaseClient, input: PersistInput): Promise<Plan> {
  const { ctx, bundle, copy, market } = input;

  const status: PlanStatus = flags().requirePlanReview ? "PENDING_REVIEW" : "READY";

  const { data: planRow, error: planError } = await db
    .from("plans")
    .insert({
      household_id: ctx.household.id,
      user_id: ctx.household.owner_user_id,
      market_id: market.market_id,
      weekend_date: ctx.weekendDate,
      plan_duration_days: 1,
      plan_type: input.planType,

      title: copy?.title ?? bundle.anchor.name,
      short_description: copy?.short_description ?? "",

      start_time: bundle.start_time,
      estimated_finish_time: bundle.end_time,

      estimated_total_cost_min: bundle.total_cost_min,
      estimated_total_cost_max: bundle.total_cost_max,
      currency: market.currency,

      total_travel_minutes: bundle.total_travel_minutes,
      total_activity_distance_km: bundle.walk_km,
      activity_level: bundle.activity_level,

      weather_summary: ctx.weather?.summary ?? null,
      fit_reason: copy?.fit_reason ?? "",

      confidence_score: input.confidence,
      base_score: bundle.base_score,
      verification_score: bundle.verification?.score ?? 0,

      status,

      swap_reason: input.swapReason ?? null,
      swapped_from_plan_id: input.swappedFromPlanId ?? null,
      generation_run_id: input.generationRunId,

      verified_at: bundle.verification?.passed ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (planError) throw new Error(`persistPlan: ${planError.message}`);
  const plan = planRow as Plan;

  const copyBySequence = new Map((copy?.items ?? []).map((i) => [i.sequence, i]));
  const verificationBySequence = new Map(
    (bundle.verification?.items ?? []).map((v) => [v.sequence, v])
  );

  const items = bundle.items.map((item) =>
    toItemRow(plan.id, item, {
      copy: copyBySequence.get(item.sequence),
      verification: verificationBySequence.get(item.sequence),
      aiRunId: input.aiRunId,
      weatherProvider: ctx.weather?.provider ?? null,
    })
  );

  const { error: itemsError } = await db.from("plan_items").insert(items);
  if (itemsError) throw new Error(`persistPlan items: ${itemsError.message}`);

  // Upsert the place references we used, so the next generation can consider
  // interaction history without re-deriving it (§12).
  await upsertPlaceRefs(db, bundle, market.market_id);

  return plan;
}

function toItemRow(
  planId: string,
  item: BundleItem,
  extras: {
    copy: { title: string; description: string | null } | undefined;
    verification: { status: string; notes: string | null } | undefined;
    aiRunId: string | null;
    weatherProvider: string | null;
  }
) {
  const candidate = item.candidate;
  const now = new Date().toISOString();

  const provenance: SourceProvenance = {
    facts: {},
    // The model wrote these and only these. Everything else is a provider fact.
    model_fields: extras.copy ? ["title", "description"] : [],
    ai_run_id: extras.aiRunId,
  };

  if (candidate) {
    const provider = candidate.provider;
    provenance.facts.name = { provider, fetched_at: now };
    provenance.facts.coordinates = { provider, fetched_at: now };
    if (candidate.address) provenance.facts.address = { provider, fetched_at: now };
    if (candidate.openingHours && !candidate.openingHours.unknown) {
      provenance.facts.opening_hours = { provider, fetched_at: now };
    } else {
      provenance.facts.opening_hours = {
        provider,
        fetched_at: now,
        note: "unavailable — presented without an opening-hours claim",
      };
    }
    if (candidate.cost) {
      provenance.facts.cost = {
        provider,
        fetched_at: now,
        note: candidate.cost.certain ? "trusted price" : "estimated from price level",
      };
    }
    if (candidate.travel) {
      provenance.facts.travel = { provider: "routes", fetched_at: now };
    }
  }

  if (item.item_type === "TRAVEL" && extras.weatherProvider) {
    provenance.facts.weather = { provider: extras.weatherProvider, fetched_at: now };
  }

  return {
    plan_id: planId,
    sequence: item.sequence,
    item_type: item.item_type,

    // Provider strings are sanitised before they are stored or rendered (§50).
    title: sanitiseProviderText(extras.copy?.title ?? item.name),
    description: extras.copy?.description ?? item.description,

    provider: candidate?.provider ?? null,
    provider_place_id: candidate?.provider_place_id ?? null,
    lat: candidate?.lat ?? null,
    lng: candidate?.lng ?? null,
    address: candidate?.address ? sanitiseProviderText(candidate.address) : null,

    start_time: item.start_time,
    end_time: item.end_time,

    estimated_cost_min: item.cost_min,
    estimated_cost_max: item.cost_max,

    walk_distance_km: item.walk_km || null,
    travel_mode: item.travel_mode,

    booking_required: candidate?.bookingRequired ?? false,
    booking_url: safeExternalUrl(candidate?.website),

    commercial_url: safeExternalUrl(candidate?.website),
    affiliate_url: null,
    affiliate_provider: null,

    maps_url: candidate?.mapsUrl ?? null,

    verification_status: extras.verification?.status ?? (candidate ? "UNVERIFIED" : "VERIFIED"),
    verification_timestamp: extras.verification ? now : null,
    verification_notes: extras.verification?.notes ?? null,

    is_critical: item.is_critical,
    source_provenance: provenance,
  };
}

async function upsertPlaceRefs(
  db: SupabaseClient,
  bundle: Bundle,
  marketId: string
): Promise<void> {
  const rows = bundle.items
    .map((i) => i.candidate)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      provider: c.provider,
      provider_place_id: c.provider_place_id,
      name: sanitiseProviderText(c.name),
      lat: c.lat,
      lng: c.lng,
      categories: c.categories,
      price_level: c.price_level,
      busyness: c.busyness,
      market_id: marketId,
      last_verified_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;
  await db.from("place_refs").upsert(rows, { onConflict: "provider,provider_place_id" });
}
