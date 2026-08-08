/**
 * Stage 6 — plan assembly (§16).
 *
 * Takes ranked candidates and builds actual days: an anchor, somewhere to eat,
 * sometimes a small add-on, with real times computed from real travel and real
 * durations. A bundle either fits the household's window or it is discarded —
 * we never deliver a timeline that requires the day to be longer than it is.
 *
 * The output feels relaxed by construction: 2–4 meaningful components, one
 * main journey out and one back, and slack between stops. Eight destinations
 * and constant driving is a failure mode, not an ambitious plan.
 */

import { category } from "@/config/taxonomy";
import type { ActivityLevel, PlanItemType, TransportMode } from "@/lib/types";
import { haversineKm, optimisticMinutes } from "@/lib/util/geo";
import { addMinutes, toMinutes } from "@/lib/util/time";
import { chargeableHeads } from "./filters";
import { COST_CONFIG } from "@/config/planner";
import type { Archetype, Bundle, BundleItem, Candidate, PlanningContext } from "./types";

/** Slack between components so a plan never feels like a train timetable. */
const BUFFER_MINUTES = 10;

export interface AssemblyOptions {
  /** How many bundles to build. More gives the selector real choice. */
  limit?: number;
  /** Anchors to skip — used when regenerating after a verification failure. */
  excludeAnchorIds?: Set<string>;
  /** Bias the assembly toward an easier day (used for swaps, §25). */
  easierThan?: Bundle;
}

export function assembleBundles(
  candidates: Candidate[],
  ctx: PlanningContext,
  options: AssemblyOptions = {}
): Bundle[] {
  const limit = options.limit ?? 6;
  const exclude = options.excludeAnchorIds ?? new Set<string>();

  const anchors = candidates
    .filter((c) => c.role === "ANCHOR" || canAnchor(c))
    .filter((c) => !exclude.has(c.candidate_id))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

  const foods = candidates
    .filter((c) => c.categories.some((id) => ["food", "bakeries", "coffee"].includes(id)))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

  const addons = candidates
    .filter((c) => !canAnchor(c) && !c.categories.includes("food"))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

  const bundles: Bundle[] = [];
  const usedAnchors = new Set<string>();

  for (const anchor of anchors) {
    if (bundles.length >= limit) break;
    // One bundle per anchor: two plans built around the same beach are one
    // choice, not two, and the selector needs genuine alternatives.
    if (usedAnchors.has(anchor.provider_place_id)) continue;

    const bundle = buildBundle(anchor, foods, addons, ctx, bundles.length);
    if (bundle) {
      bundles.push(bundle);
      usedAnchors.add(anchor.provider_place_id);
    }
  }

  return bundles;
}

/**
 * Build one day around an anchor.
 *
 * Ordering is decided by what the components are rather than by their score:
 * a bakery belongs before a walk, lunch belongs after one, and a swim belongs
 * after the walking rather than before it.
 */
function buildBundle(
  anchor: Candidate,
  foods: Candidate[],
  addons: Candidate[],
  ctx: PlanningContext,
  index: number
): Bundle | null {
  const food = pickNearest(foods, anchor, ctx, 6, [anchor]);
  // A day must not visit the same place twice. Categories overlap — a harbour
  // kiosk is both "coffee" and a plausible add-on — so the add-on search has
  // to know what the food stop already claimed.
  const addon = pickAddon(addons, anchor, ctx, [anchor, food]);

  const archetype = chooseArchetype(anchor, food, addon);
  const ordered = orderComponents(anchor, food, addon, archetype);

  const items = schedule(ordered, anchor, ctx);
  if (!items) return null;

  const last = items[items.length - 1];
  const first = items[0];
  if (!first || !last) return null;

  const walkKm = items.reduce((sum, i) => sum + i.walk_km, 0);

  const bundle: Bundle = {
    bundle_id: `b_${index + 1}`,
    archetype,
    items,
    anchor,
    start_time: first.start_time,
    end_time: last.end_time,
    total_cost_min: round(items.reduce((sum, i) => sum + i.cost_min, 0)),
    total_cost_max: round(items.reduce((sum, i) => sum + i.cost_max, 0)),
    total_travel_minutes: items.reduce((sum, i) => sum + (i.travel_minutes ?? 0), 0),
    walk_km: round(walkKm),
    activity_level: activityLevelFor(walkKm, ordered),
    base_score: 0,
    score_detail: { anchor_score: 0, dimensions: {}, penalties: {} },
    verification: null,
  };

  return bundle;
}

/**
 * Lay the components out in time, from the household's departure.
 *
 * Travel between stops uses a conservative estimate rather than another paid
 * routing call: the legs are short, and the schedule carries buffers. The
 * home→anchor leg, which dominates the day and determines feasibility, does
 * use the real routed figure attached during retrieval.
 */
