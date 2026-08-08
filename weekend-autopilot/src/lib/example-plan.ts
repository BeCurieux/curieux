/**
 * The example weekend shown on the marketing site (§7 section 2, §33 /example).
 *
 * A hand-written illustration, clearly labelled as such wherever it appears.
 * It is not generated, not a real customer’s plan, and the venues are real
 * public places in Sydney rather than invented businesses — an example plan
 * that names a restaurant we made up would be exactly the failure mode the
 * whole product is built to avoid.
 */

import type { PlanItem, PlanWithItems } from "@/lib/types";

function item(partial: Partial<PlanItem> & Pick<PlanItem, "id" | "sequence" | "item_type" | "title" | "start_time" | "end_time">): PlanItem {
  return {
    plan_id: "example",
    description: null,
    provider: null,
    provider_place_id: null,
    place_ref_id: null,
    lat: null,
    lng: null,
    address: null,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    walk_distance_km: null,
    travel_mode: null,
    booking_required: false,
    booking_url: null,
    commercial_url: null,
    affiliate_url: null,
    affiliate_provider: null,
    maps_url: null,
    verification_status: "VERIFIED",
    verification_timestamp: null,
    verification_notes: null,
    is_critical: false,
    source_provenance: { facts: {}, model_fields: [], ai_run_id: null },
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

export const EXAMPLE_PLAN: PlanWithItems = {
  id: "example",
  household_id: "example",
  user_id: "example",
  market_id: "sydney",
  weekend_date: "2026-03-14",
  plan_duration_days: 1,
  plan_type: "PRIMARY",

  title: "Coastal walk + dumplings + a swim",
  short_description: "An easy morning on the water, lunch you’ll think about later, home by three.",

  start_time: "09:20",
  estimated_finish_time: "15:00",

  estimated_total_cost_min: 65,
  estimated_total_cost_max: 85,
  currency: "AUD",

  total_travel_minutes: 28,
  total_activity_distance_km: 5.4,
  activity_level: "EASY",

  weather_summary: "24°C and sunny",
  fit_reason:
    "You’ve consistently liked water, walks under 7 km and Asian food — and you said you wanted something active without losing the whole day.",

  confidence_score: 0.86,
  base_score: 78,
  verification_score: 1,
  status: "DELIVERED",

  swap_reason: null,
  swapped_from_plan_id: null,
  generation_run_id: null,

  created_at: "",
  verified_at: null,
  delivered_at: null,
  opened_at: null,
  completed_at: null,
  updated_at: "",

  items: [
    item({
      id: "e1",
      sequence: 0,
      item_type: "TRAVEL",
      title: "Leave home",
      start_time: "09:20",
      end_time: "10:05",
      travel_mode: "TRANSIT",
      description: "Bus, then a short walk down to the water.",
    }),
    item({
      id: "e2",
      sequence: 1,
      item_type: "WALK",
      title: "Easy 5.4 km waterfront walk",
      start_time: "10:05",
      end_time: "11:45",
      walk_distance_km: 5.4,
      is_critical: true,
      description: "Flat the whole way, with the harbour on your left.",
    }),
    item({
      id: "e3",
      sequence: 2,
      item_type: "FOOD",
      title: "Lunch",
      start_time: "11:45",
      end_time: "13:00",
      estimated_cost_min: 45,
      estimated_cost_max: 65,
      description: "Dumplings, ten minutes from where the walk finishes.",
    }),
    item({
      id: "e4",
      sequence: 3,
      item_type: "ACTIVITY",
      title: "Swim, or the playground next to it",
      start_time: "13:00",
      end_time: "14:15",
    }),
    item({
      id: "e5",
      sequence: 4,
      item_type: "TRAVEL",
      title: "Head home",
      start_time: "14:15",
      end_time: "15:00",
      travel_mode: "TRANSIT",
    }),
  ],
};

export const EXAMPLE_BACKUP: PlanWithItems = {
  ...EXAMPLE_PLAN,
  id: "example-backup",
  plan_type: "BACKUP",
  title: "Botanic gardens + a long lunch",
  short_description: "Twenty minutes from home, nothing to organise, plenty of shade.",
  estimated_total_cost_min: 40,
  estimated_total_cost_max: 60,
  total_travel_minutes: 18,
  total_activity_distance_km: 1.8,
  activity_level: "GENTLE",
  fit_reason: "Closer, flatter and cheaper — for the Saturday where the walk feels like work.",
  items: EXAMPLE_PLAN.items.slice(0, 3),
};
