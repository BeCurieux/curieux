/**
 * Open-Meteo weather adapter.
 *
 * Chosen as the default because it needs no key, returns WMO codes natively
 * (so our normalisation is a pass-through rather than a guess), and is
 * generous enough that a weekly forecast per household is free. Swapping it
 * for a paid provider is one class implementing WeatherProvider.
 */

import type { WeatherForecast } from "@/lib/types";
import { describeWeather, type ForecastRequest, type WeatherProvider } from "./provider";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly name = "open_meteo";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getForecast(request: ForecastRequest): Promise<WeatherForecast | null> {
    const params = new URLSearchParams({
      latitude: request.lat.toFixed(4),
      longitude: request.lng.toFixed(4),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
      ].join(","),
      timezone: request.timezone,
      start_date: request.date,
      end_date: request.date,
    });

    const response = await this.fetchImpl(`${ENDPOINT}?${params.toString()}`);
    if (!response.ok) return null;

    const json = (await response.json()) as OpenMeteoResponse;
    const daily = json.daily;
    if (!daily?.time?.length) return null;

    const forecast: WeatherForecast = {
      date: daily.time[0] ?? request.date,
      temperature_min: daily.temperature_2m_min?.[0] ?? 0,
      temperature_max: daily.temperature_2m_max?.[0] ?? 0,
      // Open-Meteo reports probability as a percentage; we normalise to 0–1
      // because every rule in config is expressed that way.
      precipitation_probability: (daily.precipitation_probability_max?.[0] ?? 0) / 100,
      precipitation_amount: daily.precipitation_sum?.[0] ?? 0,
      wind_speed: daily.wind_speed_10m_max?.[0] ?? 0,
      weather_code: daily.weather_code?.[0] ?? 3,
      summary: "",
      provider: this.name,
      fetched_at: new Date().toISOString(),
    };
    forecast.summary = describeWeather(forecast);
    return forecast;
  }
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
}
