/**
 * Candidate factory for planner tests.
 *
 * Defaults describe an ordinary, entirely reasonable place: nearby, free,
 * open, uncrowded. A test then makes exactly one thing wrong with it, which
 * keeps assertions honest about which rule fired.
 */

import type { CategoryId } from "@/config/taxonomy";
import type { OpeningHours, TransportMode } from "@/lib/types";
import type { Candidate } from "@/lib/planner/types";

let counter = 0;

export interface CandidateOverrides {
  name?: string;
  categories?: CategoryId[];
  role?: Candidate["role"];
  travelMinutes?: number;
  travelMode?: TransportMode;
  lat?: number;
  lng?: number;
  cost?: Candidate["cost"];
  openingHours?: OpeningHours | null;
  businessStatus?: Candidate["businessStatus"];
  busyness?: number | null;
  publicSpace?: boolean;
  walkKm?: number;
  durationMinutes?: number;
  bookingRequired?: boolean;
  website?: string | null;
  priceLevel?: number | null;
}

export function openAllWeekend(open = "09:00", close = "17:00"): OpeningHours {
  return {
    periods: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ open, close }]])),
    permanently_closed: false,
    unknown: false,
  };
}

export const UNKNOWN_HOURS: OpeningHours = {
  periods: {},
  permanently_closed: false,
  unknown: true,
};

export function candidate(overrides: CandidateOverrides = {}): Candidate {
  counter += 1;
  const categories = overrides.categories ?? ["easy_walks"];
  const publicSpace = overrides.publicSpace ?? true;

  return {
    candidate_id: `c_${counter}`,
    provider: "test",
    provider_place_id: `place_${counter}`,
    name: overrides.name ?? `Test place ${counter}`,
    lat: overrides.lat ?? -33.89,
    lng: overrides.lng ?? 151.2,
    categories,
    role: overrides.role ?? "ANCHOR",
    price_level: overrides.priceLevel ?? 0,
    rating: 4.5,
    user_ratings_total: 500,
    busyness: overrides.busyness ?? 0.3,
    public_space: publicSpace,
    travel: {
      mode: overrides.travelMode ?? "DRIVING",
      minutes: overrides.travelMinutes ?? 20,
      distance_km: 8,
      summary: "8 km by car",
    },
    openingHours:
      overrides.openingHours === undefined
        ? publicSpace
          ? openAllWeekend("00:00", "23:59")
          : openAllWeekend()
        : overrides.openingHours,
    businessStatus: overrides.businessStatus ?? "OPERATIONAL",
    address: "1 Test Street",
    website: overrides.website ?? null,
    mapsUrl: "https://maps.example/test",
    bookingRequired: overrides.bookingRequired ?? false,
    // `??` would be wrong here: a test passing `cost: null` means "we have no
    // price for this", which is exactly the case the price filter is about.
    cost: overrides.cost === undefined ? { min: 0, max: 0, certain: true } : overrides.cost,
    durationMinutes: overrides.durationMinutes ?? 75,
    walkKm: overrides.walkKm ?? 1,
    score: null,
    rejection: null,
  };
}

/** Reset ids so a test asserting on candidate_id is stable. */
export function resetCandidateCounter(): void {
  counter = 0;
}
