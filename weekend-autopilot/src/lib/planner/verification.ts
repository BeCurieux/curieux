/**
 * Stage 7 — factual verification (§20).
 *
 * The most important subsystem in the product. Everything upstream is
 * judgement; this is the part that decides whether we are allowed to tell a
 * paying customer that a place exists, is open, and can be reached in time.
 *
 * Principles:
 *  - Re-fetch rather than trust. Candidate data may be hours old; a plan is
 *    verified against a fresh read (§20, max_place_data_age_hours).
 *  - Distinguish three states. VERIFIED, UNCERTAIN and FAILED are different
 *    things, and collapsing "we don't know" into "it's fine" is how a family
 *    drives forty minutes to a closed door.
 *  - Weight by importance. A closed anchor kills the plan. A closed optional
 *    coffee stop does not.
 *  - Public spaces are verified differently. A beach does not have opening
 *    hours, and demanding them would reject the best free plans we make.
 *
 * A plan that fails here is never "fixed up" — it is regenerated from the next
 * ranked candidates (§13).
 */

import { VERIFICATION_CONFIG } from "@/config/planner";
import type { OpeningHours, VerificationStatus } from "@/lib/types";
import type { PlaceProvider } from "@/lib/providers/places/provider";
import type { RouteProvider } from "@/lib/providers/routes/provider";
import { haversineKm } from "@/lib/util/geo";
import { instantFromLocal, isoWeekday, toMinutes } from "@/lib/util/time";
import type { Bundle, BundleVerification, PlanningContext } from "./types";

/** Importance weights for the verification score. Anchors dominate. */
const ITEM_WEIGHT = { critical: 3, normal: 1 } as const;

export async function verifyBundle(
  bundle: Bundle,
  ctx: PlanningContext,
  places: PlaceProvider,
  routes: RouteProvider
): Promise<BundleVerification> {
  const results: BundleVerification["items"] = [];
  const failures: string[] = [];

  for (const item of bundle.items) {
    const candidate = item.candidate;
    if (!candidate) continue;

    const outcome = await verifyItem(item.sequence, candidate, item, ctx, places);
    results.push(outcome);

    if (outcome.status === "FAILED") {
      failures.push(`${candidate.name}: ${outcome.notes ?? "verification failed"}`);
    }
  }

  // Route feasibility for the day as a whole, re-checked against the real
  // departure time rather than the one we used during retrieval.
  const routeCheck = await verifyRoute(bundle, ctx, routes);
  if (routeCheck) {
    results.push(routeCheck);
    if (routeCheck.status === "FAILED") failures.push(routeCheck.notes ?? "route infeasible");
  }

  const score = weightedScore(results);
  const criticalFailed = results.some((r) => r.critical && r.status === "FAILED");

  const passed =
    score >= VERIFICATION_CONFIG.min_verification_score &&
    !(VERIFICATION_CONFIG.critical_item_must_pass && criticalFailed);

  return { score, passed, items: results, failures };
}

async function verifyItem(
  sequence: number,
  candidate: NonNullable<Bundle["items"][number]["candidate"]>,
  item: Bundle["items"][number],
  ctx: PlanningContext,
  places: PlaceProvider
): Promise<BundleVerification["items"][number]> {
  const critical = item.is_critical;
  const fail = (notes: string) => ({ sequence, status: "FAILED" as VerificationStatus, notes, critical });
  const uncertain = (notes: string) => ({
    sequence,
    status: "UNCERTAIN" as VerificationStatus,
    notes,
    critical,
  });

  // Public spaces: existence and location, not hours (§20).
  if (candidate.public_space) {
    const coords = await places.getPlaceCoordinates(candidate.provider_place_id);
    if (!coords) return uncertain("Public space; coordinates could not be re-confirmed");
    if (haversineKm(coords, { lat: candidate.lat, lng: candidate.lng }) > 1) {
      return fail("Coordinates moved materially since retrieval");
    }
    return { sequence, status: "VERIFIED", notes: null, critical };
  }

  // Commercial venues: a fresh read of everything we are about to assert.
  const details = await places.getPlaceDetails(candidate.provider_place_id);
  if (!details) return fail("Venue could not be re-confirmed with the provider");

  if (details.business_status === "CLOSED_PERMANENTLY") return fail("Permanently closed");
  if (details.business_status === "CLOSED_TEMPORARILY") return fail("Temporarily closed");

  if (haversineKm({ lat: details.lat, lng: details.lng }, { lat: candidate.lat, lng: candidate.lng }) > 1) {
    return fail("Coordinates disagree with those used to build the plan");
  }

  // Keep the plan honest by adopting the fresh values before delivery.
  candidate.name = details.name || candidate.name;
  candidate.address = details.formatted_address;
  candidate.mapsUrl = details.maps_url;
  candidate.openingHours = details.opening_hours;

  const staleness = ageHours(details.fetched_at);
  if (staleness > VERIFICATION_CONFIG.max_place_data_age_hours) {
    return uncertain(`Provider data is ${Math.round(staleness)}h old`);
  }

  const openState = isOpenDuring(
    details.opening_hours,
    ctx.weekendDate,
    item.start_time,
    item.end_time
  );

  switch (openState) {
    case "OPEN":
      return { sequence, status: "VERIFIED", notes: null, critical };
    case "CLOSED":
      return fail(`Closed at ${item.start_time} on the target day`);
    case "UNKNOWN":
      // Not a failure. Plenty of good small venues publish no hours; we mark
      // it uncertain, the score absorbs it, and the copy says "check before
      // you go" rather than asserting something we cannot support (§53).
      return uncertain("Opening hours unavailable from the provider");
  }
}

