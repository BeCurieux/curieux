/**
 * Stage 5 — deterministic scoring (§17).
 *
 * Everything here is arithmetic over facts. No model is consulted, no
 * randomness is used, and the weights come from config rather than from a
 * prompt — so the same inputs always produce the same ranking, and a bad
 * recommendation can be explained by pointing at a dimension rather than
 * re-reading a paragraph of English.
 *
 * Each dimension returns 0–1 and is multiplied by its configured weight.
 * Penalties are absolute points subtracted afterwards.
 */

import { WEATHER_RULES } from "@/config/planner";
import { SCORING_CONFIG, SCORING_PENALTIES, SCORING_WEIGHTS } from "@/config/scoring";
import { category } from "@/config/taxonomy";
import type { ActivityLevel } from "@/lib/types";
import { backtrackRatio } from "@/lib/util/geo";
import { weatherBucket } from "@/lib/providers/weather/provider";
import { chargeableHeads, childWalkCapKm } from "./filters";
import type { Bundle, Candidate, CandidateScore, PlanningContext } from "./types";

// ------------------------------------------------------------ candidates

export function scoreCandidate(c: Candidate, ctx: PlanningContext): CandidateScore {
  const dimensions = {
    personal_interest_fit: personalInterestFit(c, ctx),
    household_fit: householdFit(c, ctx),
    weather_fit: weatherFit(c, ctx),
    travel_fit: travelFit(c, ctx),
    budget_fit: budgetFit(c, ctx),
    energy_fit: energyFit(c, ctx),
    novelty: novelty(c, ctx),
    logistical_simplicity: logisticalSimplicity(c),
  };

  const weighted: Record<string, number> = {};
  let total = 0;
  for (const [name, value] of Object.entries(dimensions)) {
    const points = value * SCORING_WEIGHTS[name as keyof typeof SCORING_WEIGHTS];
    weighted[name] = round2(points);
    total += points;
  }

  const penalties = candidatePenalties(c, ctx);
  for (const points of Object.values(penalties)) total -= points;

  return {
    total: round2(Math.max(0, total)),
    dimensions: weighted,
    penalties,
    advisory: null,
  };
}

/**
 * Interest fit blends what they said with what they have done, weighted by our
 * confidence in the behavioural evidence (§18). With no history this is purely
 * the onboarding selection; after a few months it is mostly behaviour.
 */
function personalInterestFit(c: Candidate, ctx: PlanningContext): number {
  const liked = new Set(ctx.preferences.liked_categories);
  const stated = c.categories.some((id) => liked.has(id)) ? 1 : 0.35;

  const signals = ctx.taste.filter(
    (s) => s.dimension === "category" && c.categories.includes(s.value)
  );

  if (signals.length === 0) return stated;

  // Confidence-weighted mean of the behavioural signals, mapped from −1…1 to 0…1.
  const totalConfidence = signals.reduce((sum, s) => sum + s.confidence, 0);
  const behavioural =
    totalConfidence > 0
      ? signals.reduce((sum, s) => sum + s.weight * s.confidence, 0) / totalConfidence
      : 0;
  const behaviouralScore = (behavioural + 1) / 2;

  // How much to trust behaviour over what they said: rises with evidence.
  const trust = Math.min(0.8, totalConfidence / 3);
  let score = stated * (1 - trust) + behaviouralScore * trust;

  if (c.categories.some((id) => ctx.derived.favouredCategories.has(id))) {
    score = Math.min(1, score + 0.15);
  }
  return clamp01(score);
}

/**
 * Household fit (§26). Not an average across members — the question is
 * whether this works for the household as a unit, which is dominated by its
 * least flexible member.
 */