function schedule(
  components: Candidate[],
  anchor: Candidate,
  ctx: PlanningContext
): BundleItem[] | null {
  const items: BundleItem[] = [];
  const heads = chargeableHeads(ctx);
  const windowEnd = toMinutes(ctx.derived.departureTime) + ctx.derived.effectiveTimeMinutes;

  let clock = ctx.derived.departureTime;
  let sequence = 0;
  let position = ctx.home;
  let mode: TransportMode = components[0]?.travel?.mode ?? ctx.derived.transportModes[0] ?? "TRANSIT";

  for (const [componentIndex, component] of components.entries()) {
    const isFirstLeg = componentIndex === 0;
    const legMinutes = isFirstLeg
      ? (component.travel?.minutes ?? estimateLeg(position, component, mode))
      : estimateLeg(position, component, mode);
    const legMode = isFirstLeg ? (component.travel?.mode ?? mode) : mode;
    mode = legMode;

    if (legMinutes > 0) {
      items.push({
        sequence: sequence++,
        item_type: "TRAVEL",
        name: isFirstLeg ? "Leave home" : `Travel to ${component.name}`,
        description: isFirstLeg ? null : component.travel?.summary ?? null,
        candidate: null,
        start_time: clock,
        end_time: addMinutes(clock, legMinutes),
        travel_mode: legMode,
        travel_minutes: legMinutes,
        walk_km: 0,
        cost_min: 0,
        cost_max: 0,
        cost_certain: true,
        is_critical: false,
      });
      clock = addMinutes(clock, legMinutes);
    }

    const stay = component.durationMinutes;
    const cost = component.cost;
    items.push({
      sequence: sequence++,
      item_type: itemTypeFor(component),
      name: component.name,
      description: null,
      candidate: component,
      start_time: clock,
      end_time: addMinutes(clock, stay),
      travel_mode: null,
      travel_minutes: null,
      walk_km: component.walkKm,
      cost_min: round((cost?.min ?? 0) * heads),
      cost_max: round((cost?.max ?? 0) * heads),
      cost_certain: cost?.certain ?? false,
      // The ANCHOR is the critical item, not whatever happens to be scheduled
      // first — an early coffee stop is not the reason for the day, and
      // verification weights the critical item three times as heavily.
      is_critical: component.provider_place_id === anchor.provider_place_id,
    });
    clock = addMinutes(clock, stay + BUFFER_MINUTES);
    position = { lat: component.lat, lng: component.lng };
  }

  // The journey home. A plan that does not account for it lies about when the
  // day ends, which is exactly the detail people plan their Saturday around.
  const homeMinutes = estimateLegToHome(position, ctx, mode);
  items.push({
    sequence: sequence++,
    item_type: "TRAVEL",
    name: "Head home",
    description: null,
    candidate: null,
    start_time: clock,
    end_time: addMinutes(clock, homeMinutes),
    travel_mode: mode,
    travel_minutes: homeMinutes,
    walk_km: 0,
    cost_min: 0,
    cost_max: 0,
    cost_certain: true,
    is_critical: false,
  });
  clock = addMinutes(clock, homeMinutes);

  // Transport cost for the day, added once rather than per leg.
  const transportCost = transportCostFor(items, ctx);
  if (transportCost > 0) {
    const firstTravel = items.find((i) => i.item_type === "TRAVEL");
    if (firstTravel) {
      firstTravel.cost_min = round(transportCost * 0.85);
      firstTravel.cost_max = round(transportCost * 1.15);
      firstTravel.cost_certain = false;
    }
  }

  // Hard feasibility: the day must fit the window they told us they have.
  if (toMinutes(clock) > windowEnd + 45) return null;

  return items;
}

// ------------------------------------------------------------ selection helpers

/** How attractive a nearby option is: its score, discounted by the detour. */
function appeal(entry: { candidate: Candidate; km: number }): number {
  return (entry.candidate.score?.total ?? 0) - entry.km * 1.5;
}

/** Nearest good option to the anchor, within a short hop. */
function pickNearest(
  pool: Candidate[],
  anchor: Candidate,
  ctx: PlanningContext,
  maxKm: number,
  exclude: Array<Candidate | null> = []
): Candidate | null {
  const excluded = new Set(
    exclude.filter((c): c is Candidate => c !== null).map((c) => c.provider_place_id)
  );

  const nearby = pool
    .filter((c) => !excluded.has(c.provider_place_id))
    .map((c) => ({
      candidate: c,
      km: haversineKm({ lat: anchor.lat, lng: anchor.lng }, { lat: c.lat, lng: c.lng }),
    }))
    .filter(({ km }) => km <= maxKm)
    // Score dominates, proximity breaks ties: a slightly further place that
    // suits them beats a closer one that does not.
    .sort((a, b) => appeal(b) - appeal(a));

  const best = nearby[0]?.candidate ?? null;
  if (!best) return null;

  // A food stop the household cannot afford makes the whole day unaffordable.
  const heads = chargeableHeads(ctx);
  if (best.cost && best.cost.min * heads > ctx.derived.effectiveBudgetMax * 0.7) {
    return nearby.slice(1).find(({ candidate }) => {
      const c = candidate.cost;
      return !c || c.min * heads <= ctx.derived.effectiveBudgetMax * 0.5;
    })?.candidate ?? null;
  }
  return best;
}

