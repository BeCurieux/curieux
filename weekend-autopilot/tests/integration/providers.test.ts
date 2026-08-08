import { describe, expect, it } from "vitest";
import { GooglePlaceProvider, mapTypes, parseOpeningHours } from "@/lib/providers/places/google";
import { GoogleRouteProvider, parseDuration } from "@/lib/providers/routes/google";
import { OpenMeteoWeatherProvider } from "@/lib/providers/weather/open-meteo";
import { MockPlaceProvider } from "@/lib/providers/places/mock";
import { weatherBucket } from "@/lib/providers/weather/provider";
import { UsageLedger } from "@/lib/providers";

/**
 * Provider normalisation, against recorded response shapes (§48).
 *
 * No live requests: every adapter takes an injectable fetch, and these tests
 * hand it a canned response. The point is that a vendor's shape becomes OUR
 * shape correctly — especially the three-way open/closed/unknown distinction,
 * which the verifier depends on entirely.
 */

function fetchReturning(body: unknown, ok = true): typeof fetch {
  return (async () =>
    ({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }) as Response) as unknown as typeof fetch;
}

describe("Google Places adapter", () => {
  it("normalises a text search into our candidate shape", async () => {
    const provider = new GooglePlaceProvider(
      "test-key",
      fetchReturning({
        places: [
          {
            id: "ChIJtest",
            displayName: { text: "Test Beach" },
            location: { latitude: -33.89, longitude: 151.27 },
            types: ["beach", "tourist_attraction"],
            priceLevel: "PRICE_LEVEL_FREE",
            rating: 4.6,
            userRatingCount: 12000,
            businessStatus: "OPERATIONAL",
          },
        ],
      })
    );

    const results = await provider.searchPlaces({
      query: "harbour beach",
      centre: { lat: -33.9, lng: 151.2 },
      radius_metres: 10000,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider_place_id: "ChIJtest",
      name: "Test Beach",
      price_level: 0,
      business_status: "OPERATIONAL",
    });
    // Provider types are mapped into OUR taxonomy, not stored raw.
    expect(results[0]!.categories).toContain("beaches");
  });

  it("derives a busyness proxy from rating volume, log-scaled", async () => {
    const busy = new GooglePlaceProvider(
      "k",
      fetchReturning({
        places: [{ id: "a", userRatingCount: 40000, location: { latitude: 0, longitude: 0 } }],
      })
    );
    const quiet = new GooglePlaceProvider(
      "k",
      fetchReturning({
        places: [{ id: "b", userRatingCount: 40, location: { latitude: 0, longitude: 0 } }],
      })
    );

    const [busyResult] = await busy.searchPlaces({
      query: "x",
      centre: { lat: 0, lng: 0 },
      radius_metres: 1000,
    });
    const [quietResult] = await quiet.searchPlaces({
      query: "x",
      centre: { lat: 0, lng: 0 },
      radius_metres: 1000,
    });

    expect(busyResult!.busyness).toBeGreaterThan(quietResult!.busyness!);
    expect(busyResult!.busyness).toBeLessThanOrEqual(1);
  });

  it("returns an empty list rather than throwing when the API fails", async () => {
    const provider = new GooglePlaceProvider("k", fetchReturning(null, false));
    const results = await provider.searchPlaces({
      query: "x",
      centre: { lat: 0, lng: 0 },
      radius_metres: 1000,
    });
    expect(results).toEqual([]);
  });

  it("builds a maps link with the place id, per Google's URL scheme", () => {
    const provider = new GooglePlaceProvider("k");
    const link = provider.buildMapsLink({
      providerPlaceId: "ChIJtest",
      lat: -33.89,
      lng: 151.27,
      name: "Test",
    });
    expect(link).toContain("query_place_id=ChIJtest");
    expect(link).toContain("-33.89%2C151.27");
  });
});

