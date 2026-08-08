/**
 * Provider registry and the usage ledger that wraps it (§12, §44).
 *
 * Nothing in the planner constructs a provider directly. It asks for a
 * `ProviderBundle` and gets adapters chosen by environment, each wrapped in a
 * meter that records every call against the generation run. Places and routing
 * are the dominant variable cost of this product, so "how much did this
 * weekend cost to plan?" has to be answerable per household, not estimated
 * annually (§44).
 */

import { serverEnv } from "@/config/env";
import type { PlaceProvider, ProviderTariff } from "./places/provider";
import type { RouteProvider } from "./routes/provider";
import type { WeatherProvider } from "./weather/provider";
import { GooglePlaceProvider, GOOGLE_PLACES_TARIFF } from "./places/google";
import { MockPlaceProvider } from "./places/mock";
import { GoogleRouteProvider, GOOGLE_ROUTES_TARIFF } from "./routes/google";
import { MockRouteProvider } from "./routes/mock";
import { OpenMeteoWeatherProvider } from "./weather/open-meteo";
import { MockWeatherProvider } from "./weather/mock";

export interface UsageRecord {
  provider: string;
  operation: string;
  requests: number;
  estimated_cost_cents: number;
}

/** Collects provider calls for one generation run. */
export class UsageLedger {
  private readonly records = new Map<string, UsageRecord>();

  record(provider: string, operation: string, costCents: number): void {
    const key = `${provider}:${operation}`;
    const existing = this.records.get(key);
    if (existing) {
      existing.requests += 1;
      existing.estimated_cost_cents += costCents;
    } else {
      this.records.set(key, {
        provider,
        operation,
        requests: 1,
        estimated_cost_cents: costCents,
      });
    }
  }

  entries(): UsageRecord[] {
    return [...this.records.values()];
  }

  totalCents(): number {
    return this.entries().reduce((sum, r) => sum + r.estimated_cost_cents, 0);
  }
}

const ZERO_TARIFF: ProviderTariff = {
  searchPlaces: 0,
  getPlaceDetails: 0,
  getOpeningHours: 0,
  getPriceInfo: 0,
};

/** Wraps a PlaceProvider so every call lands in the ledger. */
function meterPlaces(
  inner: PlaceProvider,
  tariff: ProviderTariff,
  ledger: UsageLedger
): PlaceProvider {
  return {
    name: inner.name,
    async searchPlaces(request) {
      ledger.record(inner.name, "searchPlaces", tariff.searchPlaces);
      return inner.searchPlaces(request);
    },
    async getPlaceDetails(id) {
      ledger.record(inner.name, "getPlaceDetails", tariff.getPlaceDetails);
      return inner.getPlaceDetails(id);
    },
    async getOpeningHours(id) {
      ledger.record(inner.name, "getOpeningHours", tariff.getOpeningHours);
      return inner.getOpeningHours(id);
    },
    async getPlaceCoordinates(id) {
      return inner.getPlaceCoordinates(id);
    },
    async getPriceInfo(id) {
      ledger.record(inner.name, "getPriceInfo", tariff.getPriceInfo);
      return inner.getPriceInfo(id);
    },
    buildMapsLink(input) {
      return inner.buildMapsLink(input);
    },
  };
}

function meterRoutes(inner: RouteProvider, costCents: number, ledger: UsageLedger): RouteProvider {
  return {
    name: inner.name,
    supportedModes: () => inner.supportedModes(),
    async getTravelTime(request) {
      ledger.record(inner.name, "getTravelTime", costCents);
      return inner.getTravelTime(request);
    },
    async getRouteDistance(request) {
      ledger.record(inner.name, "getRouteDistance", costCents);
      return inner.getRouteDistance(request);
    },
    async getRouteSummary(request) {
      ledger.record(inner.name, "getRouteSummary", costCents);
      return inner.getRouteSummary(request);
    },
  };
}

function meterWeather(inner: WeatherProvider, ledger: UsageLedger): WeatherProvider {
  return {
    name: inner.name,
    async getForecast(request) {
      ledger.record(inner.name, "getForecast", 0);
      return inner.getForecast(request);
    },
  };
}

export interface ProviderBundle {
  places: PlaceProvider;
  routes: RouteProvider;
  weather: WeatherProvider;
  ledger: UsageLedger;
}

export interface ProviderOverrides {
  places?: PlaceProvider;
  routes?: RouteProvider;
  weather?: WeatherProvider;
}

/**
 * Build the bundle for a generation run. Overrides exist so tests can inject
 * fixtures without touching the environment; production passes none.
 */
export function buildProviders(overrides: ProviderOverrides = {}): ProviderBundle {
  const env = serverEnv();
  const ledger = new UsageLedger();

  const rawPlaces =
    overrides.places ??
    (env.PLACES_PROVIDER === "google" && env.PLACES_API_KEY
      ? new GooglePlaceProvider(env.PLACES_API_KEY)
      : new MockPlaceProvider());

  const rawRoutes =
    overrides.routes ??
    (env.ROUTES_PROVIDER === "google" && env.ROUTES_API_KEY
      ? new GoogleRouteProvider(env.ROUTES_API_KEY)
      : new MockRouteProvider());

  const rawWeather =
    overrides.weather ??
    (env.WEATHER_PROVIDER === "mock"
      ? new MockWeatherProvider()
      : new OpenMeteoWeatherProvider());

  const placesTariff = rawPlaces.name === "google_places" ? GOOGLE_PLACES_TARIFF : ZERO_TARIFF;
  const routesCost = rawRoutes.name === "google_routes" ? GOOGLE_ROUTES_TARIFF.getTravelTime : 0;

  return {
    places: meterPlaces(rawPlaces, placesTariff, ledger),
    routes: meterRoutes(rawRoutes, routesCost, ledger),
    weather: meterWeather(rawWeather, ledger),
    ledger,
  };
}
