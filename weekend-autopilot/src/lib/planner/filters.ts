/**
 * Stage 4 — hard filters (§15).
 *
 * This is a rejection stage, not a ranking stage. Everything here answers
 * "is this impossible?" rather than "is this good?", and impossible means
 * impossible: no score, however high, resurrects a candidate rejected here.
 *
 * Every rejection records a rule and a human-readable reason, because the
 * admin plan inspector (§42) is how we learn where the autonomous system is
 * wrong, and "nothing came back" is not a diagnosis.
 *
 * MVP bias (§15): favour the reliable over the clever. When a rule is
 * uncertain, this stage prefers to reject and let the scorer work with fewer,
 * safer candidates.
 */

import { COST_CONFIG, SAFETY_CONFIG, WEATHER_RULES } from "@/config/planner";
import { category } from "@/config/taxonomy";
import { SCORING_CONFIG } from "@/config/scoring";
import type { OpeningHours } from "@/lib/types";
import { isoWeekday, toMinutes } from "@/lib/util/time";
import type { Candidate, PlanningContext } from "./types";

export interface FilterResult {
  kept: Candidate[];
  rejected: Candidate[];
}

export function applyHardFilters(candidates: Candidate[], ctx: PlanningContext): FilterResult {
  const kept: Candidate[] = [];
  const rejected: Candidate[] = [];

  for (const candidate of candidates) {
    const rejection = firstFailure(candidate, ctx);
    if (rejection) {
      candidate.rejection = rejection;
      rejected.push(candidate);
    } else {
      kept.push(candidate);
    }
  }

  return { kept, rejected };
}

type Rejection = { rule: string; detail: string } | null;

/** Rules run cheapest-and-most-decisive first. */
function firstFailure(c: Candidate, ctx: PlanningContext): Rejection {
  return (
    alreadyRejected(c) ??
    confirmedClosed(c) ??
    outsideTravelRadius(c, ctx) ??
    incompatibleTransport(c, ctx) ??
    unsafeCategory(c, ctx) ??
    adultOnlyWithChildren(c, ctx) ??
    unsuitableForChildAge(c, ctx) ??
    inaccessible(c, ctx) ??
    explicitlyBlocked(c, ctx) ??
    tooIntense(c, ctx) ??
    closedDuringTargetPeriod(c, ctx) ??
    clearlyOverBudget(c, ctx) ??
    unknowablePriceThatMatters(c, ctx) ??
    doneTooRecently(c, ctx) ??
    extremeWeatherMismatch(c, ctx) ??
    bookingWithoutMechanism(c, ctx)
  );
}

/** Retrieval may already have rejected it (no route, no details). */
function alreadyRejected(c: Candidate): Rejection {
  return c.rejection;
}

function confirmedClosed(c: Candidate): Rejection {
  if (c.businessStatus === "CLOSED_PERMANENTLY") {
    return { rule: "permanently_closed", detail: "Provider reports permanently closed" };
  }
  if (c.openingHours?.permanently_closed) {
    return { rule: "permanently_closed", detail: "Opening hours report permanently closed" };
  }
  if (c.businessStatus === "CLOSED_TEMPORARILY") {
    return { rule: "temporarily_closed", detail: "Provider reports temporarily closed" };
  }
  return null;
}

function outsideTravelRadius(c: Candidate, ctx: PlanningContext): Rejection {
  if (!c.travel) {
    return { rule: "no_travel_estimate", detail: "No routed travel time available" };
  }
  const stretch = ctx.preferences.allow_occasional_further && c.role === "ANCHOR" ? 1.35 : 1;
  const allowance = ctx.derived.effectiveTravelMinutes * stretch;
  if (c.travel.minutes > allowance) {
    return {
      rule: "outside_travel_radius",
      detail: `${c.travel.minutes} min exceeds ${Math.round(allowance)} min`,
    };
  }
  return null;
}

function incompatibleTransport(c: Candidate, ctx: PlanningContext): Rejection {
  if (!c.travel) return null;
  if (!ctx.derived.transportModes.includes(c.travel.mode)) {
    return {
      rule: "incompatible_transport",
      detail: `Only reachable by ${c.travel.mode}, which this household does not have`,
    };
  }
  return null;
}

function unsafeCategory(c: Candidate, ctx: PlanningContext): Rejection {
  const banned = c.categories.find((id) => SAFETY_CONFIG.banned_categories.includes(id));
  if (banned) return { rule: "unsafe_category", detail: `Category ${banned} is out of scope` };

  if (ctx.derived.hasChildren) {
    const bannedForKids = c.categories.find((id) =>
      SAFETY_CONFIG.banned_categories_with_children.includes(id)
    );
    if (bannedForKids) {
      return { rule: "unsafe_category_children", detail: `${bannedForKids} with children present` };
    }
  }
  return null;
}

function adultOnlyWithChildren(c: Candidate, ctx: PlanningContext): Rejection {
  if (!ctx.derived.hasChildren) return null;
  // Wellness venues in our taxonomy are bathhouses and spas: adult spaces.
  if (c.categories.includes("wellness") && (ctx.derived.youngestChildAge ?? 99) < 12) {
    return { rule: "adult_only_destination", detail: "Adult-oriented venue, children in household" };
  }
  return null;
}