/** A small extra, only when there is genuinely room for it. */
function pickAddon(
  pool: Candidate[],
  anchor: Candidate,
  ctx: PlanningContext,
  exclude: Array<Candidate | null>
): Candidate | null {
  // Short days do not get an add-on; that is what makes them short.
  if (ctx.derived.effectiveTimeMinutes < 240) return null;
  if (ctx.checkin?.energy === "LOW") return null;

  return pickNearest(pool, anchor, ctx, 4, exclude);
}

function chooseArchetype(
  anchor: Candidate,
  food: Candidate | null,
  addon: Candidate | null
): Archetype {
  const has = (id: string) => anchor.categories.includes(id);

  if (has("beaches") || has("swimming")) {
    return addon?.categories.includes("bakeries") ? "SWIM_BAKERY_PARK" : "BEACH_AND_LUNCH";
  }
  if (has("markets")) return "MARKET_AND_NEIGHBOURHOOD";
  if (has("ferries")) return "FERRY_PARK_FOOD";
  if (has("gardens")) return "GARDEN_AND_CAFE";
  if (has("workshops")) return "WORKSHOP_AND_NEIGHBOURHOOD";
  if (has("museums") || has("galleries") || has("culture")) return "INDOOR_AND_FOOD";
  if (has("bushwalks")) return "WALK_AND_PUB";
  if (has("day_trips") || has("scenic_drives")) return "DRIVE_WALK_FOOD";
  if (food) return "WALK_AND_FOOD";
  return "WALK_AND_FOOD";
}

/**
 * Sequence the day. The rules are about how a Saturday actually works: coffee
 * and bakeries come first, the anchor next while everyone is fresh, lunch
 * after it, and a low-effort add-on last.
 */
function orderComponents(
  anchor: Candidate,
  food: Candidate | null,
  addon: Candidate | null,
  archetype: Archetype
): Candidate[] {
  const ordered: Candidate[] = [];

  const addonIsEarly =
    addon !== null &&
    (addon.categories.includes("bakeries") || addon.categories.includes("coffee"));

  if (addonIsEarly && addon) ordered.push(addon);
  ordered.push(anchor);
  if (food) ordered.push(food);
  if (addon && !addonIsEarly) {
    // A market after lunch is browsing; a market before lunch is the morning.
    if (archetype === "MARKET_AND_NEIGHBOURHOOD") ordered.splice(1, 0, addon);
    else ordered.push(addon);
  }

  return ordered;
}

// ------------------------------------------------------------ arithmetic

function estimateLeg(from: { lat: number; lng: number }, to: Candidate, mode: TransportMode): number {
  const km = haversineKm(from, { lat: to.lat, lng: to.lng });
  // Short hops between stops are usually walked whatever the day's main mode.
  const legMode: TransportMode = km < 1.2 ? "WALKING" : mode;
  return Math.max(5, Math.round(optimisticMinutes(km, legMode) * 1.25));
}

function estimateLegToHome(
  from: { lat: number; lng: number },
  ctx: PlanningContext,
  mode: TransportMode
): number {
  const km = haversineKm(from, ctx.home);
  return Math.max(5, Math.round(optimisticMinutes(km, mode) * 1.25));
}

function transportCostFor(items: BundleItem[], ctx: PlanningContext): number {
  const modes = new Set(items.map((i) => i.travel_mode).filter(Boolean));
  if (modes.has("DRIVING")) {
    const km = items
      .filter((i) => i.travel_mode === "DRIVING")
      .reduce((sum, i) => sum + (i.travel_minutes ?? 0) * 0.6, 0); // ~36 km/h average
    return (km / 10) * COST_CONFIG.driving_cost_per_10km;
  }
  if (modes.has("TRANSIT")) {
    return COST_CONFIG.transit_cost_per_adult * ctx.derived.adults;
  }
  return 0;
}

function activityLevelFor(walkKm: number, components: Candidate[]): ActivityLevel {
  const intensities = components.flatMap((c) =>
    c.categories.map((id) => category(id)?.intensity ?? "EASY")
  );
  const hasActive = intensities.includes("ACTIVE");
  const hasModerate = intensities.includes("MODERATE");

  if (walkKm >= 9 || hasActive) return "ACTIVE";
  if (walkKm >= 5 || hasModerate) return "MODERATE";
  if (walkKm >= 2) return "EASY";
  return "GENTLE";
}

function itemTypeFor(candidate: Candidate): PlanItemType {
  if (candidate.categories.some((id) => ["food", "bakeries", "coffee"].includes(id))) return "FOOD";
  if (candidate.categories.some((id) => ["easy_walks", "bushwalks"].includes(id))) return "WALK";
  if (candidate.public_space) return "ACTIVITY";
  return "VENUE";
}

function canAnchor(candidate: Candidate): boolean {
  return candidate.categories.some((id) => category(id)?.can_anchor);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
