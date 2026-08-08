/**
 * Planner tunables: weather rules (§21), verification thresholds (§20),
 * regeneration limits (§25) and cost-estimation policy (§22).
 *
 * Deliberately boring, deliberately central. When a plan is wrong the first
 * question is "which rule allowed that?", and the answer should be findable
 * in one file.
 */

export const WEATHER_RULES = {
  /** Above this chance of rain, prefer weather-proof anchors. */
  wet_precipitation_probability: 0.55,
  /** Millimetres over the day that makes an exposed plan a bad idea. */
  wet_precipitation_mm: 4,
  /** Hot enough to avoid long exposed walking in the middle of the day. */
  hot_temp_c: 32,
  /** Serious heat: shade, water and short exposure only. */
  very_hot_temp_c: 36,
  /** Cold enough that long stationary outdoor components stop being pleasant. */
  cold_temp_c: 12,
  /** Wind that makes exposed coastal activity unpleasant (km/h). */
  windy_kmh: 35,
  /** The window we treat as "midday sun" for heat exposure rules. */
  midday_window: { start_hour: 11, end_hour: 16 },
  /** Beyond this, an exposed walk in heat is rejected outright, not penalised. */
  max_exposed_km_when_hot: 3,
  /** A lovely day: outdoor anchors get a bonus rather than merely no penalty. */
  fine_precipitation_probability: 0.2,
  fine_temp_range_c: { min: 16, max: 30 },
} as const;

export const VERIFICATION_CONFIG = {
  /**
   * Weighted share of a plan's items that must verify cleanly. Below this the
   * plan is regenerated rather than delivered (§20).
   */
  min_verification_score: 0.8,
  /** A failed *critical* item (the anchor, or any booked venue) always blocks. */
  critical_item_must_pass: true,
  /** Provider data older than this is re-fetched before delivery. */
  max_place_data_age_hours: 72,
  /** Slack either side of a venue's opening hours before we call it a risk. */
  opening_hours_buffer_minutes: 30,
  /** How much a route may exceed its estimate before the schedule is unsafe. */
  travel_time_tolerance: 1.25,
} as const;

export const GENERATION_CONFIG = {
  /** Search intents generated before hitting any provider (§14). */
  max_search_intents: 8,
  /** Candidates retrieved per intent. Cost control: this multiplies fast. */
  candidates_per_intent: 12,
  /** Shortlist handed to the model for selection. */
  shortlist_size: 12,
  /** Whole-pipeline attempts before we admit defeat and tell the user (§39). */
  max_generation_attempts: 3,
  /** Plan assembly attempts within one pipeline run, using next-ranked candidates. */
  max_assembly_attempts: 5,
  /** Swap requests a household may make per weekend before we stop (§25). */
  max_swaps_per_weekend: 3,
  /** Hard ceiling on provider spend per generation run, in cents. */
  max_provider_cost_cents_per_run: 120,
} as const;

export const COST_CONFIG = {
  /**
   * We never invent an exact price (§22). When a provider gives us a price
   * level rather than a number, these are the bands we quote — clearly labelled
   * as estimates, and wide enough to be honest.
   */
  price_level_bands: {
    0: { min: 0, max: 0 },
    1: { min: 5, max: 20 },
    2: { min: 20, max: 45 },
    3: { min: 45, max: 90 },
    4: { min: 90, max: 180 },
  } as Record<number, { min: number; max: number }>,
  /** Per-adult transport allowance when the plan uses public transport. */
  transit_cost_per_adult: 8,
  /** Rough fuel + parking allowance per 10 km driven. */
  driving_cost_per_10km: 3,
  /**
   * If a paid attraction's price is unknown and it would consume more than
   * this share of the household's stated budget were it at the top of its
   * band, we drop it rather than guess (§22).
   */
  unknown_price_budget_share_limit: 0.35,
} as const;

/**
 * Safety envelope (§21). The MVP recommends gentle-to-moderate activity and
 * nothing that needs judgement we cannot verify remotely.
 */
export const SAFETY_CONFIG = {
  max_activity_level: "ACTIVE" as const,
  /** Walking distance we will never exceed regardless of stated fitness. */
  max_walk_km: 14,
  /** Categories excluded from candidate generation entirely. */
  banned_categories: [
    "rock_climbing",
    "canyoning",
    "scuba_diving",
    "skydiving",
    "remote_wilderness_hike",
    "open_water_swim",
    "motorsport",
    "shooting_range",
    "casino",
    "nightclub",
    "bar_crawl",
    "adult_entertainment",
  ] as readonly string[],
  /** Additional exclusions when any household member is a child. */
  banned_categories_with_children: [
    "wine_tasting_only",
    "brewery_tour",
    "cocktail_bar",
    "late_night_venue",
  ] as readonly string[],
} as const;