function householdFit(c: Candidate, ctx: PlanningContext): number {
  let score = 0.75;

  const youngest = ctx.derived.youngestChildAge;
  if (youngest !== null) {
    const minAge = Math.max(0, ...c.categories.map((id) => category(id)?.min_child_age ?? 0));
    // Comfortably suitable beats barely suitable.
    if (minAge === 0) score += 0.2;
    else if (youngest >= minAge + 3) score += 0.1;
    else if (youngest >= minAge) score -= 0.05;

    // Facilities that make a day with a small child work.
    if (c.categories.includes("playgrounds")) score += 0.1;
    if (c.categories.includes("swimming") && youngest >= 3) score += 0.05;

    const cap = childWalkCapKm(youngest);
    if (c.walkKm > cap * 0.8) score -= 0.15;
  }

  if (ctx.derived.mobilityNotes.length > 0) {
    const meta = c.categories.map((id) => category(id));
    const steep = meta.some((m) => m?.id === "bushwalks");
    if (steep) score -= 0.35;
    if (c.categories.includes("easy_walks") || c.categories.includes("gardens")) score += 0.1;
  }

  // Solo diners do better somewhere casual than at a two-hour formal lunch.
  if (ctx.derived.adults === 1 && c.categories.includes("food")) {
    if (c.price_level !== null && c.price_level <= 2) score += 0.05;
    else if (c.price_level !== null && c.price_level >= 4) score -= 0.1;
  }

  return clamp01(score);
}

/** Weather fit (§21). Rules from config, never hard-coded thresholds. */
function weatherFit(c: Candidate, ctx: PlanningContext): number {
  const weather = ctx.weather;
  if (!weather) return 0.6; // no forecast: neutral, and the copy makes no claims

  const exposure = Math.max(0, ...c.categories.map((id) => category(id)?.exposure ?? 0.3));
  const weatherproof = c.categories.some((id) => category(id)?.weatherproof);
  const bucket = weatherBucket(weather.weather_code);

  const wet =
    weather.precipitation_probability >= WEATHER_RULES.wet_precipitation_probability ||
    weather.precipitation_amount >= WEATHER_RULES.wet_precipitation_mm;

  if (wet || bucket === "storm" || bucket === "severe") {
    return weatherproof ? 0.95 : clamp01(0.5 - exposure * 0.5);
  }

  const hot = weather.temperature_max >= WEATHER_RULES.hot_temp_c;
  if (hot) {
    const isWater = c.categories.some((id) => id === "swimming" || id === "beaches");
    if (isWater) return 1;
    if (weatherproof) return 0.85;
    return clamp01(0.7 - exposure * 0.5);
  }

  const cold = weather.temperature_max <= WEATHER_RULES.cold_temp_c;
  if (cold) return weatherproof ? 0.85 : clamp01(0.65 - exposure * 0.25);

  const windy = weather.wind_speed >= WEATHER_RULES.windy_kmh;
  if (windy && exposure >= 0.8) return 0.4;

  // A genuinely lovely day: reward being outside rather than merely tolerating it.
  const fine =
    weather.precipitation_probability <= WEATHER_RULES.fine_precipitation_probability &&
    weather.temperature_max >= WEATHER_RULES.fine_temp_range_c.min &&
    weather.temperature_max <= WEATHER_RULES.fine_temp_range_c.max;
  if (fine) return clamp01(0.55 + exposure * 0.45);

  return 0.7;
}

function travelFit(c: Candidate, ctx: PlanningContext): number {
  if (!c.travel) return 0;
  const budget = ctx.derived.effectiveTravelMinutes;
  const ratio = c.travel.minutes / budget;

  // Closer is better, but not linearly: 10 minutes and 15 minutes feel the
  // same, whereas 45 and 60 do not.
  if (ratio <= 0.35) return 1;
  if (ratio <= 0.6) return 0.9;
  if (ratio <= 0.85) return 0.7;
  if (ratio <= 1) return 0.5;
  return 0.2;
}

function budgetFit(c: Candidate, ctx: PlanningContext): number {
  const budget = ctx.derived.effectiveBudgetMax;
  if (!c.cost) return 0.5; // unknown; the penalty handles the uncertainty

  const heads = chargeableHeads(ctx);
  const mid = ((c.cost.min + c.cost.max) / 2) * heads;
  const share = mid / budget;

  // A free anchor is a positive, not a neutral: some of the best weekends
  // cost nothing (§16), and the scorer should be able to say so.
  if (share === 0) return 1;
  if (share <= 0.25) return 0.95;
  if (share <= 0.5) return 0.8;
  if (share <= 0.75) return 0.6;
  if (share <= 1) return 0.35;
  return 0.05;
}

