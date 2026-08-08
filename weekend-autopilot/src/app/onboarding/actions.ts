"use server";

/**
 * Onboarding submission (§9).
 *
 * One action, called once at the end, with the whole profile. The client keeps
 * the ten screens in memory and submits when the customer confirms — which
 * means a half-finished onboarding leaves no partial household behind, and the
 * "we’ve got you" screen can be generated from a complete picture.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser, serviceClient, userClient } from "@/lib/supabase/server";
import { defaultMarket, marketForCoordinates } from "@/config/markets";
import { coarsenLocation } from "@/lib/util/geo";
import { sanitiseUserText } from "@/lib/security/sanitise";
import { seedFromOnboarding } from "@/lib/taste/signals";
import { applySignalDeltas } from "@/lib/db/repository";
import { queueFirstPlan } from "@/lib/jobs/scheduler";
import { track } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

const memberSchema = z.object({
  member_type: z.enum(["ADULT", "CHILD"]),
  nickname: z.string().max(40).nullable(),
  age: z.number().int().min(0).max(120).nullable(),
  mobility_notes: z.string().max(200).nullable(),
});

const onboardingSchema = z.object({
  home_label: z.string().min(2).max(120),
  home_lat: z.number().min(-90).max(90),
  home_lng: z.number().min(-180).max(180),

  shape: z.enum(["SOLO", "COUPLE", "FAMILY", "FRIENDS"]),
  members: z.array(memberSchema).max(12),

  max_travel_minutes: z.number().int().min(15).max(120),
  allow_occasional_further: z.boolean(),
  transport_modes: z.array(z.enum(["DRIVING", "TRANSIT", "WALKING", "CYCLING"])).min(1),

  budget_band: z.enum(["FREE", "UNDER_75", "75_150", "150_250", "FLEXIBLE"]),

  activity_level: z.enum(["GENTLE", "EASY", "MODERATE", "ACTIVE"]),
  desired_activity_level: z.enum(["GENTLE", "EASY", "MODERATE", "ACTIVE"]),
  nudge: z.enum(["NONE", "LITTLE", "YES"]),

  liked_categories: z.array(z.string().max(40)).max(40),
  dislikes: z.array(z.string().max(40)).max(20),
  hard_no: z.string().max(300).nullable(),

  food: z.object({
    cuisines_loved: z.array(z.string().max(40)).max(20),
    dietary_requirements: z.array(z.string().max(40)).max(15),
    kid_friendly_importance: z.number().min(0).max(1),
    coffee_importance: z.number().min(0).max(1),
    restaurant_price_sensitivity: z.number().min(0).max(1),
  }),

  start_time_preference: z.enum(["EARLY", "AROUND_9", "AROUND_10", "LATE_MORNING", "FLEXIBLE"]),
  time_budget: z.enum(["FEW_HOURS", "HALF_DAY", "MOST_OF_DAY", "FULL_WEEKEND"]),
  crowd_tolerance: z.number().min(0).max(1),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export interface OnboardingResult {
  ok: boolean;
  error?: string;
  outsideMarket?: boolean;
  weekendDate?: string;
}

export async function completeOnboarding(input: unknown): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some answers were missing — go back and check." };
  }
  const data = parsed.data;

  const user = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  // Coarsen before anything is written. We never hold a precise home
  // coordinate, not even briefly (§51).
  const home = coarsenLocation({ lat: data.home_lat, lng: data.home_lng });

  const market = marketForCoordinates(home.lat, home.lng);
  if (!market) {
    // Outside a live market: the client shows the waitlist rather than
    // creating a household we cannot serve (§5).
    return { ok: false, outsideMarket: true };
  }

  const db = serviceClient();

  // Idempotent: a double submit finds the existing household and updates it
  // rather than creating a second one.
  const existing = await userClient()
    .from("households")
    .select("id")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  let householdId = existing.data?.id as string | undefined;

  if (householdId) {
    await db
      .from("households")
      .update({
        market_id: market.market_id,
        shape: data.shape,
        home_label: sanitiseUserText(data.home_label, 120),
        home_lat: home.lat,
        home_lng: home.lng,
      })
      .eq("id", householdId);
  } else {
    const { data: created, error } = await db
      .from("households")
      .insert({
        owner_user_id: user.id,
        market_id: market.market_id,
        shape: data.shape,
        home_label: sanitiseUserText(data.home_label, 120),
        home_lat: home.lat,
        home_lng: home.lng,
      })
      .select("id")
      .single();

    if (error || !created) return { ok: false, error: "Couldn’t create your household." };
    householdId = created.id as string;

    await db.from("household_users").insert({
      household_id: householdId,
      user_id: user.id,
      role: "OWNER",
    });
  }

  // Members are replaced wholesale: simpler than diffing, and this runs once.
  await db.from("household_members").delete().eq("household_id", householdId);

  const members = data.members.length > 0 ? data.members : [{ member_type: "ADULT" as const, nickname: null, age: null, mobility_notes: null }];
  await db.from("household_members").insert(
    members.map((member) => ({
      household_id: householdId,
      member_type: member.member_type,
      nickname: member.nickname ? sanitiseUserText(member.nickname, 40) : null,
      age: member.age,
      mobility_notes: member.mobility_notes
        ? sanitiseUserText(member.mobility_notes, 200)
        : null,
    }))
  );

  const preferences = {
    household_id: householdId,
    max_travel_minutes: data.max_travel_minutes,
    allow_occasional_further: data.allow_occasional_further,
    transport_modes: data.transport_modes,
    budget_band: data.budget_band,
    activity_level: data.activity_level,
    desired_activity_level: data.desired_activity_level,
    nudge: data.nudge,
    liked_categories: data.liked_categories,
    dislikes: data.dislikes,
    hard_no: data.hard_no ? sanitiseUserText(data.hard_no, 300) : null,
    food: data.food,
    start_time_preference: data.start_time_preference,
    time_budget: data.time_budget,
    crowd_tolerance: data.crowd_tolerance,
  };

  const { error: preferencesError } = await db
    .from("preference_profiles")
    .upsert(preferences, { onConflict: "household_id" });
  if (preferencesError) return { ok: false, error: "Couldn’t save your preferences." };

  await db
    .from("notification_preferences")
    .upsert({ household_id: householdId }, { onConflict: "household_id" });

  // Seed the taste model from what they told us — at low confidence, because
  // it is a hypothesis until behaviour confirms it (§19).
  await applySignalDeltas(db, householdId, seedFromOnboarding(preferences as never));

  // Give them a subscription row if the webhook has not already created one,
  // so a customer who signed up before paying is not stuck in limbo.
  await db
    .from("subscriptions")
    .upsert(
      { household_id: householdId, user_id: user.id, status: "NONE" },
      { onConflict: "household_id", ignoreDuplicates: true }
    );

  const weekendDate = await queueFirstPlan(db, householdId, market);

  track(householdId, ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
    market_id: market.market_id,
  });

  return { ok: true, weekendDate };
}

/** Used by the confirmation screen to render the readable summary (§9 screen 10). */
export async function buildTasteSummary(input: unknown): Promise<{ summary: string }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { summary: "" };

  const { buildAIProvider } = await import("@/lib/ai");
  const ai = buildAIProvider();
  const market = defaultMarket();

  try {
    const summary = await ai.buildTasteSummary({
      household: {
        shape: parsed.data.shape,
        adults: parsed.data.members.filter((m) => m.member_type === "ADULT").length || 1,
        children_ages: parsed.data.members
          .filter((m) => m.member_type === "CHILD")
          .map((m) => m.age)
          .filter((age): age is number => age !== null),
        mobility_notes: [],
        preferences: parsed.data as never,
        taste_signals: [],
        recent_anchor_names: [],
        completed_anchor_names: [],
      },
      members: parsed.data.members.map((m) => ({ member_type: m.member_type, age: m.age })),
      currency: market.currency,
    });
    return { summary };
  } catch {
    return { summary: "" };
  }
}

export async function goToApp(): Promise<never> {
  redirect("/app");
}
