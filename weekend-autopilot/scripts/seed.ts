/**
 * Development seed.
 *
 * Creates the market rows, an admin profile and three households matching the
 * eval profiles, then queues a plan for each. After running this and the job
 * runner you have a working app with real plans to look at, without paying a
 * provider or waiting until Wednesday.
 *
 *   npm run seed
 *   npm run jobs
 */

import { createClient } from "@supabase/supabase-js";
import { MARKETS } from "../src/config/markets";
import { getMarket } from "../src/config/markets";
import { queueFirstPlan } from "../src/lib/jobs/scheduler";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const HOUSEHOLDS = [
  {
    email: "couple@example.test",
    label: "Marrickville",
    lat: -33.911,
    lng: 151.155,
    shape: "COUPLE" as const,
    members: [{ member_type: "ADULT" as const }, { member_type: "ADULT" as const }],
    preferences: {
      max_travel_minutes: 45,
      budget_band: "75_150" as const,
      liked_categories: ["waterfront", "easy_walks", "food", "coffee", "swimming"],
      activity_level: "MODERATE" as const,
      desired_activity_level: "ACTIVE" as const,
      nudge: "LITTLE" as const,
      transport_modes: ["DRIVING", "TRANSIT", "WALKING"] as const,
    },
  },
  {
    email: "family@example.test",
    label: "Balmain",
    lat: -33.858,
    lng: 151.18,
    shape: "FAMILY" as const,
    members: [
      { member_type: "ADULT" as const },
      { member_type: "ADULT" as const },
      { member_type: "CHILD" as const, age: 4, nickname: "Bird" },
    ],
    preferences: {
      max_travel_minutes: 40,
      budget_band: "75_150" as const,
      liked_categories: ["beaches", "playgrounds", "animals", "food", "gardens"],
      activity_level: "EASY" as const,
      desired_activity_level: "EASY" as const,
      transport_modes: ["DRIVING", "WALKING"] as const,
      food: {
        cuisines_loved: ["Chinese", "Vietnamese"],
        dietary_requirements: [],
        kid_friendly_importance: 0.9,
        coffee_importance: 0.6,
        restaurant_price_sensitivity: 0.6,
      },
    },
  },
  {
    email: "solo@example.test",
    label: "Surry Hills",
    lat: -33.8845,
    lng: 151.2115,
    shape: "SOLO" as const,
    members: [{ member_type: "ADULT" as const }],
    preferences: {
      max_travel_minutes: 30,
      budget_band: "UNDER_75" as const,
      liked_categories: ["galleries", "markets", "coffee", "neighbourhoods", "vintage"],
      activity_level: "GENTLE" as const,
      desired_activity_level: "EASY" as const,
      nudge: "LITTLE" as const,
      transport_modes: ["TRANSIT", "WALKING"] as const,
      time_budget: "FEW_HOURS" as const,
    },
  },
];

async function seedMarkets(): Promise<void> {
  const rows = MARKETS.map((m) => ({
    market_id: m.market_id,
    display_name: m.display_name,
    country: m.country,
    currency: m.currency,
    locale: m.locale,
    timezone: m.timezone,
    distance_units: m.distance_units,
    default_travel_radius: m.default_travel_radius,
    delivery_day: m.delivery_day,
    delivery_time: m.delivery_time,
    feedback_day: m.feedback_day,
    feedback_time: m.feedback_time,
    live: m.live,
  }));

  const { error } = await db.from("markets").upsert(rows, { onConflict: "market_id" });
  if (error) throw new Error(`markets: ${error.message}`);
  console.log(`Seeded ${rows.length} markets.`);
}

async function seedHousehold(spec: (typeof HOUSEHOLDS)[number]): Promise<void> {
  // Create the auth user if it does not exist. Passwordless, so no password.
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: spec.email,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (userError && !userError.message.includes("already")) {
    throw new Error(`user ${spec.email}: ${userError.message}`);
  }
  if (!userId) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === spec.email)?.id;
  }
  if (!userId) throw new Error(`could not resolve a user id for ${spec.email}`);

  const { data: household, error: householdError } = await db
    .from("households")
    .upsert(
      {
        owner_user_id: userId,
        market_id: "sydney",
        shape: spec.shape,
        home_label: spec.label,
        home_lat: spec.lat,
        home_lng: spec.lng,
      },
      { onConflict: "owner_user_id" }
    )
    .select("id")
    .single();

  if (householdError || !household) {
    throw new Error(`household ${spec.email}: ${householdError?.message}`);
  }
  const householdId = household.id as string;

  await db
    .from("household_users")
    .upsert(
      { household_id: householdId, user_id: userId, role: "OWNER" },
      { onConflict: "household_id,user_id" }
    );

  await db.from("household_members").delete().eq("household_id", householdId);
  await db.from("household_members").insert(
    spec.members.map((m) => ({
      household_id: householdId,
      member_type: m.member_type,
      age: "age" in m ? m.age : null,
      nickname: "nickname" in m ? m.nickname : null,
    }))
  );

  await db
    .from("preference_profiles")
    .upsert({ household_id: householdId, ...spec.preferences }, { onConflict: "household_id" });

  await db
    .from("notification_preferences")
    .upsert({ household_id: householdId }, { onConflict: "household_id" });

  await db.from("subscriptions").upsert(
    {
      household_id: householdId,
      user_id: userId,
      status: "PILOT_ACTIVE",
      tier: "PILOT_4_WEEK",
      pilot_week_number: 0,
    },
    { onConflict: "household_id" }
  );

  const weekendDate = await queueFirstPlan(db, householdId, getMarket("sydney"));
  console.log(`Seeded ${spec.email} (${spec.label}) — plan queued for ${weekendDate}.`);
}

async function main(): Promise<void> {
  await seedMarkets();
  for (const spec of HOUSEHOLDS) await seedHousehold(spec);
  console.log("\nRun `npm run jobs` to generate their plans.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
