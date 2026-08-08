/**
 * Mock PlaceProvider backed by the Sydney fixtures.
 *
 * Used for local development and in CI, where no paid provider request is
 * permitted (§48). It is a real implementation of the interface — matching,
 * radius filtering, opening hours, permanently-closed venues and unknown
 * hours all behave as the live adapter would — so the planner is genuinely
 * exercised rather than stubbed around.
 */

import type { OpeningHours, PlaceDetails } from "@/lib/types";
import { haversineKm, type LatLng } from "@/lib/util/geo";
import { SYDNEY_FIXTURES, SYDNEY_FIXTURES_BY_ID, type FixturePlace } from "./fixtures/sydney";
import type {
  PlaceProvider,
  PlaceSearchRequest,
  PlaceSearchResult,
  PriceInfo,
} from "./provider";

const ALWAYS_OPEN: OpeningHours = {
  periods: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ open: "00:00", close: "23:59" }]])),
  permanently_closed: false,
  unknown: false,
};

export class MockPlaceProvider implements PlaceProvider {
  readonly name = "mock_places";

  /** Call counter, so tests can assert we are not making redundant requests. */
  public calls = { search: 0, details: 0, hours: 0, price: 0 };

  constructor(private readonly fixtures: readonly FixturePlace[] = SYDNEY_FIXTURES) {}

  async searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult[]> {
    this.calls.search++;

    const terms = tokenise(request.query);
    const wanted = new Set(request.categories ?? []);

    const scored = this.fixtures
      .map((place) => {
        const distanceKm = haversineKm(request.centre, { lat: place.lat, lng: place.lng });
        if (distanceKm * 1000 > request.radius_metres) return null;
        if (request.min_rating && place.rating < request.min_rating) return null;

        // Relevance: keyword overlap plus a bonus when the caller asked for a
        // category this place actually is. Mirrors how a text search behaves
        // closely enough that intent phrasing matters, as it does in production.
        const haystack = tokenise(
          `${place.name} ${place.keywords.join(" ")} ${place.categories.join(" ")}`
        );
        let relevance = [...terms].filter((t) => haystack.has(t)).length;
        if (wanted.size > 0 && place.categories.some((c) => wanted.has(c))) relevance += 2;
        if (relevance === 0) return null;

        // Nearer and better-rated wins ties, as a real ranker would.
        const score = relevance * 10 - distanceKm * 0.15 + place.rating;
        return { place, score };
      })
      .filter((x): x is { place: FixturePlace; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, request.max_results ?? 12);

    return scored.map(({ place }) => ({
      provider_place_id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      categories: [...place.categories],
      price_level: place.price_level,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      business_status: place.hours?.permanently_closed ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
      busyness: place.busyness,
    }));
  }

  async getPlaceDetails(providerPlaceId: string): Promise<PlaceDetails | null> {
    this.calls.details++;
    const place = SYDNEY_FIXTURES_BY_ID.get(providerPlaceId);
    if (!place) return null;

    return {
      provider_place_id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      formatted_address: place.address,
      opening_hours: this.hoursFor(place),
      price_level: place.price_level,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      business_status: place.hours?.permanently_closed ? "CLOSED_PERMANENTLY" : "OPERATIONAL",
      website: place.website ?? null,
      maps_url: this.buildMapsLink({
        providerPlaceId: place.id,
        lat: place.lat,
        lng: place.lng,
        name: place.name,
      }),
      types: [...place.categories],
      fetched_at: new Date().toISOString(),
    };
  }

  async getOpeningHours(providerPlaceId: string): Promise<OpeningHours> {
    this.calls.hours++;
    const place = SYDNEY_FIXTURES_BY_ID.get(providerPlaceId);
    if (!place) return { periods: {}, permanently_closed: false, unknown: true };
    return this.hoursFor(place);
  }

  async getPlaceCoordinates(providerPlaceId: string): Promise<LatLng | null> {
    const place = SYDNEY_FIXTURES_BY_ID.get(providerPlaceId);
    return place ? { lat: place.lat, lng: place.lng } : null;
  }

  async getPriceInfo(providerPlaceId: string): Promise<PriceInfo | null> {
    this.calls.price++;
    const place = SYDNEY_FIXTURES_BY_ID.get(providerPlaceId);
    if (!place) return null;
    return {
      // The fixture's price hint stands in for a trusted published price —
      // the only circumstance in which we ever quote an exact figure (§22).
      exact: place.price_hint && place.price_hint.min === place.price_hint.max
        ? place.price_hint.min
        : null,
      price_level: place.price_level,
      currency: "AUD",
      source: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  buildMapsLink(input: { providerPlaceId?: string; lat: number; lng: number; name: string }): string {
    const params = new URLSearchParams({ api: "1", query: `${input.lat},${input.lng}` });
    if (input.providerPlaceId) params.set("query_place_id", input.providerPlaceId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  private hoursFor(place: FixturePlace): OpeningHours {
    if (place.hours) return place.hours;
    // Public spaces have no hours in the provider sense; the verifier applies
    // a different rule to them (§20) rather than treating this as unknown.
    return place.public_space ? ALWAYS_OPEN : { periods: {}, permanently_closed: false, unknown: true };
  }
}

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}