/**
 * Re-check the main journey at the real departure time. Traffic and Saturday
 * timetables differ enough from the retrieval-time estimate that a plan can
 * become uncomfortable between building and delivery.
 */
async function verifyRoute(
  bundle: Bundle,
  ctx: PlanningContext,
  routes: RouteProvider
): Promise<BundleVerification["items"][number] | null> {
  const anchor = bundle.anchor;
  if (!anchor.travel) return null;

  const departAt = instantFromLocal(ctx.weekendDate, bundle.start_time, ctx.market.timezone);
  const fresh = await routes.getTravelTime({
    origin: ctx.home,
    destination: { lat: anchor.lat, lng: anchor.lng },
    mode: anchor.travel.mode,
    depart_at: departAt,
  });

  const sequence = -1; // the journey, not a stop

  if (!fresh || !fresh.feasible) {
    return {
      sequence,
      status: "FAILED",
      notes: `No feasible ${anchor.travel.mode.toLowerCase()} route at ${bundle.start_time}`,
      critical: true,
    };
  }

  const tolerance = anchor.travel.minutes * VERIFICATION_CONFIG.travel_time_tolerance;
  if (fresh.duration_minutes > tolerance) {
    return {
      sequence,
      status: "UNCERTAIN",
      notes: `Journey now ${Math.round(fresh.duration_minutes)} min against ${anchor.travel.minutes} min when planned`,
      critical: true,
    };
  }

  // Beyond the household's tolerance entirely is a failure, not a caveat.
  if (fresh.duration_minutes > ctx.derived.effectiveTravelMinutes * 1.2) {
    return {
      sequence,
      status: "FAILED",
      notes: `Journey of ${Math.round(fresh.duration_minutes)} min exceeds this household's limit`,
      critical: true,
    };
  }

  anchor.travel.minutes = Math.round(fresh.duration_minutes);
  anchor.travel.summary = fresh.summary;
  return { sequence, status: "VERIFIED", notes: null, critical: true };
}

/**
 * Is the venue open for the scheduled visit? A configurable buffer either side
 * means we do not send someone to arrive eight minutes before closing.
 */
export function isOpenDuring(
  hours: OpeningHours,
  isoDate: string,
  startTime: string,
  endTime: string
): "OPEN" | "CLOSED" | "UNKNOWN" {
  if (hours.permanently_closed) return "CLOSED";
  if (hours.unknown) return "UNKNOWN";

  const weekday = isoWeekday(isoDate);
  const periods = hours.periods[weekday];
  if (!periods || periods.length === 0) return "CLOSED";

  const buffer = VERIFICATION_CONFIG.opening_hours_buffer_minutes;
  const visitStart = toMinutes(startTime);
  const visitEnd = toMinutes(endTime);

  // The whole visit must sit inside one opening period, and finish a buffer
  // clear of closing time — arriving twenty minutes before the doors shut is
  // not the same as the place being open.
  const covered = periods.some((p) => {
    const open = toMinutes(p.open);
    const close = toMinutes(p.close);
    return visitStart >= open && visitEnd <= close - buffer;
  });

  return covered ? "OPEN" : "CLOSED";
}

function weightedScore(items: BundleVerification["items"]): number {
  if (items.length === 0) return 0;

  let earned = 0;
  let available = 0;
  for (const item of items) {
    const weight = item.critical ? ITEM_WEIGHT.critical : ITEM_WEIGHT.normal;
    available += weight;
    // Uncertainty earns partial credit: it is a real cost to confidence, but
    // not the same as being wrong.
    if (item.status === "VERIFIED") earned += weight;
    else if (item.status === "UNCERTAIN") earned += weight * 0.5;
  }

  return available > 0 ? Math.round((earned / available) * 100) / 100 : 0;
}

function ageHours(isoTimestamp: string): number {
  return (Date.now() - new Date(isoTimestamp).getTime()) / 3_600_000;
}
