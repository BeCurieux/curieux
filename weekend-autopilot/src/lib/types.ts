/**
 * Domain types (§11, §19, §26, §29).
 *
 * A plan is structured data first (§11). The model never emits prose that
 * becomes a plan; it emits choices and copy that are attached to a structure
 * built from verified facts. These types are that structure.
 */

import type { CategoryId, DislikeId } from "@/config/taxonomy";

// Re-exported so provider adapters and the planner can depend on the domain
// module alone rather than reaching into config for the taxonomy's types.
export type { CategoryId, DislikeId };

// ------------------------------------------------------------------ household

export type MemberType = "ADULT" | "CHILD";

export interface HouseholdMember {
  id: string;
  household_id: string;
  member_type: MemberType;
  /** Optional nickname. We never require a child's real name (§9 screen 2). */
  nickname: string | null;
  /** Years. The single most load-bearing field for child suitability. */
  age: number | null;
  /**
   * Free-text mobility note, e.g. "still in a pram", "uses a wheelchair".
   * Treated as a hard constraint by the accessibility filter.
   */
  mobility_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type HouseholdShape = "SOLO" | "COUPLE" | "FAMILY" | "FRIENDS";

export interface Household {
  id: string;
  owner_user_id: string;
  market_id: string;
  shape: HouseholdShape;
  /** Suburb-level label shown back to the user, e.g. "Marrickville". */
  home_label: string | null;
  /**
   * Approximate home coordinates. Deliberately imprecise: we round to ~3
   * decimal places (roughly 100 m) at write time (§51). Enough for travel
   * time, not enough to be a location history.
   */
  home_lat: number | null;
  home_lng: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ------------------------------------------------------------------ preferences

export type TransportMode = "DRIVING" | "TRANSIT" | "WALKING" | "CYCLING";

export type ActivityLevel = "GENTLE" | "EASY" | "MODERATE" | "ACTIVE";

/** How hard the user wants to be pushed beyond their current level (§9 screen 5). */
export type NudgeLevel = "NONE" | "LITTLE" | "YES";

export type BudgetBand = "FREE" | "UNDER_75" | "75_150" | "150_250" | "FLEXIBLE";

export type StartTimePreference = "EARLY" | "AROUND_9" | "AROUND_10" | "LATE_MORNING" | "FLEXIBLE";

export type TimeBudget = "FEW_HOURS" | "HALF_DAY" | "MOST_OF_DAY" | "FULL_WEEKEND";

export interface FoodPreferences {
  cuisines_loved: string[];
  dietary_requirements: string[];
  /** 0–1. How much it matters that food venues work for children. */
  kid_friendly_importance: number;
  /** 0–1. Some households plan the day around the coffee. */
  coffee_importance: number;
  /** 0–1. 1 = very price sensitive about restaurants specifically. */
  restaurant_price_sensitivity: number;
}

export interface PreferenceProfile {
  id: string;
  household_id: string;

  max_travel_minutes: number;
  /** "Surprise me occasionally" — allows the radius to stretch now and then. */
  allow_occasional_further: boolean;
  transport_modes: TransportMode[];

  budget_band: BudgetBand;

  /** What they actually do today. */
  activity_level: ActivityLevel;
  /** What they'd like to do more of. The gap between these two is the product. */
  desired_activity_level: ActivityLevel;
  nudge: NudgeLevel;

  liked_categories: CategoryId[];
  dislikes: DislikeId[];
  /** Free text from "Absolutely not". Treated as an untrusted string (§50). */
  hard_no: string | null;

  food: FoodPreferences;

  start_time_preference: StartTimePreference;
  time_budget: TimeBudget;

