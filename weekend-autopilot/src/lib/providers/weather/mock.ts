/**
 * Mock WeatherProvider.
 *
 * Two modes. Given a scripted forecast it returns exactly that — which is how
 * the eval suite pins "38°C with a toddler" or "rain, public transport only"
 * (§46). Otherwise it derives a stable pseudo-forecast from the date so local
 * development sees varied but reproducible weather.
 */

import type { WeatherForecast } from "@/lib/types";
import { describeWeather, type ForecastRequest, type WeatherProvider } from "./provider";

export type ScriptedForecast = Partial<
  Pick<
    WeatherForecast,
    | "temperature_min"
    | "temperature_max"
    | "precipitation_probability"
    | "precipitation_amount"
    | "wind_speed"
    | "weather_code"
  >
>;

export class MockWeatherProvider implements WeatherProvider {
  readonly name = "mock_weather";

  constructor(private readonly scripted?: ScriptedForecast) {}

  async getForecast(request: ForecastRequest): Promise<WeatherForecast> {
    const base = this.scripted ?? derive(request.date);

    const forecast: WeatherForecast = {
      date: request.date,
      temperature_min: base.temperature_min ?? 15,
      temperature_max: base.temperature_max ?? 24,
      precipitation_probability: base.precipitation_probability ?? 0.1,
      precipitation_amount: base.precipitation_amount ?? 0,
      wind_speed: base.wind_speed ?? 12,
      weather_code: base.weather_code ?? 0,
      summary: "",
      provider: this.name,
      fetched_at: new Date().toISOString(),
    };
    forecast.summary = describeWeather(forecast);
    return forecast;
  }
}

/** Deterministic per-date variation: same date, same weather, every run. */
function derive(date: string): ScriptedForecast {
  const seed = [...date].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9973, 7);
  const wet = seed % 5 === 0;
  const hot = seed % 7 === 0;

  return {
    temperature_min: 12 + (seed % 8),
    temperature_max: hot ? 34 + (seed % 4) : 20 + (seed % 9),
    precipitation_probability: wet ? 0.7 : 0.05 + (seed % 20) / 100,
    precipitation_amount: wet ? 6 : 0,
    wind_speed: 8 + (seed % 25),
    weather_code: wet ? 61 : seed % 3 === 0 ? 2 : 0,
  };
}
