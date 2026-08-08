/**
 * Stage 3 — candidate retrieval (§14).
 *
 * Broad retrieval against the PlaceProvider, then progressive enrichment. The
 * shape matters for cost (§44): searching is cheap per result, details and
 * routing are not, so we search wide, prune hard on free arithmetic, and only
 * then pay for the facts we need on survivors.
 *
 *   search (many)  →  straight-line prune (free)  →  route (paid)
 *                  →  details for shortlist only (paid)
 *
 * Doing it in the other order is the single easiest way to make this product
 * uneconomic.
 */

import { COST_CONFIG, GENERATION_CONFIG } from "@/config/planner";
import { category, type CategoryId } from "@/config/taxonomy";
import type { PlaceProvider } from "@/lib/providers/places/provider";
import type { RouteProvider } from "@/lib/providers/routes/provider";
import type { SearchIntent } from "@/lib/ai/schemas";
import type { TransportMode } from "@/lib/types";
import { haversineKm, optimisticMinutes } from "@/lib/util/geo";
import { instantFromLocal } from "@/lib/util/time";
import type { Candidate, PlanningContext } from "./types";

export interface RetrievalResult {
  candidates: Candidate[];
  /** Intents that returned nothing, for the admin inspector. */
  emptyIntents: string[];
}

export async function retrieveCandidates(
  ctx: PlanningContext,
  intents: SearchIntent[],
  places: PlaceProvider,
  routes: RouteProvider
): Promise<RetrievalResult> {
  const byPlaceId = new Map<string, Candidate>();
  const emptyIntents: string[] = [];

  // Search radius is generous: the straight-line prune below is what actually
  // enforces the travel budget, and a radius that is too tight silently
  // excludes the good stuff just over the boundary.
  const radiusMetres = radiusFor(ctx);

  for (const intent of intents) {
    const results = await places.searchPlaces({
      query: intent.query,
      centre: ctx.home,
      radius_metres: radiusMetres,
      categories: intent.categories.filter((c): c is CategoryId => Boolean(category(c))),
      open_on: ctx.weekendDate,
      max_results: GENERATION_CONFIG.candidates_per_intent,
    });

    if (results.length === 0) {
      emptyIntents.push(intent.query);
      continue;
    }

    for (const result of results) {
      const existing = byPlaceId.get(result.provider_place_id);
      if (existing) {
        // The same place can answer two intents. Keep the anchor role, since a
        // beach that also turned up in a food search is still a beach.
        if (existing.role !== "ANCHOR" && intent.role === "ANCHOR") existing.role = "ANCHOR";
        continue;
      }

      const categories = result.categories.length > 0 ? result.categories : intent.categories;
      byPlaceId.set(result.provider_place_id, {
        candidate_id: `c_${byPlaceId.size + 1}`,
        provider: places.name,
        provider_place_id: result.provider_place_id,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        categories: categories.filter((c): c is CategoryId => Boolean(category(c))),
        role: intent.role,
        price_level: result.price_level,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        busyness: result.busyness,
        public_space: inferPublicSpace(categories),
        travel: null,
        openingHours: null,
        businessStatus: result.business_status,
        address: null,
        website: null,
        mapsUrl: null,
        bookingRequired: false,
        cost: null,
        durationMinutes: defaultDuration(categories),
        walkKm: defaultWalkKm(categories),
        score: null,
        rejection: null,
      });
    }
  }

  const candidates = [...byPlaceId.values()];
  const reachable = pruneByStraightLine(candidates, ctx);
  await attachRoutes(reachable, ctx, routes);

  return { candidates: reachable, emptyIntents };
}

/**
 * Free prune before any paid routing call. Uses the most optimistic mode the
 * household has available, so we never discard something the real router would
 * have said was reachable.
 */
function pruneByStraightLine(candidates: Candidate[], ctx: PlanningContext): Candidate[] {
  const budget = ctx.derived.effectiveTravelMinutes;
  // "Surprise me occasionally" earns a stretch, but only for anchors — a café
  // 80 minutes away is not a surprise, it is a mistake.
  const stretch = ctx.preferences.allow_occasional_further ? 1.35 : 1.15;

  return candidates.filter((c) => {
    const km = haversineKm(ctx.home, { lat: c.lat, lng: c.lng });
    const best = Math.min(
      ...ctx.derived.transportModes.map((mode) => optimisticMinutes(km, mode))
    );
    const allowance = c.role === "ANCHOR" ? budget * stretch : budget;
    if (best > allowance) {
      c.rejection = {
        rule: "travel_radius_prefilter",
        detail: `~${Math.round(best)} min exceeds ${Math.round(allowance)} min allowance`,
      };
      return false;
    }
    return true;
  });
}

/**
 * Real travel times for the survivors. One call per candidate per preferred
 * mode is affordable at this stage because the prune has already removed the
 * majority; ordering it the other way round would multiply cost by roughly
 * the search fan-out.
 */