/**
 * Child suitability (§15). Age matters far more than any stated preference:
 * the gap between a two-year-old and a seven-year-old is the difference
 * between a good Saturday and a bad one.
 */
function unsuitableForChildAge(c: Candidate, ctx: PlanningContext): Rejection {
  const youngest = ctx.derived.youngestChildAge;
  if (youngest === null) return null;

  for (const id of c.categories) {
    const meta = category(id);
    if (!meta) continue;
    if (meta.min_child_age > youngest) {
      return {
        rule: "unsuitable_child_age",
        detail: `${meta.label} suits ages ${meta.min_child_age}+, youngest is ${youngest}`,
      };
    }
  }

  // Distance is its own age rule: a four-year-old does not walk six kilometres,
  // whatever the category metadata says about the track.
  const walkCap = childWalkCapKm(youngest);
  if (c.walkKm > walkCap) {
    return {
      rule: "walk_too_long_for_child",
      detail: `${c.walkKm} km exceeds ~${walkCap} km realistic for a ${youngest}-year-old`,
    };
  }
  return null;
}

/** Rough realistic self-powered distance by age. Prams change this, handled below. */
export function childWalkCapKm(age: number): number {
  if (age <= 1) return 8; // carried or in a pram: the adults' limit applies
  if (age <= 3) return 2;
  if (age <= 5) return 3.5;
  if (age <= 8) return 5;
  if (age <= 12) return 8;
  return 12;
}

function inaccessible(c: Candidate, ctx: PlanningContext): Rejection {
  const notes = ctx.derived.mobilityNotes.join(" ").toLowerCase();
  if (!notes) return null;

  const needsStepFree = /wheelchair|pram|stroller|mobility|walker|crutches/.test(notes);
  if (needsStepFree && c.categories.includes("bushwalks")) {
    return {
      rule: "accessibility_mismatch",
      detail: "Bush track with a stated step-free requirement",
    };
  }
  return null;
}

function explicitlyBlocked(c: Candidate, ctx: PlanningContext): Rejection {
  const suppressed = c.categories.find((id) => ctx.derived.suppressedCategories.has(id));
  if (suppressed && c.role === "ANCHOR") {
    return {
      rule: "behaviourally_suppressed",
      detail: `Household has repeatedly rejected ${suppressed}`,
    };
  }

  // "Absolutely not" free text (§9 screen 7). Matched conservatively against
  // the name and categories — this is a customer's own words, and treating it
  // loosely is worse than treating it narrowly.
  const hardNo = ctx.preferences.hard_no?.toLowerCase().trim();
  if (hardNo && hardNo.length >= 3) {
    const haystack = `${c.name} ${c.categories.join(" ")}`.toLowerCase();
    const terms = hardNo.split(/[,;]|\band\b/).map((t) => t.trim()).filter((t) => t.length >= 3);
    const hit = terms.find((t) => haystack.includes(t));
    if (hit) return { rule: "explicit_hard_no", detail: `Matches "${hit}"` };
  }

  return null;
}

function tooIntense(c: Candidate, ctx: PlanningContext): Rejection {
  const order = ["GENTLE", "EASY", "MODERATE", "ACTIVE"];
  const target = order.indexOf(ctx.derived.effectiveActivityLevel);

  for (const id of c.categories) {
    const meta = category(id);
    if (!meta) continue;
    // One step above target is a nudge; two is an imposition.
    if (order.indexOf(meta.intensity) > target + 1) {
      return {
        rule: "activity_too_intense",
        detail: `${meta.label} is ${meta.intensity}, household is targeting ${ctx.derived.effectiveActivityLevel}`,
      };
    }
  }

  if (c.walkKm > SAFETY_CONFIG.max_walk_km) {
    return { rule: "walk_exceeds_safety_cap", detail: `${c.walkKm} km over hard cap` };
  }
  return null;
}

/**
 * Likely closed during the target period (§15). Deliberately distinguishes
 * three states: confirmed closed rejects, unknown does not (it is penalised
 * later), and open passes. Conflating "we don't know" with "closed" would
 * silently delete most small venues from the candidate pool.
 */
function closedDuringTargetPeriod(c: Candidate, ctx: PlanningContext): Rejection {
  if (c.public_space) return null;
  const hours = c.openingHours;
  if (!hours || hours.unknown) return null;

  const weekday = isoWeekday(ctx.weekendDate);
  const periods = hours.periods[weekday];
  if (!periods || periods.length === 0) {
    return { rule: "closed_on_target_day", detail: `Closed on day ${weekday}` };
  }

  // Some part of the household's usable window must overlap the opening hours.
  const windowStart = toMinutes(ctx.derived.departureTime);
  const windowEnd = windowStart + ctx.derived.effectiveTimeMinutes;
  const overlaps = periods.some((p) => {
    const open = toMinutes(p.open);
    const close = toMinutes(p.close);
    return close > windowStart && open < windowEnd;
  });

  if (!overlaps) {
    return {
      rule: "closed_during_usable_window",
      detail: `Open ${periods.map((p) => `${p.open}–${p.close}`).join(", ")}, household is out ${ctx.derived.departureTime}–${Math.floor(windowEnd / 60)}:00`,
    };
  }
  return null;
}