function energyFit(c: Candidate, ctx: PlanningContext): number {
  const order: ActivityLevel[] = ["GENTLE", "EASY", "MODERATE", "ACTIVE"];
  const target = order.indexOf(ctx.derived.effectiveActivityLevel);
  const intensity = Math.max(
    0,
    ...c.categories.map((id) => order.indexOf(category(id)?.intensity ?? "EASY"))
  );

  const gap = intensity - target;
  if (gap === 0) return 1;
  if (gap === 1) return ctx.preferences.nudge === "NONE" ? 0.6 : 0.85; // the nudge
  if (gap === -1) return 0.75;
  return clamp01(0.5 - Math.abs(gap) * 0.15);
}

/**
 * Novelty (§18). Not automatically good. A household with a high repeat
 * appetite scores familiar things well; one that wants variety does not.
 */
function novelty(c: Candidate, ctx: PlanningContext): number {
  const stats = ctx.categoryStats.filter((s) => c.categories.includes(s.category_id));
  const suggested = stats.reduce((sum, s) => sum + s.suggested_count, 0);
  const completed = stats.reduce((sum, s) => sum + s.completed_count, 0);

  const isNew = suggested === 0;
  const appetite = ctx.derived.repeatAppetite;

  if (isNew) {
    // Novelty-seekers reward the unfamiliar; repeaters are mildly wary of it.
    return clamp01(0.5 + (1 - appetite) * 0.5);
  }

  const familiarity = Math.min(1, completed / 3);
  return clamp01(0.4 + familiarity * appetite * 0.6);
}

function logisticalSimplicity(c: Candidate): number {
  let score = 1;
  if (c.bookingRequired) score -= 0.3;
  if (c.openingHours?.unknown) score -= 0.15;
  if (!c.travel) score -= 0.4;
  else if (c.travel.mode === "TRANSIT" && c.travel.minutes > 45) score -= 0.15;
  return clamp01(score);
}

function candidatePenalties(c: Candidate, ctx: PlanningContext): Record<string, number> {
  const penalties: Record<string, number> = {};
  const now = new Date(`${ctx.weekendDate}T00:00:00Z`).getTime();
  const weeksSince = (iso: string) => (now - new Date(iso).getTime()) / (7 * 24 * 3600 * 1000);

  for (const id of c.categories) {
    const suggested = ctx.derived.recentlySuggested.get(id);
    if (suggested && weeksSince(suggested) < SCORING_CONFIG.suggested_window_weeks) {
      penalties.recently_suggested = SCORING_PENALTIES.recently_suggested;
    }
    const completed = ctx.derived.recentlyCompleted.get(id);
    if (
      completed &&
      weeksSince(completed) < SCORING_CONFIG.repeat_window_weeks &&
      ctx.derived.repeatAppetite < 0.6
    ) {
      penalties.recently_completed = SCORING_PENALTIES.recently_completed;
    }
  }

  if (c.categories.some((id) => ctx.derived.suppressedCategories.has(id))) {
    penalties.explicit_dislike = SCORING_PENALTIES.explicit_dislike;
  }

  if (c.openingHours?.unknown && !c.public_space) {
    penalties.uncertain_opening_hours = SCORING_PENALTIES.uncertain_opening_hours;
  }
  if (c.cost && !c.cost.certain) {
    penalties.uncertain_price = SCORING_PENALTIES.uncertain_price;
  }

  // Crowd mismatch: a busy place for a household that said it avoids crowds.
  const busy = c.busyness ?? (c.categories.some((id) => category(id)?.typically_busy) ? 0.8 : 0.3);
  if (busy > 0.7 && ctx.derived.crowdTolerance < 0.4) {
    penalties.crowd_mismatch = SCORING_PENALTIES.crowd_mismatch;
  }
  if (ctx.preferences.dislikes.includes("crowds") && busy > 0.8) {
    penalties.crowd_mismatch = SCORING_PENALTIES.crowd_mismatch;
  }

  if (
    c.travel?.mode === "DRIVING" &&
    c.travel.minutes > SCORING_CONFIG.driving_penalty_minutes / 2 &&
    ctx.preferences.dislikes.includes("long_drives")
  ) {
    penalties.too_much_driving = SCORING_PENALTIES.too_much_driving;
  }

  return penalties;
}

