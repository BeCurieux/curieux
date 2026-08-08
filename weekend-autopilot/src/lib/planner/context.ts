/**
 * Stage 1 — context assembly (§13).
 *
 * Turns the stored profile, the learned taste model and this weekend's
 * check-in into a single resolved picture. The important work here is
 * reconciling three sources that frequently disagree:
 *
 *   what they said at onboarding   (stated)
 *   what they have actually done   (behavioural)
 *   what they told us this week    (situational)
 *
 * The rule (§10, §18): situational overrides both; behavioural gradually
 * overrides stated. Everything downstream reads `derived` and does not have
 * to re-litigate the reconciliation.
 */

import type { Market } from "@/config/markets";
import type { CategoryId } from "@/config/taxonomy";
import { SCORING_CONFIG } from "@/config/scoring";
import type {
  ActivityLevel,
  BudgetBand,
  CategoryStats,
  Household,
  HouseholdMember,
  PreferenceProfile,
  TasteSignal,
  TimeBudget,
  TransportMode,
  WeatherForecast,
  WeekendCheckin,
} from "@/lib/types";
import type { DerivedContext, PlanningContext } from "./types";

/** Upper bound in dollars implied by each stated budget band. */
const BUDGET_CEILING: Record<BudgetBand, number> = {
  FREE: 25,
  UNDER_75: 75,
  "75_150": 150,
  "150_250": 250,
  FLEXIBLE: 300,
};

/** Usable minutes implied by each stated time budget. */
const TIME_MINUTES: Record<TimeBudget, number> = {
  FEW_HOURS: 180,
  HALF_DAY: 300,
  MOST_OF_DAY: 420,
  FULL_WEEKEND: 480,
};

const START_TIMES: Record<string, string> = {
  EARLY: "07:45",
  AROUND_9: "09:00",
  AROUND_10: "10:00",
  LATE_MORNING: "11:00",
  FLEXIBLE: "09:30",
};

const ACTIVITY_ORDER: ActivityLevel[] = ["GENTLE", "EASY", "MODERATE", "ACTIVE"];

export interface BuildContextInput {
  household: Household;
  members: HouseholdMember[];
  preferences: PreferenceProfile;
  taste: TasteSignal[];
  categoryStats: CategoryStats[];
  checkin: WeekendCheckin | null;
  market: Market;
  weekendDate: string;
  weather: WeatherForecast | null;
}

export function buildPlanningContext(input: BuildContextInput): PlanningContext {
  const { household, members, preferences, taste, categoryStats, checkin } = input;

  if (household.home_lat === null || household.home_lng === null) {
    throw new Error("Household has no home location; onboarding is incomplete");
  }

  const adults = members.filter((m) => m.member_type === "ADULT").length || 1;
  const childAges = members
    .filter((m) => m.member_type === "CHILD")
    .map((m) => m.age)
    .filter((age): age is number => age !== null)
    .sort((a, b) => a - b);

  const derived: DerivedContext = {
    adults,
    childAges,
    youngestChildAge: childAges[0] ?? null,
    hasChildren: childAges.length > 0,
    mobilityNotes: members
      .map((m) => m.mobility_notes)
      .filter((n): n is string => Boolean(n && n.trim())),

    effectiveTravelMinutes: resolveTravelMinutes(preferences, taste, checkin),
    effectiveBudgetMax: resolveBudget(preferences, checkin, adults),
    effectiveTimeMinutes: resolveTime(preferences, checkin),
    effectiveActivityLevel: resolveActivityLevel(preferences, checkin),
    departureTime: resolveDeparture(preferences, taste, checkin),
    transportModes: resolveTransport(preferences, checkin),
    crowdTolerance: resolveCrowdTolerance(preferences, taste),

    ...resolveCategoryBehaviour(categoryStats, taste),
    ...resolveRecency(categoryStats),
    repeatAppetite: resolveRepeatAppetite(categoryStats),
  };

  return {
    household,
    members,
    preferences,
    taste,
    categoryStats,
    checkin,
    market: input.market,
    weekendDate: input.weekendDate,
    home: { lat: household.home_lat, lng: household.home_lng },
    weather: input.weather,
    derived,
  };
}