  /** 0–1, low means "we avoid busy places". */
  crowd_tolerance: number;

  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------ taste model

export type TasteSource =
  | "ONBOARDING"
  | "CHECKIN"
  | "PLAN_ACCEPTED"
  | "PLAN_REJECTED"
  | "DID_IT"
  | "LOVED_IT"
  | "RATING"
  | "MANUAL_EDIT"
  | "INFERRED";

/**
 * A single structured preference signal (§19). The AI may summarise these in
 * English, but the engine reasons over the numbers, not the summary.
 */
export interface TasteSignal {
  id: string;
  household_id: string;
  /** e.g. "category", "travel_max_minutes", "start_time", "crowd_tolerance". */
  dimension: string;
  /** e.g. "waterfront", "museum", "50". */
  value: string;
  /** −1…+1. Positive is affinity. */
  weight: number;
  /** 0–1. Rises with corroborating evidence (§18). */
  confidence: number;
  source: TasteSource;
  created_at: string;
  updated_at: string;
}

/** Per-category behavioural counters (§18). */
export interface CategoryStats {
  household_id: string;
  category_id: CategoryId;
  suggested_count: number;
  accepted_count: number;
  completed_count: number;
  loved_count: number;
  rejected_count: number;
  last_suggested_at: string | null;
  last_completed_at: string | null;
}

// ------------------------------------------------------------------ check-in

export type EnergyLevel = "LOW" | "NORMAL" | "HIGH";
export type BudgetLevel = "LOW" | "MEDIUM" | "HIGH";
export type TimeLevel = "FEW_HOURS" | "HALF_DAY" | "WHOLE_DAY";

export interface WeekendCheckin {
  id: string;
  household_id: string;
  weekend_date: string; // ISO date of the Saturday
  energy: EnergyLevel | null;
  budget: BudgetLevel | null;
  time: TimeLevel | null;
  /** "grandparents visiting", "no car this weekend". Untrusted free text. */
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------ weather

export interface WeatherForecast {
  date: string;
  temperature_min: number;
  temperature_max: number;
  precipitation_probability: number; // 0–1
  precipitation_amount: number; // mm
  wind_speed: number; // km/h
  /** WMO weather code, normalised across providers. */
  weather_code: number;
  summary: string;
  /** Which provider said so, and when. Every fact is attributable (§53). */
  provider: string;
  fetched_at: string;
}

// ------------------------------------------------------------------ places

export type PlaceOpenState = "OPEN" | "CLOSED" | "UNKNOWN";

export interface OpeningHours {
  /** Per ISO weekday (1–7), the periods the place is open, local time. */
  periods: Partial<Record<number, Array<{ open: string; close: string }>>>;
  /** True when the provider explicitly says the place is permanently closed. */
  permanently_closed: boolean;
  /** Provider could not tell us. Not the same as "closed". */
  unknown: boolean;
}

/**
 * A place as our system holds it. Note what is NOT here: provider descriptions,
 * reviews and photos. We store the identifier and our own derived data, and
 * re-fetch presentational content when we need it (§12).
 */
export interface PlaceRef {
  id: string;
  provider: string;
  provider_place_id: string;
  /** Names are needed to render a plan; kept, and refreshed on verification. */
  name: string;
  lat: number;
  lng: number;
  /** Our own category mapping, not the provider's taxonomy. */
  categories: CategoryId[];
  price_level: number | null;
  /** Provider popularity signal, normalised 0–1. Used for crowd estimation. */
  busyness: number | null;
  market_id: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The live, un-persisted detail we fetch at verification time. */
export interface PlaceDetails {
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  formatted_address: string | null;
  opening_hours: OpeningHours;
  price_level: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  business_status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "UNKNOWN";
  website: string | null;
  maps_url: string;
  types: string[];
  fetched_at: string;
}

// ------------------------------------------------------------------ routes

export interface RouteLeg {
  mode: TransportMode;
  duration_minutes: number;
  distance_km: number;
  summary: string;
  provider: string;
  fetched_at: string;
}

// ------------------------------------------------------------------ plans

export type PlanType = "PRIMARY" | "BACKUP";

export type PlanStatus =
  | "QUEUED"
  | "DISCOVERING"
  | "BUILDING"
  | "VERIFYING"
  | "PENDING_REVIEW"
  | "READY"
  | "DELIVERED"
  | "OPENED"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export type PlanItemType =
  | "TRAVEL"
  | "WALK"
  | "VENUE"
  | "FOOD"
  | "ACTIVITY"
  | "BREAK"
  | "OPTIONAL";

export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "UNCERTAIN" | "FAILED";

/**
 * Where a fact came from (§53). Every user-visible factual claim on a plan
 * item can be traced to a provider response, or it does not get made.
 */
export interface SourceProvenance {
  /** Facts keyed by field name → the provider that supplied them. */
  facts: Record<string, { provider: string; fetched_at: string; note?: string }>;
  /** Fields the model wrote. Copy only — never a fact. */
  model_fields: string[];
  ai_run_id: string | null;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  sequence: number;
  item_type: PlanItemType;

  title: string;
  description: string | null;

  provider: string | null;
  provider_place_id: string | null;
  place_ref_id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;