// ------------------------------------------------------------ bundles

/**
 * Score a whole assembled day. The anchor carries most of the signal, but a
 * plan is more than its anchor: the shape of the day, how much of it is spent
 * travelling, and whether it fits the time available all matter.
 */
export function scoreBundle(bundle: Bundle, ctx: PlanningContext): void {
  const anchorScore = bundle.anchor.score?.total ?? 0;

  const dimensions: Record<string, number> = {};
  const penalties: Record<string, number> = {};

  // Component count: 2–4 meaningful stops feels relaxed; more feels like work.
  const meaningful = bundle.items.filter(
    (i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK"
  ).length;
  const { min, max } = SCORING_CONFIG.ideal_components;
  if (meaningful < min) {
    dimensions.composition = -6;
  } else if (meaningful > max) {
    penalties.too_many_components = SCORING_PENALTIES.too_many_components;
    dimensions.composition = 0;
  } else {
    dimensions.composition = 5;
  }

  // Travel share: how much of the day is spent getting there.
  const elapsed = totalElapsedMinutes(bundle);
  const travelShare = elapsed > 0 ? bundle.total_travel_minutes / elapsed : 1;
  if (travelShare > SCORING_CONFIG.max_travel_share) {
    dimensions.travel_share = -8 * (travelShare - SCORING_CONFIG.max_travel_share) * 3;
  } else {
    dimensions.travel_share = 4;
  }

  const drivingMinutes = bundle.items
    .filter((i) => i.travel_mode === "DRIVING")
    .reduce((sum, i) => sum + (i.travel_minutes ?? 0), 0);
  if (drivingMinutes > SCORING_CONFIG.driving_penalty_minutes) {
    penalties.too_much_driving = SCORING_PENALTIES.too_much_driving;
  }

  // Backtracking: a day that zigzags reads as badly planned even when it fits.
  const stops = bundle.items
    .filter((i) => i.candidate)
    .map((i) => ({ lat: i.candidate!.lat, lng: i.candidate!.lng }));
  const ratio = backtrackRatio(ctx.home, stops);
  if (ratio > 1.45) {
    penalties.route_backtracking = SCORING_PENALTIES.route_backtracking;
  }

  // Time fit: comfortably inside the usable window, not spilling past it.
  const timeBudget = ctx.derived.effectiveTimeMinutes;
  if (elapsed > timeBudget * 1.1) {
    dimensions.time_fit = -10;
  } else if (elapsed >= timeBudget * 0.5) {
    dimensions.time_fit = 5;
  } else {
    // A three-hour plan when they had all day is a missed opportunity, though
    // a mild one — some people want their Saturday back.
    dimensions.time_fit = 1;
  }

  // Budget across the whole day, not just the anchor. Bundle totals are
  // already whole-household figures — assembly multiplies per-head costs by
  // the chargeable headcount — so no further scaling happens here.
  const mid = (bundle.total_cost_min + bundle.total_cost_max) / 2;
  if (mid > ctx.derived.effectiveBudgetMax) {
    dimensions.budget_total = -12;
  } else if (mid <= ctx.derived.effectiveBudgetMax * 0.6) {
    dimensions.budget_total = 4;
  } else {
    dimensions.budget_total = 1;
  }

  const adjustments = Object.values(dimensions).reduce((a, b) => a + b, 0);
  const penaltyTotal = Object.values(penalties).reduce((a, b) => a + b, 0);

  bundle.base_score = round2(Math.max(0, Math.min(100, anchorScore + adjustments - penaltyTotal)));
  bundle.score_detail = { anchor_score: anchorScore, dimensions, penalties };
}

export function totalElapsedMinutes(bundle: Bundle): number {
  const first = bundle.items[0];
  const last = bundle.items[bundle.items.length - 1];
  if (!first || !last) return 0;
  const [sh, sm] = first.start_time.split(":").map(Number);
  const [eh, em] = last.end_time.split(":").map(Number);
  return (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
