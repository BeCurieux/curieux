/**
 * Google Places adapter (§12).
 *
 * Compliance notes, because they constrain the code rather than merely
 * decorating it:
 *  - We persist `provider_place_id` and our own derived data. Descriptions,
 *    reviews and photos are not written to our database.
 *  - Presentational detail is fetched at verification/render time and treated
 *    as ephemeral.
 *  - Map links are built with Google's documented URL scheme, not scraped.
 *
 * Field masks are explicit on every call: the new Places API bills by field,
 * so an over-broad mask is a direct cost increase per generated plan (§44).
 */

import type { CategoryId, OpeningHours, PlaceDetails } from "@/lib/types";
import type { LatLng } from "@/lib/util/geo";
import type {
  PlaceProvider,
  PlaceSearchRequest,
  PlaceSearchResult,
  PriceInfo,
  ProviderTariff,
} from "./provider";

const BASE = "https://places.googleapis.com/v1";

const SEARCH_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
].join(",");

const DETAILS_MASK = [
  "id",
  "displayName",
  "location",
  "formattedAddress",
  "regularOpeningHours",
  "priceLevel",
  "rating",
  "userRatingCount",
  "businessStatus",
  "websiteUri",
  "googleMapsUri",
  "types",
].join(",");

/** Google place types → our taxonomy. Unmapped types are simply ignored. */
const TYPE_MAP: Record<string, CategoryId> = {
  beach: "beaches",
  park: "gardens",
  national_park: "bushwalks",
  hiking_area: "bushwalks",
  botanical_garden: "gardens",
  garden: "gardens",
  museum: "museums",
  art_gallery: "galleries",
  performing_arts_theater: "culture",
  cultural_center: "culture",
  zoo: "animals",
  aquarium: "animals",
  wildlife_park: "animals",
  playground: "playgrounds",
  swimming_pool: "swimming",
  public_bath: "swimming",
  market: "markets",
  farmers_market: "markets",
  bakery: "bakeries",
  cafe: "coffee",
  coffee_shop: "coffee",
  restaurant: "food",
  ferry_terminal: "ferries",
  train_station: "trains",
  historical_landmark: "history",
  historical_place: "history",
  monument: "history",
  tourist_attraction: "unusual",
  observation_deck: "architecture",
  spa: "wellness",
  yoga_studio: "wellness",
  stadium: "sport",
  antique_store: "vintage",
  thrift_store: "vintage",
};

export const GOOGLE_PLACES_TARIFF: ProviderTariff = {
  // Approximate US cents per request under the Places API (New) SKUs. Kept
  // here so the founder dashboard's cost-per-plan figure is grounded in
  // something rather than being decorative.
  searchPlaces: 3.2,
  getPlaceDetails: 1.7,
  getOpeningHours: 1.7,
  getPriceInfo: 1.7,
};

export class GooglePlaceProvider implements PlaceProvider {
  readonly name = "google_places";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult[]> {
    const body = {
      textQuery: request.query,
      maxResultCount: Math.min(request.max_results ?? 12, 20),
      locationBias: {
        circle: {
          center: { latitude: request.centre.lat, longitude: request.centre.lng },
          radius: Math.min(request.radius_metres, 50_000),
        },
      },
      ...(request.min_rating ? { minRating: request.min_rating } : {}),
    };

    const response = await this.post("/places:searchText", SEARCH_MASK, body);
    if (!response) return [];

    const places = (response as { places?: unknown[] }).places ?? [];
    return places.map((raw) => this.toSearchResult(raw as GooglePlace));
  }

  async getPlaceDetails(providerPlaceId: string): Promise<PlaceDetails | null> {
    const raw = await this.get(`/places/${encodeURIComponent(providerPlaceId)}`, DETAILS_MASK);
    if (!raw) return null;
    const place = raw as GooglePlace;

    return {
      provider_place_id: place.id,
      name: place.displayName?.text ?? "",
      lat: place.location?.latitude ?? 0,
      lng: place.location?.longitude ?? 0,
      formatted_address: place.formattedAddress ?? null,
      opening_hours: parseOpeningHours(place),
      price_level: priceLevelToNumber(place.priceLevel),
      rating: place.rating ?? null,
      user_ratings_total: place.userRatingCount ?? null,
      business_status: normaliseStatus(place.businessStatus),
      website: place.websiteUri ?? null,
      maps_url:
        place.googleMapsUri ??
        this.buildMapsLink({
          providerPlaceId: place.id,
          lat: place.location?.latitude ?? 0,
          lng: place.location?.longitude ?? 0,
          name: place.displayName?.text ?? "",
        }),
      types: place.types ?? [],
      fetched_at: new Date().toISOString(),
    };
  }

