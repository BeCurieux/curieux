/**
 * Planner-internal types.
 *
 * These never reach the database or the browser. They are the working set the
 * pipeline passes between its stages: context in, candidates, bundles, and
 * finally a persisted Plan.
 */

import type { Market } from "@/config/markets";
import type { CategoryId } from "@/config/taxonomy";
import type {
  ActivityLevel,
  Household,
  HouseholdMember,
  PlanItemType,
  PreferenceProfile,
  TasteSignal,
  TransportMode,
  WeatherForecast,
  WeekendCheckin,
  CategoryStats,
} from "@/lib/types";
import type { LatLng } from "@/lib/util/geo";
import type { SearchIntent } from "@/lib/ai/schemas";

/** Everything the pipeline needs to know before it touches a provider. */
export interface PlanningContext {
  household: Household;
  members: HouseholdMember[];
  preferences: PreferenceProfile;
  taste: TasteSignal[];
  categoryStats: CategoryStats[];
  checkin: WeekendCheckin | null;
  market: Market;
  weekendDate: string;
  /** The Saturday, as an instant at the household's likely departure hour. */
  home: LatLng;
  weather: WeatherForecast | null;

  /** Derived, because half the engine asks these questions. */
  derived: DerivedContext;
}

export interface DerivedContext {
  adults: number;
  childAges: number[];
  youngestChildAge: number | null;
  hasChildren: boolean;
  mobilityNotes: string[];

  /** Check-in overrides folded into effective values for this weekend. */
  effectiveTravelMinutes: number;
  effectiveBudgetMax: number;
  /** Total usable minutes for the day, from the time budget or check-in. */
  effectiveTimeMinutes: number;
  effectiveActivityLevel: ActivityLevel;
  /** Preferred departure, "HH:MM". */
  departureTime: string;
  transportModes: TransportMode[];
  /** 0–1, lower means more crowd-averse. */
  crowdTolerance: number;
  /** Categories the household has effectively blocked through behaviour (§18). */
  suppressedCategories: Set<CategoryId>;
  /** Categories the household demonstrably loves. */
  favouredCategories: Set<CategoryId>;
  /** Anchors suggested or completed recently, by provider place id. */
  recentlySuggested: Map<string, string>;
  recentlyCompleted: Map<string, string>;
  /** 0–1: how much this household enjoys repeating things they liked. */
  repeatAppetite: number;
}

/** A place that survived retrieval, with the facts we fetched about it. */
export interface Candidate {
  /** Stable within a generation run; how the model refers to it. */
  candidate_id: string;
  provider: string;
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  categories: CategoryId[];
  /** The role the intent that found it was hunting for. */
  role: SearchIntent["role"];
  price_level: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  busyness: number | null;
  public_space: boolean;

  /** Filled by the route stage. Null until then. */
  travel: {
    mode: TransportMode;
    minutes: number;
    distance_km: number;
    summary: string;
  } | null;

  /** Filled by the details stage for commercial venues. */
  openingHours: import("@/lib/types").OpeningHours | null;
  businessStatus: import("@/lib/types").PlaceDetails["business_status"] | null;
  address: string | null;
  website: string | null;
  mapsUrl: string | null;
  bookingRequired: boolean;

  /** Cost band per adult, derived from a trusted source or a price level. */
  cost: { min: number; max: number; certain: boolean } | null;

  /** How long a visit here typically takes, in minutes. */
  durationMinutes: number;
  /** Walking distance the activity itself involves. */
  walkKm: number;

  /** Set by scoring. */
  score: CandidateScore | null;
  /** Set by filtering when rejected, for the admin inspector (§42). */
  rejection: { rule: string; detail: string } | null;
}

export interface CandidateScore {
  total: number;
  dimensions: Record<string, number>;
  penalties: Record<string, number>;
  /** Model's advisory score, when consulted. */
  advisory: number | null;
}

/** One step of an assembled day, before it becomes a PlanItem row. */
export interface BundleItem {
  sequence: number;
  item_type: PlanItemType;
  name: string;
  description: string | null;
  candidate: Candidate | null;
  start_time: string;
  end_time: string;
  travel_mode: TransportMode | null;
  travel_minutes: number | null;
  walk_km: number;
  cost_min: number;
  cost_max: number;
  cost_certain: boolean;
  is_critical: boolean;
}

export type Archetype =
  | "WALK_AND_FOOD"
  | "BEACH_AND_LUNCH"
  | "MARKET_AND_NEIGHBOURHOOD"
  | "FERRY_PARK_FOOD"
  | "GARDEN_AND_CAFE"
  | "WALK_AND_PUB"
  | "INDOOR_AND_FOOD"
  | "SWIM_BAKERY_PARK"
  | "WORKSHOP_AND_NEIGHBOURHOOD"
  | "DRIVE_WALK_FOOD";

/** A complete candidate day, scored but not yet verified. */
export interface Bundle {
  bundle_id: string;
  archetype: Archetype;
  items: BundleItem[];
  anchor: Candidate;
  start_time: string;
  end_time: string;
  total_cost_min: number;
  total_cost_max: number;
  total_travel_minutes: number;
  walk_km: number;
  activity_level: ActivityLevel;
  /** 0–100 deterministic score for the whole day. */
  base_score: number;
  score_detail: {
    anchor_score: number;
    dimensions: Record<string, number>;
    penalties: Record<string, number>;
  };
  /** Populated by verification. */
  verification: BundleVerification | null;
}

export interface BundleVerification {
  score: number;
  passed: boolean;
  items: Array<{
    sequence: number;
    status: import("@/lib/types").VerificationStatus;
    notes: string | null;
    critical: boolean;
  }>;
  failures: string[];
}