async function attachRoutes(
  candidates: Candidate[],
  ctx: PlanningContext,
  routes: RouteProvider
): Promise<void> {
  const departAt = instantFromLocal(
    ctx.weekendDate,
    ctx.derived.departureTime,
    ctx.market.timezone
  );

  const usableModes = ctx.derived.transportModes.filter((m) =>
    routes.supportedModes().includes(m)
  );
  const modes: TransportMode[] = usableModes.length > 0 ? usableModes : ["TRANSIT"];

  await Promise.all(
    candidates.map(async (candidate) => {
      const destination = { lat: candidate.lat, lng: candidate.lng };

      const results = await Promise.all(
        modes.map((mode) =>
          routes.getTravelTime({ origin: ctx.home, destination, mode, depart_at: departAt })
        )
      );

      const feasible = results
        .filter((r): r is NonNullable<typeof r> => Boolean(r?.feasible))
        .sort((a, b) => a.duration_minutes - b.duration_minutes);

      const best = feasible[0];
      if (!best) {
        candidate.rejection = {
          rule: "no_feasible_route",
          detail: `No route by ${modes.join("/")} at ${ctx.derived.departureTime}`,
        };
        return;
      }

      candidate.travel = {
        mode: best.mode,
        minutes: Math.round(best.duration_minutes),
        distance_km: best.distance_km,
        summary: best.summary,
      };
    })
  );
}

/**
 * Fetch details for the shortlist only. Called after scoring, so we pay for
 * opening hours and prices on the dozen candidates that might actually appear
 * in a plan rather than on the hundred that will not.
 */
export async function enrichShortlist(
  candidates: Candidate[],
  places: PlaceProvider,
  currency: string
): Promise<void> {
  await Promise.all(
    candidates.map(async (candidate) => {
      const details = await places.getPlaceDetails(candidate.provider_place_id);
      if (!details) {
        candidate.rejection = { rule: "details_unavailable", detail: "Provider returned nothing" };
        return;
      }

      candidate.name = details.name || candidate.name;
      candidate.lat = details.lat || candidate.lat;
      candidate.lng = details.lng || candidate.lng;
      candidate.address = details.formatted_address;
      candidate.openingHours = details.opening_hours;
      candidate.businessStatus = details.business_status;
      candidate.website = details.website;
      candidate.mapsUrl = details.maps_url;
      candidate.price_level = details.price_level ?? candidate.price_level;

      candidate.cost = await resolveCost(candidate, places, currency);
    })
  );
}

/**
 * Cost resolution (§22). An exact figure only when a trusted source gives one;
 * otherwise the price-level band, clearly flagged as uncertain so the scorer
 * can penalise it and the interface can label it "estimated". We never invent
 * a number, and `certain: false` is carried all the way to the plan item.
 */
async function resolveCost(
  candidate: Candidate,
  places: PlaceProvider,
  currency: string
): Promise<Candidate["cost"]> {
  if (candidate.public_space) return { min: 0, max: 0, certain: true };

  const info = await places.getPriceInfo(candidate.provider_place_id);

  if (info?.exact !== null && info?.exact !== undefined) {
    // Only trust an exact price in the currency we are quoting.
    if (!info.currency || info.currency === currency) {
      return { min: info.exact, max: info.exact, certain: true };
    }
  }

  const level = info?.price_level ?? candidate.price_level;
  if (level === null || level === undefined) return null;

  const band = COST_CONFIG.price_level_bands[level];
  if (!band) return null;
  return { min: band.min, max: band.max, certain: false };
}

// ------------------------------------------------------------ heuristics

function radiusFor(ctx: PlanningContext): number {
  // Assume the fastest plausible mode when sizing the search circle; the
  // prune enforces the real budget afterwards.
  const fastestKmh = ctx.derived.transportModes.includes("DRIVING") ? 60 : 30;
  const km = (ctx.derived.effectiveTravelMinutes / 60) * fastestKmh;
  return Math.min(50_000, Math.max(5_000, Math.round(km * 1000)));
}

/** Public spaces are free, always open, and verified by different rules (§20). */
function inferPublicSpace(categories: string[]): boolean {
  const publicish = new Set([
    "beaches",
    "waterfront",
    "gardens",
    "playgrounds",
    "easy_walks",
    "bushwalks",
    "picnics",
    "neighbourhoods",
    "architecture",
  ]);
  return categories.length > 0 && categories.every((c) => publicish.has(c));
}

/** How long people actually spend somewhere. Used to build the timeline. */
function defaultDuration(categories: string[]): number {
  const durations: Record<string, number> = {
    beaches: 90,
    swimming: 75,
    waterfront: 60,
    easy_walks: 70,
    bushwalks: 110,
    gardens: 60,
    markets: 60,
    museums: 90,
    galleries: 75,
    culture: 75,
    animals: 150,
    playgrounds: 45,
    food: 70,
    bakeries: 25,
    coffee: 30,
    neighbourhoods: 60,
    workshops: 120,
    vintage: 45,
    history: 60,
    unusual: 75,
    day_trips: 180,
    cycling: 90,
    wellness: 90,
    live_music: 90,
    sport: 120,
    picnics: 60,
    ferries: 30,
    trains: 40,
    scenic_drives: 45,
    architecture: 45,
  };
  const values = categories.map((c) => durations[c]).filter((v): v is number => v !== undefined);
  return values.length > 0 ? Math.max(...values) : 60;
}

/** Walking the activity itself involves, before travel is added. */
function defaultWalkKm(categories: string[]): number {
  const walks: Record<string, number> = {
    easy_walks: 4,
    bushwalks: 6.5,
    waterfront: 3,
    beaches: 1,
    gardens: 1.5,
    neighbourhoods: 2,
    markets: 1,
    architecture: 2.5,
    history: 1.5,
    cycling: 0,
  };
  const values = categories.map((c) => walks[c]).filter((v): v is number => v !== undefined);
  return values.length > 0 ? Math.max(...values) : 0.4;
}
