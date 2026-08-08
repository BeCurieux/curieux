/**
 * Market configuration (brief §5).
 *
 * MVP ships Sydney only. Everything that varies by city — currency, units,
 * delivery day/time, geographic bounds — lives in this table rather than in
 * code, so adding London is a data change plus a candidate-source review, not
 * an architectural one. Scheduling reads `timezone` from here, never a
 * hard-coded "Australia/Sydney".
 */

export type DistanceUnits = "metric" | "imperial";

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface GeoBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface Market {
  market_id: string;
  display_name: string;
  country: string;
  currency: string;
  /**
   * The symbol we actually print. Explicit rather than left to ICU, which
   * renders AUD in en-AU as a bare "$" — correct inside Australia, ambiguous
   * on a website, and not what our own copy says. "A$29" is the price.
   */
  currency_symbol: string;
  locale: string;
  timezone: string;
  distance_units: DistanceUnits;
  supported_geo_bounds: GeoBounds;
  /** Default travel tolerance in minutes when the user has not said otherwise. */
  default_travel_radius: number;
  /** Day the plan lands in the inbox. */
  delivery_day: Weekday;
  /** Local wall-clock time of delivery, "HH:MM". */
  delivery_time: string;
  /** Day plans are generated — always ahead of delivery so verification can retry. */
  generation_day: Weekday;
  generation_time: string;
  /** Sunday evening "did you do it?" prompt. */
  feedback_day: Weekday;
  feedback_time: string;
  /** Whether this market accepts paying customers yet. */
  live: boolean;
}

const SYDNEY: Market = {
  market_id: "sydney",
  display_name: "Sydney",
  country: "AU",
  currency: "AUD",
  currency_symbol: "A$",
  locale: "en-AU",
  timezone: "Australia/Sydney",
  distance_units: "metric",
  // Roughly Greater Sydney plus the day-trip ring the 90-minute radius reaches:
  // Newcastle in the north, the Southern Highlands, and over the Blue Mountains.
  supported_geo_bounds: {
    min_lat: -34.6,
    max_lat: -32.6,
    min_lng: 150.0,
    max_lng: 151.6,
  },
  default_travel_radius: 40,
  delivery_day: 4, // Thursday
  delivery_time: "07:30",
  generation_day: 3, // Wednesday evening
  generation_time: "19:00",
  feedback_day: 7, // Sunday evening
  feedback_time: "18:30",
  live: true,
};

/**
 * Markets we intend to open. Only `live` markets can be sold to; the rest are
 * here so the waitlist can offer a real list of cities and so the scheduler's
 * multi-timezone path is exercised before we need it.
 */
const PLANNED: Market[] = [
  {
    ...SYDNEY,
    market_id: "melbourne",
    display_name: "Melbourne",
    timezone: "Australia/Melbourne",
    supported_geo_bounds: { min_lat: -38.5, max_lat: -37.0, min_lng: 144.0, max_lng: 145.9 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "brisbane",
    display_name: "Brisbane",
    timezone: "Australia/Brisbane",
    supported_geo_bounds: { min_lat: -28.4, max_lat: -26.5, min_lng: 152.4, max_lng: 153.6 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "auckland",
    display_name: "Auckland",
    country: "NZ",
    currency: "NZD",
    currency_symbol: "NZ$",
    locale: "en-NZ",
    timezone: "Pacific/Auckland",
    supported_geo_bounds: { min_lat: -37.4, max_lat: -36.0, min_lng: 174.2, max_lng: 175.4 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "london",
    display_name: "London",
    country: "GB",
    currency: "GBP",
    currency_symbol: "£",
    locale: "en-GB",
    timezone: "Europe/London",
    supported_geo_bounds: { min_lat: 50.9, max_lat: 52.3, min_lng: -1.3, max_lng: 1.1 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "new_york",
    display_name: "New York",
    country: "US",
    currency: "USD",
    currency_symbol: "US$",
    locale: "en-US",
    timezone: "America/New_York",
    distance_units: "imperial",
    supported_geo_bounds: { min_lat: 40.2, max_lat: 41.5, min_lng: -74.6, max_lng: -73.2 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "los_angeles",
    display_name: "Los Angeles",
    country: "US",
    currency: "USD",
    currency_symbol: "US$",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    distance_units: "imperial",
    supported_geo_bounds: { min_lat: 33.3, max_lat: 34.5, min_lng: -118.9, max_lng: -117.4 },
    live: false,
  },
  {
    ...SYDNEY,
    market_id: "toronto",
    display_name: "Toronto",
    country: "CA",
    currency: "CAD",
    currency_symbol: "C$",
    locale: "en-CA",
    timezone: "America/Toronto",
    supported_geo_bounds: { min_lat: 43.3, max_lat: 44.4, min_lng: -80.1, max_lng: -78.8 },
    live: false,
  },
];

export const MARKETS: readonly Market[] = [SYDNEY, ...PLANNED];

export const DEFAULT_MARKET_ID = (process.env.SUPPORTED_MARKET ?? "sydney").trim() || "sydney";

export function getMarket(marketId: string): Market {
  const market = MARKETS.find((m) => m.market_id === marketId);
  if (!market) throw new Error(`Unknown market: ${marketId}`);
  return market;
}

export function defaultMarket(): Market {
  return getMarket(DEFAULT_MARKET_ID);
}

export function liveMarkets(): Market[] {
  return MARKETS.filter((m) => m.live);
}

/** Cities we can offer on the waitlist form. */
export function plannedMarkets(): Market[] {
  return MARKETS.filter((m) => !m.live);
}

export function isWithinMarket(market: Market, lat: number, lng: number): boolean {
  const b = market.supported_geo_bounds;
  return lat >= b.min_lat && lat <= b.max_lat && lng >= b.min_lng && lng <= b.max_lng;
}

/**
 * Which live market, if any, contains this point. Used at onboarding to decide
 * between "let's go" and the waitlist (§5).
 */
export function marketForCoordinates(lat: number, lng: number): Market | null {
  return liveMarkets().find((m) => isWithinMarket(m, lat, lng)) ?? null;
}

/**
 * Money formatting always goes through the market, never a hard-coded "A$".
 *
 * The number is formatted by Intl (grouping and decimals follow the locale)
 * and the symbol is prepended from config, because ICU's idea of the AUD
 * symbol inside en-AU is a bare "$" and our prices are quoted as "A$29".
 */
export function formatMoney(market: Market, amount: number): string {
  const number = new Intl.NumberFormat(market.locale, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${market.currency_symbol}${number}`;
}

export function formatMoneyRange(market: Market, min: number, max: number): string {
  if (min === max) return formatMoney(market, min);
  if (min === 0) return `Under ${formatMoney(market, max)}`;
  // "A$65–85" reads better than "A$65–A$85": the symbol appears once.
  const upper = new Intl.NumberFormat(market.locale, {
    minimumFractionDigits: max % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(max);
  return `${formatMoney(market, min)}–${upper}`;
}

/** Distance rendered in the market's units. Stored values are always metric km. */
export function formatDistance(market: Market, km: number): string {
  if (market.distance_units === "imperial") {
    const miles = km * 0.621371;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