  /** Local wall-clock, "HH:MM". Timezone comes from the market. */
  start_time: string;
  end_time: string;

  estimated_cost_min: number;
  estimated_cost_max: number;

  /** Metres walked during this item, if any. */
  walk_distance_km: number | null;
  travel_mode: TransportMode | null;

  booking_required: boolean;
  booking_url: string | null;

  commercial_url: string | null;
  affiliate_url: string | null;
  affiliate_provider: string | null;

  maps_url: string | null;

  verification_status: VerificationStatus;
  verification_timestamp: string | null;
  verification_notes: string | null;

  /** Anchor items block delivery if they fail verification (§20). */
  is_critical: boolean;

  source_provenance: SourceProvenance;

  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  household_id: string;
  user_id: string;
  market_id: string;
  weekend_date: string; // ISO date of the Saturday this plan is for
  /** 1 for MVP. Schema supports overnight escapes later (§31). */
  plan_duration_days: number;
  plan_type: PlanType;

  title: string;
  short_description: string;

  start_time: string;
  estimated_finish_time: string;

  estimated_total_cost_min: number;
  estimated_total_cost_max: number;
  currency: string;

  total_travel_minutes: number;
  total_activity_distance_km: number;
  activity_level: ActivityLevel;

  weather_summary: string | null;

  /** The "why this fits you" line. Model-written, grounded in taste signals. */
  fit_reason: string;

  /** 0–1: how sure we are this is a good plan, after scoring and verification. */
  confidence_score: number;
  base_score: number;
  verification_score: number;

  status: PlanStatus;

  /** Set when the user swaps; the reason is useful preference data (§25). */
  swap_reason: string | null;
  swapped_from_plan_id: string | null;

  generation_run_id: string | null;

  created_at: string;
  verified_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface PlanWithItems extends Plan {
  items: PlanItem[];
}

// ------------------------------------------------------------------ feedback

export type DidIt = "YES" | "NO";

export type Rating = "LOVED" | "GOOD" | "FINE" | "NOT_FOR_ME";

export type NotDoneReason =
  | "PLANS_CHANGED"
  | "TOO_TIRED"
  | "TOO_EXPENSIVE"
  | "WEATHER"
  | "TOO_FAR"
  | "DIDNT_APPEAL"
  | "SOMETHING_ELSE";

export interface PlanFeedback {
  id: string;
  plan_id: string;
  household_id: string;
  did_it: DidIt;
  rating: Rating | null;
  not_done_reason: NotDoneReason | null;
  /** "What was the best bit?" — untrusted free text. */
  note: string | null;
  created_at: string;
}

// ------------------------------------------------------------------ events

export type PlanEventType =
  | "PLAN_GENERATED"
  | "PLAN_DELIVERED"
  | "PLAN_OPENED"
  | "PLAN_SWAPPED"
  | "PLAN_ACCEPTED"
  | "PLAN_REJECTED"
  | "DID_IT_YES"
  | "DID_IT_NO"
  | "PLAN_LOVED"
  | "PLAN_OKAY"
  | "PLAN_DISLIKED"
  | "AFFILIATE_CLICKED";

export interface PlanEvent {
  id: string;
  plan_id: string | null;
  household_id: string;
  event_type: PlanEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ------------------------------------------------------------------ billing

export type SubscriptionStatus =
  | "NONE"
  | "TRIAL"
  | "PILOT_ACTIVE"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export type PlanTier = "PILOT_4_WEEK" | "ANNUAL" | "MONTHLY";

export interface Subscription {
  id: string;
  household_id: string;
  user_id: string;
  status: SubscriptionStatus;
  tier: PlanTier | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** 0–4. The pilot delivers four weekends, then converts (§29). */
  pilot_week_number: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------ generation

export type GenerationStage =
  | "CONTEXT"
  | "INTENTS"
  | "CANDIDATES"
  | "FILTERING"
  | "SCORING"
  | "ASSEMBLY"
  | "SELECTION"
  | "VERIFICATION"
  | "COPY"
  | "VALIDATION"
  | "DONE"
  | "FAILED";

export interface GenerationRun {
  id: string;
  household_id: string;
  weekend_date: string;
  stage: GenerationStage;
  attempt: number;
  succeeded: boolean | null;
  error: string | null;
  /** Cost of every provider call in this run, cents. */
  provider_cost_cents: number;
  candidate_count: number;
  started_at: string;
  finished_at: string | null;
}
