/**
 * Test fixtures.
 *
 * A household factory with sensible defaults and a partial override, so a test
 * that cares about one thing — a toddler, a rainy day, a rejected category —
 * states only that thing. Anything a test does not mention should be ordinary.
 */

import { getMarket } from "@/config/markets";
import { buildPlanningContext } from "@/lib/planner/context";
import type { PlanningContext } from "@/lib/planner/types";
import type {
  CategoryStats,
  Household,
  HouseholdMember,
  PreferenceProfile,
  TasteSignal,
  WeatherForecast,
  WeekendCheckin,
} from "@/lib/types";

const NOW = "2026-03-01T00:00:00.000Z";

/** A Saturday, used consistently so opening-hours assertions are stable. */
export const TEST_WEEKEND = "2026-03-14";

export function household(overrides: Partial<Household> = {}): Household {
  return {
    id: "household-1",
    owner_user_id: "user-1",
    market_id: "sydney",
    shape: "COUPLE",
    home_label: "Marrickville",
    home_lat: -33.911,
    home_lng: 151.155,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

export function adult(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id: `member-${Math.random().toString(36).slice(2, 8)}`,
    household_id: "household-1",
    member_type: "ADULT",
    nickname: null,
    age: null,
    mobility_notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function child(age: number, overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { ...adult({ member_type: "CHILD", age }), ...overrides };
}

export function preferences(overrides: Partial<PreferenceProfile> = {}): PreferenceProfile {
  return {
    id: "preferences-1",
    household_id: "household-1",
    max_travel_minutes: 40,
    allow_occasional_further: false,
    transport_modes: ["DRIVING", "WALKING"],
    budget_band: "UNDER_75",
    activity_level: "EASY",
    desired_activity_level: "EASY",
    nudge: "NONE",
    liked_categories: ["beaches", "easy_walks", "food"],
    dislikes: [],
    hard_no: null,
    food: {
      cuisines_loved: [],
      dietary_requirements: [],
      kid_friendly_importance: 0,
      coffee_importance: 0.5,
      restaurant_price_sensitivity: 0.4,
    },
    start_time_preference: "AROUND_9",
    time_budget: "HALF_DAY",
    crowd_tolerance: 0.5,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function weather(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    date: TEST_WEEKEND,
    temperature_min: 17,
    temperature_max: 24,
    precipitation_probability: 0.05,
    precipitation_amount: 0,
    wind_speed: 12,
    weather_code: 0,
    summary: "24°C and sunny",
    provider: "test",
    fetched_at: NOW,
    ...overrides,
  };
}

export function tasteSignal(overrides: Partial<TasteSignal> = {}): TasteSignal {
  return {
    id: `signal-${Math.random().toString(36).slice(2, 8)}`,
    household_id: "household-1",
    dimension: "category",
    value: "beaches",
    weight: 0.5,
    confidence: 0.5,
    source: "ONBOARDING",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function categoryStats(overrides: Partial<CategoryStats> = {}): CategoryStats {
  return {
    household_id: "household-1",
    category_id: "beaches",
    suggested_count: 0,
    accepted_count: 0,
    completed_count: 0,
    loved_count: 0,
    rejected_count: 0,
    last_suggested_at: null,
    last_completed_at: null,
    ...overrides,
  };
}

export function checkin(overrides: Partial<WeekendCheckin> = {}): WeekendCheckin {
  return {
    id: "checkin-1",
    household_id: "household-1",
    weekend_date: TEST_WEEKEND,
    energy: null,
    budget: null,
    time: null,
    note: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export interface ContextOverrides {
  household?: Partial<Household>;
  members?: HouseholdMember[];
  preferences?: Partial<PreferenceProfile>;
  taste?: TasteSignal[];
  categoryStats?: CategoryStats[];
  checkin?: WeekendCheckin | null;
  weather?: Partial<WeatherForecast> | null;
  weekendDate?: string;
}

export function context(overrides: ContextOverrides = {}): PlanningContext {
  return buildPlanningContext({
    household: household(overrides.household),
    members: overrides.members ?? [adult(), adult()],
    preferences: preferences(overrides.preferences),
    taste: overrides.taste ?? [],
    categoryStats: overrides.categoryStats ?? [],
    checkin: overrides.checkin ?? null,
    market: getMarket("sydney"),
    weekendDate: overrides.weekendDate ?? TEST_WEEKEND,
    weather: overrides.weather === null ? null : weather(overrides.weather ?? {}),
  });
}