describe("opening hours normalisation", () => {
  it("converts Google's Sunday-zero weekdays into ISO weekdays", () => {
    const hours = parseOpeningHours({
      id: "x",
      regularOpeningHours: {
        periods: [
          { open: { day: 0, hour: 9, minute: 0 }, close: { day: 0, hour: 17, minute: 0 } },
          { open: { day: 6, hour: 8, minute: 30 }, close: { day: 6, hour: 16, minute: 0 } },
        ],
      },
    });

    expect(hours.periods[7]).toEqual([{ open: "09:00", close: "17:00" }]); // Sunday
    expect(hours.periods[6]).toEqual([{ open: "08:30", close: "16:00" }]); // Saturday
    expect(hours.unknown).toBe(false);
  });

  it("treats a missing close as open all day rather than as closed", () => {
    const hours = parseOpeningHours({
      id: "x",
      regularOpeningHours: { periods: [{ open: { day: 1, hour: 0, minute: 0 } }] },
    });
    expect(hours.periods[1]?.[0]?.close).toBe("23:59");
  });

  it("distinguishes 'we don't know' from 'closed'", () => {
    const unknown = parseOpeningHours({ id: "x" });
    expect(unknown.unknown).toBe(true);
    expect(unknown.permanently_closed).toBe(false);
  });

  it("marks a permanently closed business as such", () => {
    const closed = parseOpeningHours({ id: "x", businessStatus: "CLOSED_PERMANENTLY" });
    expect(closed.permanently_closed).toBe(true);
    expect(closed.unknown).toBe(false);
  });
});

describe("type mapping", () => {
  it("maps provider types into our taxonomy and drops the rest", () => {
    expect(mapTypes(["beach", "point_of_interest", "establishment"])).toEqual(["beaches"]);
  });

  it("deduplicates when several provider types map to one of ours", () => {
    expect(mapTypes(["cafe", "coffee_shop"])).toEqual(["coffee"]);
  });

  it("returns nothing for types we do not recognise", () => {
    expect(mapTypes(["car_dealer", "insurance_agency"])).toEqual([]);
  });
});

describe("Google Routes adapter", () => {
  it("normalises a driving route", async () => {
    const provider = new GoogleRouteProvider(
      "k",
      fetchReturning({
        routes: [{ duration: "1500s", distanceMeters: 12400, description: "via Victoria Rd" }],
      })
    );

    const result = await provider.getTravelTime({
      origin: { lat: -33.91, lng: 151.15 },
      destination: { lat: -33.89, lng: 151.27 },
      mode: "DRIVING",
      depart_at: new Date("2026-03-14T09:00:00Z"),
    });

    expect(result).toMatchObject({ duration_minutes: 25, distance_km: 12.4, feasible: true });
  });

  it("reports an impossible transit itinerary as infeasible, not as an error", async () => {
    // The API legitimately returns no routes for a Saturday-morning transit
    // trip that does not exist. That has to make the candidate unreachable,
    // not crash the generation run.
    const provider = new GoogleRouteProvider("k", fetchReturning({ routes: [] }));
    const result = await provider.getTravelTime({
      origin: { lat: -33.91, lng: 151.15 },
      destination: { lat: -33.5, lng: 150.3 },
      mode: "TRANSIT",
      depart_at: new Date(),
    });
    expect(result?.feasible).toBe(false);
  });

  it("summarises a transit route by its line names", async () => {
    const provider = new GoogleRouteProvider(
      "k",
      fetchReturning({
        routes: [
          {
            duration: "2400s",
            distanceMeters: 18000,
            legs: [
              {
                steps: [
                  { transitDetails: { transitLine: { nameShort: "T1" } } },
                  { transitDetails: { transitLine: { nameShort: "F4" } } },
                ],
              },
            ],
          },
        ],
      })
    );

    const result = await provider.getTravelTime({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      mode: "TRANSIT",
      depart_at: new Date(),
    });
    expect(result?.summary).toBe("T1 → F4");
  });

  it("parses protobuf durations", () => {
    expect(parseDuration("1500s")).toBe(1500);
    expect(parseDuration(undefined)).toBe(0);
    expect(parseDuration("nonsense")).toBe(0);
  });
});