// ------------------------------------------------------------ reconciliation

function resolveTravelMinutes(
  preferences: PreferenceProfile,
  taste: TasteSignal[],
  checkin: WeekendCheckin | null
): number {
  let minutes = preferences.max_travel_minutes;

  // A learned travel signal moves the stated radius, but never past double or
  // below fifteen minutes — behaviour informs the number, it does not replace it.
  const signal = taste.find((s) => s.dimension === "travel_max_minutes");
  if (signal) {
    const learned = Number(signal.value);
    if (Number.isFinite(learned) && signal.confidence > 0.4) {
      minutes = Math.round(minutes * (1 - signal.confidence) + learned * signal.confidence);
    }
  }

  // "Need to stay close" this week trumps everything.
  if (checkin?.time === "FEW_HOURS") minutes = Math.min(minutes, 30);
  if (checkin?.energy === "LOW") minutes = Math.min(minutes, Math.round(minutes * 0.7));

  return Math.max(15, Math.min(120, minutes));
}

function resolveBudget(
  preferences: PreferenceProfile,
  checkin: WeekendCheckin | null,
  adults: number
): number {
  // The stated band is a TOTAL household figure (§9 screen 4), so it is not
  // multiplied by headcount. Solo households get a little more headroom per
  // person than the band implies, which matches how people actually spend.
  let ceiling = BUDGET_CEILING[preferences.budget_band];
  if (adults === 1 && preferences.budget_band !== "FREE") ceiling *= 0.8;

  switch (checkin?.budget) {
    case "LOW":
      return Math.min(ceiling, Math.max(20, ceiling * 0.4));
    case "HIGH":
      return ceiling * 1.5;
    default:
      return ceiling;
  }
}

function resolveTime(preferences: PreferenceProfile, checkin: WeekendCheckin | null): number {
  switch (checkin?.time) {
    case "FEW_HOURS":
      return 180;
    case "HALF_DAY":
      return 300;
    case "WHOLE_DAY":
      return 420;
    default:
      return TIME_MINUTES[preferences.time_budget];
  }
}

/**
 * Where the "wannabe active" user is actually served (§9 screen 5).
 *
 * The plan targets their current level, then nudges toward the desired level
 * by an amount they consented to. A user who is EASY, wants ACTIVE and asked
 * to be pushed gets MODERATE — one step, not a transformation. Someone who
 * said "meet me where I am" gets exactly where they are, always.
 */
function resolveActivityLevel(
  preferences: PreferenceProfile,
  checkin: WeekendCheckin | null
): ActivityLevel {
  const current = ACTIVITY_ORDER.indexOf(preferences.activity_level);
  const desired = ACTIVITY_ORDER.indexOf(preferences.desired_activity_level);

  let target = current;
  if (preferences.nudge === "LITTLE" && desired > current) target = current + 1;
  if (preferences.nudge === "YES" && desired > current) {
    // Even an enthusiastic nudge moves at most two steps, and never past what
    // they said they wanted.
    target = Math.min(desired, current + 2);
  }

  // Tiredness this week overrides ambition; energy is the whole point of asking.
  if (checkin?.energy === "LOW") target = Math.max(0, Math.min(target, current) - 1);
  if (checkin?.energy === "HIGH") target = Math.min(ACTIVITY_ORDER.length - 1, target + 1);

  return ACTIVITY_ORDER[Math.max(0, Math.min(ACTIVITY_ORDER.length - 1, target))] ?? "EASY";
}

function resolveDeparture(
  preferences: PreferenceProfile,
  taste: TasteSignal[],
  checkin: WeekendCheckin | null
): string {
  const learned = taste.find((s) => s.dimension === "start_time");
  if (learned && learned.confidence > 0.6 && /^\d{2}:\d{2}$/.test(learned.value)) {
    return learned.value;
  }
  let time = START_TIMES[preferences.start_time_preference] ?? "09:30";
  // Low energy earns a later start rather than an earlier alarm.
  if (checkin?.energy === "LOW" && time < "10:00") time = "10:00";
  return time;
}