function clearlyOverBudget(c: Candidate, ctx: PlanningContext): Rejection {
  if (!c.cost) return null;
  const perHousehold = c.cost.min * chargeableHeads(ctx);
  if (perHousehold > ctx.derived.effectiveBudgetMax) {
    return {
      rule: "over_budget",
      detail: `Minimum ${Math.round(perHousehold)} exceeds budget ${Math.round(ctx.derived.effectiveBudgetMax)}`,
    };
  }
  return null;
}

/**
 * §22: if a paid attraction's price is unknown, and it could plausibly consume
 * a large share of the budget, we do not recommend it. Guessing is how a
 * customer ends up at a A$60-a-head attraction on a A$75 weekend.
 */
function unknowablePriceThatMatters(c: Candidate, ctx: PlanningContext): Rejection {
  if (c.public_space) return null;
  if (c.cost) return null;
  if (c.role === "FOOD") return null; // food has a well-understood floor

  const isPaidAttraction = c.categories.some((id) => (category(id)?.typical_cost_band ?? 0) >= 2);
  if (!isPaidAttraction) return null;

  const plausibleMax = COST_CONFIG.price_level_bands[3]?.max ?? 90;
  const share = (plausibleMax * chargeableHeads(ctx)) / ctx.derived.effectiveBudgetMax;
  if (share > COST_CONFIG.unknown_price_budget_share_limit) {
    return {
      rule: "unknown_price_material_to_budget",
      detail: "No trusted price for a paid attraction that could dominate the budget",
    };
  }
  return null;
}

/**
 * Recency (§15, §18). A household that loves repeats is exempt: for them,
 * "you did this six weeks ago" is a feature.
 */
function doneTooRecently(c: Candidate, ctx: PlanningContext): Rejection {
  if (c.role !== "ANCHOR") return null;
  if (ctx.derived.repeatAppetite > 0.7) return null;

  const now = new Date(`${ctx.weekendDate}T00:00:00Z`).getTime();
  const weeksSince = (iso: string): number =>
    (now - new Date(iso).getTime()) / (7 * 24 * 3600 * 1000);

  for (const id of c.categories) {
    const completed = ctx.derived.recentlyCompleted.get(id);
    if (completed && weeksSince(completed) < SCORING_CONFIG.repeat_window_weeks / 3) {
      return {
        rule: "completed_too_recently",
        detail: `Did ${id} ${Math.round(weeksSince(completed))} weeks ago`,
      };
    }
  }
  return null;
}

/** Extreme weather (§21). Ordinary weather is a scoring matter, not a filter. */
function extremeWeatherMismatch(c: Candidate, ctx: PlanningContext): Rejection {
  const weather = ctx.weather;
  if (!weather) return null;

  const exposure = Math.max(0, ...c.categories.map((id) => category(id)?.exposure ?? 0));

  // 0.5 catches partly-shaded bush tracks as well as open coastal paths: at
  // 36°C an eight-kilometre walk under half-shade is still a bad Saturday.
  if (weather.temperature_max >= WEATHER_RULES.very_hot_temp_c && exposure >= 0.5) {
    const isWater = c.categories.some((id) => id === "swimming" || id === "beaches");
    if (!isWater && c.walkKm > WEATHER_RULES.max_exposed_km_when_hot) {
      return {
        rule: "heat_exposure",
        detail: `${c.walkKm} km exposed at ${Math.round(weather.temperature_max)}°C`,
      };
    }
  }

  const storming = weather.weather_code >= 95;
  if (storming && exposure > 0.5) {
    return { rule: "storm_exposure", detail: "Storms forecast, exposed activity" };
  }

  const soaked =
    weather.precipitation_amount >= WEATHER_RULES.wet_precipitation_mm * 2 &&
    weather.precipitation_probability >= 0.7;
  if (soaked && exposure > 0.7 && !c.categories.includes("swimming")) {
    return {
      rule: "heavy_rain_exposure",
      detail: `${weather.precipitation_amount}mm forecast on an exposed activity`,
    };
  }

  return null;
}

/**
 * If something genuinely requires booking and we have no way to check
 * availability, we do not put it in a plan and tell someone to turn up (§15).
 */
function bookingWithoutMechanism(c: Candidate, ctx: PlanningContext): Rejection {
  if (!c.bookingRequired) return null;
  if (c.website) return null;
  return {
    rule: "booking_required_no_mechanism",
    detail: "Requires booking with no verifiable availability or booking link",
  };
}

/** Children under about four rarely pay; used for budget arithmetic. */
export function chargeableHeads(ctx: PlanningContext): number {
  const payingChildren = ctx.derived.childAges.filter((age) => age >= 4).length;
  return ctx.derived.adults + payingChildren;
}