  async getOpeningHours(providerPlaceId: string): Promise<OpeningHours> {
    const raw = await this.get(
      `/places/${encodeURIComponent(providerPlaceId)}`,
      "regularOpeningHours,businessStatus"
    );
    if (!raw) return { periods: {}, permanently_closed: false, unknown: true };
    return parseOpeningHours(raw as GooglePlace);
  }

  async getPlaceCoordinates(providerPlaceId: string): Promise<LatLng | null> {
    const raw = await this.get(`/places/${encodeURIComponent(providerPlaceId)}`, "location");
    const location = (raw as GooglePlace | null)?.location;
    if (!location) return null;
    return { lat: location.latitude, lng: location.longitude };
  }

  async getPriceInfo(providerPlaceId: string): Promise<PriceInfo | null> {
    const raw = await this.get(`/places/${encodeURIComponent(providerPlaceId)}`, "priceLevel");
    if (!raw) return null;
    const level = priceLevelToNumber((raw as GooglePlace).priceLevel);
    if (level === null) return null;
    // Google gives a band, never a number. We quote a band and label it
    // "estimated" (§22); we never convert this into a fake exact price.
    return {
      exact: null,
      price_level: level,
      currency: null,
      source: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  buildMapsLink(input: {
    providerPlaceId?: string;
    lat: number;
    lng: number;
    name: string;
  }): string {
    const params = new URLSearchParams({ api: "1", query: `${input.lat},${input.lng}` });
    if (input.providerPlaceId) params.set("query_place_id", input.providerPlaceId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  // ------------------------------------------------------------- internals

  private toSearchResult(place: GooglePlace): PlaceSearchResult {
    const ratingCount = place.userRatingCount ?? 0;
    return {
      provider_place_id: place.id,
      name: place.displayName?.text ?? "",
      lat: place.location?.latitude ?? 0,
      lng: place.location?.longitude ?? 0,
      categories: mapTypes(place.types ?? []),
      price_level: priceLevelToNumber(place.priceLevel),
      rating: place.rating ?? null,
      user_ratings_total: place.userRatingCount ?? null,
      business_status: normaliseStatus(place.businessStatus),
      // Rating volume is the only crowd proxy the API gives us. Log-scaled so
      // that 100 reviews and 10,000 reviews are not treated as equivalent.
      busyness: ratingCount > 0 ? Math.min(1, Math.log10(ratingCount + 1) / 4.5) : null,
    };
  }

  private async post(path: string, mask: string, body: unknown): Promise<unknown | null> {
    const response = await this.fetchImpl(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": mask,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return response.json();
  }

  private async get(path: string, mask: string): Promise<unknown | null> {
    const response = await this.fetchImpl(`${BASE}${path}`, {
      headers: { "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": mask },
    });
    if (!response.ok) return null;
    return response.json();
  }
}

// ------------------------------------------------------------- raw shapes

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  regularOpeningHours?: {
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
}

export function mapTypes(types: string[]): CategoryId[] {
  const mapped = types.map((t) => TYPE_MAP[t]).filter((c): c is CategoryId => Boolean(c));
  return Array.from(new Set(mapped));
}

function priceLevelToNumber(level: string | undefined): number | null {
  switch (level) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return null;
  }
}

function normaliseStatus(status: string | undefined): PlaceDetails["business_status"] {
  switch (status) {
    case "OPERATIONAL":
      return "OPERATIONAL";
    case "CLOSED_TEMPORARILY":
      return "CLOSED_TEMPORARILY";
    case "CLOSED_PERMANENTLY":
      return "CLOSED_PERMANENTLY";
    default:
      return "UNKNOWN";
  }
}

/**
 * Google reports periods with day 0 = Sunday; we use ISO weekdays (1 = Monday,
 * 7 = Sunday). An absent `regularOpeningHours` means "we do not know", which
 * the verifier treats very differently from "closed".
 */
export function parseOpeningHours(place: GooglePlace): OpeningHours {
  if (place.businessStatus === "CLOSED_PERMANENTLY") {
    return { periods: {}, permanently_closed: true, unknown: false };
  }
  const raw = place.regularOpeningHours?.periods;
  if (!raw || raw.length === 0) {
    return { periods: {}, permanently_closed: false, unknown: true };
  }

  const periods: OpeningHours["periods"] = {};
  for (const period of raw) {
    if (!period.open) continue;
    const isoDay = period.open.day === 0 ? 7 : period.open.day;
    const open = `${pad(period.open.hour)}:${pad(period.open.minute)}`;
    // A missing close means open 24 hours on that day.
    const close = period.close
      ? `${pad(period.close.hour)}:${pad(period.close.minute)}`
      : "23:59";
    (periods[isoDay] ??= []).push({ open, close });
  }
  return { periods, permanently_closed: false, unknown: false };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
