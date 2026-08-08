/**
 * PlaceProvider interface (§12).
 *
 * The system is architected around this interface rather than around any one
 * vendor's database. Two consequences we hold to:
 *
 *  1. We do not build a copy of a provider's corpus. We persist the provider's
 *     place ID, our own category mapping, and the user's interaction history
 *     with that place. Descriptions, reviews and photos are fetched when
 *     needed and not warehoused.
 *  2. Everything returned here is a FACT with a timestamp. The model may
 *     reason about these facts; it may never substitute its own (§13).
 */

import type { PlaceDetails, OpeningHours, CategoryId } from "@/lib/types";
import type { LatLng } from "@/lib/util/geo";

export interface PlaceSearchRequest {
  /** Natural-language intent, e.g. "harbour beach with a kiosk". */
  query: string;
  centre: LatLng;
  radius_metres: number;
  /** Our taxonomy; the adapter maps to provider types. */
  categories?: CategoryId[];
  /** Only return places open on this ISO date, when the provider can say. */
  open_on?: string;
  max_results?: number;
  min_rating?: number;
}

export interface PlaceSearchResult {
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  /** Our categories, mapped from the provider's types by the adapter. */
  categories: CategoryId[];
  price_level: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  business_status: PlaceDetails["business_status"];
  /** 0–1 popularity proxy, used for crowd estimation. */
  busyness: number | null;
}

export interface PriceInfo {
  /** Exact prices only when a trusted source gives them (§22). */
  exact: number | null;
  price_level: number | null;
  currency: string | null;
  source: string;
  fetched_at: string;
}

export interface PlaceProvider {
  readonly name: string;

  searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResult[]>;

  getPlaceDetails(providerPlaceId: string): Promise<PlaceDetails | null>;

  getOpeningHours(providerPlaceId: string): Promise<OpeningHours>;

  getPlaceCoordinates(providerPlaceId: string): Promise<LatLng | null>;

  getPriceInfo(providerPlaceId: string): Promise<PriceInfo | null>;

  /** A deep link a customer can open. Built per the provider's terms. */
  buildMapsLink(input: { providerPlaceId?: string; lat: number; lng: number; name: string }): string;
}

/**
 * Estimated cost in cents of an operation, for the provider_usage ledger (§44).
 * Places and routing calls are the dominant variable cost of this product, so
 * every adapter declares its own tariff rather than us guessing centrally.
 */
export interface ProviderTariff {
  searchPlaces: number;
  getPlaceDetails: number;
  getOpeningHours: number;
  getPriceInfo: number;
}
