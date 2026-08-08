/**
 * Mock RouteProvider.
 *
 * Straight-line distance inflated by a per-mode detour factor and a modest
 * fixed overhead — realistic enough that travel-radius filtering, schedule
 * assembly and the "too much driving" penalty all behave as they would in
 * production, and deterministic so the eval suite can assert exact outcomes.
 */

import type { TransportMode } from "@/lib/types";
import { haversineKm } from "@/lib/util/geo";
import type { RouteProvider, RouteRequest, RouteResult } from "./provider";

/** Road/track distance ÷ straight-line distance, by mode. */
const DETOUR_FACTOR: Record<TransportMode, number> = {
  DRIVING: 1.32,
  TRANSIT: 1.45,
  WALKING: 1.25,
  CYCLING: 1.28,
};

/** Average door-to-door speed, km/h, including the friction of the mode. */
const SPEED_KMH: Record<TransportMode, number> = {
  DRIVING: 38,
  TRANSIT: 24,
  WALKING: 4.6,
  CYCLING: 14,
};

/** Fixed overhead in minutes: parking, waiting for a service, walking to it. */
const OVERHEAD_MINUTES: Record<TransportMode, number> = {
  DRIVING: 5,
  TRANSIT: 9,
  WALKING: 0,
  CYCLING: 2,
};

export class MockRouteProvider implements RouteProvider {
  readonly name = "mock_routes";
  public calls = 0;

  supportedModes(): TransportMode[] {
    return ["DRIVING", "TRANSIT", "WALKING", "CYCLING"];
  }

  async getTravelTime(request: RouteRequest): Promise<RouteResult> {
    this.calls++;
    const straightKm = haversineKm(request.origin, request.destination);
    const distanceKm = straightKm * DETOUR_FACTOR[request.mode];
    const minutes = (distanceKm / SPEED_KMH[request.mode]) * 60 + OVERHEAD_MINUTES[request.mode];

    // Long transit trips to the city fringe frequently have no sensible
    // Saturday itinerary. Modelling that here keeps the "public transport
    // only" eval honest rather than letting every candidate be reachable.
    const feasible = !(request.mode === "TRANSIT" && straightKm > 45);

    return {
      mode: request.mode,
      duration_minutes: feasible ? Math.round(minutes) : 0,
      distance_km: feasible ? Number(distanceKm.toFixed(2)) : 0,
      summary: feasible ? summaryFor(request.mode, distanceKm) : "No reasonable service",
      feasible,
      provider: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  async getRouteDistance(request: RouteRequest): Promise<number | null> {
    return (await this.getTravelTime(request)).distance_km;
  }

  async getRouteSummary(request: RouteRequest): Promise<string | null> {
    return (await this.getTravelTime(request)).summary;
  }
}

function summaryFor(mode: TransportMode, km: number): string {
  switch (mode) {
    case "DRIVING":
      return `${km.toFixed(1)} km by car`;
    case "TRANSIT":
      return km > 12 ? "Train + short walk" : "Bus + short walk";
    case "WALKING":
      return `${km.toFixed(1)} km on foot`;
    case "CYCLING":
      return `${km.toFixed(1)} km by bike`;
  }
}
