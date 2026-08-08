/**
 * WeatherProvider interface (§12).
 *
 * Normalised output so the weather rules in src/config/planner.ts are written
 * once against our shape rather than against a vendor's. Weather codes follow
 * the WMO set; adapters map into it.
 */

import type { WeatherForecast } from "@/lib/types";

export interface ForecastRequest {
  lat: number;
  lng: number;
  /** ISO date, market-local. */
  date: string;
  timezone: string;
}

export interface WeatherProvider {
  readonly name: string;
  getForecast(request: ForecastRequest): Promise<WeatherForecast | null>;
}

/**
 * WMO weather interpretation codes, grouped into the handful of buckets our
 * rules care about. Anything unrecognised is treated as unsettled rather than
 * fine, because being wrong in the optimistic direction ruins a Saturday.
 */
export function weatherBucket(code: number): "fine" | "cloudy" | "wet" | "storm" | "severe" {
  if ([0, 1].includes(code)) return "fine";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  if (code >= 51 && code <= 67) return "wet";
  if (code >= 80 && code <= 82) return "wet";
  if (code >= 71 && code <= 77) return "severe";
  if (code >= 85 && code <= 86) return "severe";
  if (code >= 95) return "storm";
  return "cloudy";
}

export function describeWeather(forecast: WeatherForecast): string {
  const bucket = weatherBucket(forecast.weather_code);
  const temp = `${Math.round(forecast.temperature_max)}°C`;
  switch (bucket) {
    case "fine":
      return `${temp} and sunny`;
    case "cloudy":
      return `${temp}, partly cloudy`;
    case "wet":
      return `${temp}, showers likely`;
    case "storm":
      return `${temp}, storms forecast`;
    case "severe":
      return `${temp}, severe weather forecast`;
  }
}