describe("Open-Meteo adapter", () => {
  it("normalises percentages into the 0–1 range our rules expect", async () => {
    const provider = new OpenMeteoWeatherProvider(
      fetchReturning({
        daily: {
          time: ["2026-03-14"],
          weather_code: [61],
          temperature_2m_max: [19],
          temperature_2m_min: [13],
          precipitation_sum: [7.5],
          precipitation_probability_max: [80],
          wind_speed_10m_max: [22],
        },
      })
    );

    const forecast = await provider.getForecast({
      lat: -33.9,
      lng: 151.2,
      date: "2026-03-14",
      timezone: "Australia/Sydney",
    });

    expect(forecast).toMatchObject({
      temperature_max: 19,
      precipitation_probability: 0.8,
      precipitation_amount: 7.5,
      weather_code: 61,
    });
    expect(forecast?.summary).toContain("showers");
    // Every fact is attributable (§53).
    expect(forecast?.provider).toBe("open_meteo");
    expect(forecast?.fetched_at).toBeTruthy();
  });

  it("returns null rather than a fabricated forecast when the API fails", async () => {
    const provider = new OpenMeteoWeatherProvider(fetchReturning(null, false));
    const forecast = await provider.getForecast({
      lat: 0,
      lng: 0,
      date: "2026-03-14",
      timezone: "UTC",
    });
    expect(forecast).toBeNull();
  });
});

describe("weather buckets", () => {
  it("classifies WMO codes into the buckets the rules use", () => {
    expect(weatherBucket(0)).toBe("fine");
    expect(weatherBucket(3)).toBe("cloudy");
    expect(weatherBucket(61)).toBe("wet");
    expect(weatherBucket(81)).toBe("wet");
    expect(weatherBucket(95)).toBe("storm");
    expect(weatherBucket(75)).toBe("severe");
  });

  it("treats an unrecognised code as unsettled rather than fine", () => {
    // Being wrong optimistically here ruins a Saturday, so an unmapped code
    // must never come back "fine". 40 sits in a gap between the WMO ranges.
    expect(weatherBucket(40)).toBe("cloudy");
    expect(weatherBucket(999)).not.toBe("fine");
  });
});

describe("cost ledger (§44)", () => {
  it("accumulates requests and cost per operation", () => {
    const ledger = new UsageLedger();
    ledger.record("google_places", "searchPlaces", 3.2);
    ledger.record("google_places", "searchPlaces", 3.2);
    ledger.record("google_routes", "getTravelTime", 0.5);

    const entries = ledger.entries();
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.operation === "searchPlaces")?.requests).toBe(2);
    expect(ledger.totalCents()).toBeCloseTo(6.9, 5);
  });
});

describe("mock place provider", () => {
  it("respects the search radius", async () => {
    const provider = new MockPlaceProvider();
    // Blue Mountains is ~90 km from the CBD; a 5 km radius must not reach it.
    const results = await provider.searchPlaces({
      query: "bushwalk waterfall",
      centre: { lat: -33.8688, lng: 151.2093 },
      radius_metres: 5000,
    });
    expect(results.map((r) => r.name)).not.toContain("Wentworth Falls Track");
  });

  it("reports a permanently closed fixture as closed", async () => {
    const provider = new MockPlaceProvider();
    const details = await provider.getPlaceDetails("syd_closed_cafe");
    expect(details?.business_status).toBe("CLOSED_PERMANENTLY");
  });

  it("counts its calls, so cost regressions are visible in tests", async () => {
    const provider = new MockPlaceProvider();
    await provider.searchPlaces({
      query: "beach",
      centre: { lat: -33.89, lng: 151.27 },
      radius_metres: 10000,
    });
    expect(provider.calls.search).toBe(1);
  });
});