function resolveTransport(
  preferences: PreferenceProfile,
  checkin: WeekendCheckin | null
): TransportMode[] {
  const modes = [...preferences.transport_modes];
  // "no car" in the free-text note is common enough to be worth honouring
  // structurally rather than hoping the model notices.
  if (checkin?.note && /\bno car\b|\bwithout the car\b|car('s| is) (in|at) /i.test(checkin.note)) {
    return modes.filter((m) => m !== "DRIVING").length > 0
      ? modes.filter((m) => m !== "DRIVING")
      : ["TRANSIT", "WALKING"];
  }
  return modes.length > 0 ? modes : ["TRANSIT", "WALKING"];
}

function resolveCrowdTolerance(preferences: PreferenceProfile, taste: TasteSignal[]): number {
  const signal = taste.find((s) => s.dimension === "crowd_tolerance");
  if (signal) {
    const learned = Number(signal.value);
    if (Number.isFinite(learned)) {
      return clamp01(
        preferences.crowd_tolerance * (1 - signal.confidence) + learned * signal.confidence
      );
    }
  }
  return preferences.crowd_tolerance;
}

/**
 * Behavioural override of stated interests (§18).
 *
 * A category is suppressed once the household has rejected it repeatedly, even
 * if they ticked it at onboarding — the museum case in the brief. It is
 * favoured when they keep completing and loving it.
 */
function resolveCategoryBehaviour(
  stats: CategoryStats[],
  taste: TasteSignal[]
): Pick<DerivedContext, "suppressedCategories" | "favouredCategories"> {
  const suppressed = new Set<CategoryId>();
  const favoured = new Set<CategoryId>();

  for (const stat of stats) {
    const decided = stat.rejected_count + stat.completed_count;
    if (decided >= 3 && stat.rejected_count >= 3 && stat.completed_count === 0) {
      suppressed.add(stat.category_id);
    }
    if (stat.completed_count >= 2 && stat.loved_count >= 1) {
      favoured.add(stat.category_id);
    }
  }

  // Explicit negative taste signals suppress too, once we are confident.
  for (const signal of taste) {
    if (signal.dimension !== "category") continue;
    if (signal.weight <= -0.6 && signal.confidence >= 0.6) suppressed.add(signal.value);
    if (signal.weight >= 0.6 && signal.confidence >= 0.6) favoured.add(signal.value);
  }

  // A category cannot be both; recent evidence of enjoyment wins.
  for (const id of favoured) suppressed.delete(id);

  return { suppressedCategories: suppressed, favouredCategories: favoured };
}

function resolveRecency(
  stats: CategoryStats[]
): Pick<DerivedContext, "recentlySuggested" | "recentlyCompleted"> {
  // Category-level recency; place-level recency is loaded separately by the
  // repository because it needs the plan_items join.
  const recentlySuggested = new Map<string, string>();
  const recentlyCompleted = new Map<string, string>();
  for (const stat of stats) {
    if (stat.last_suggested_at) recentlySuggested.set(stat.category_id, stat.last_suggested_at);
    if (stat.last_completed_at) recentlyCompleted.set(stat.category_id, stat.last_completed_at);
  }
  return { recentlySuggested, recentlyCompleted };
}

/**
 * Some households want a different thing every week; others would happily do
 * the same coastal walk forty times and be delighted each time (§18). We infer
 * which from whether repeats have been completed and loved.
 */
function resolveRepeatAppetite(stats: CategoryStats[]): number {
  const repeated = stats.filter((s) => s.completed_count >= 2);
  if (repeated.length === 0) return SCORING_CONFIG.default_novelty_appetite;

  const lovedRepeats = repeated.filter((s) => s.loved_count >= 1).length;
  const ratio = lovedRepeats / repeated.length;
  // Blend toward the observation rather than jumping to it; two data points
  // should not convince us someone never wants anything new.
  const evidence = Math.min(1, repeated.length / 5);
  return clamp01(SCORING_CONFIG.default_novelty_appetite * (1 - evidence) + ratio * evidence);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
