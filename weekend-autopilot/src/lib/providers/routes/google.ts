/**
 * Google Routes adapter (§12).
 *
 * One call per origin/destination/mode/departure. Routing is the second
 * largest variable cost after Places, so the planner batches and caches
 * aggressively above this layer; the adapter itself stays dumb.
 */

import type { TransportMode } from "@/lib/types";
import type { RouteProvider, RouteRequest, RouteResult } from "./provider";

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.description",
  "routes.legs.steps.transitDetails.transitLine.nameShort",
].join(",");

const MODE_MAP: Record<TransportMode, string> = {
  DRIVING: "DRIVE",
  TRANSIT: "TRANSIT",
  WALKING: "WALK",
  CYCLING: "BICYCLE",
};

export const GOOGLE_ROUTES_TARIFF = { getTravelTime: 0.5 };

export class GoogleRouteProvider implements RouteProvider {
  readonly name = "google_routes";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  supportedModes(): TransportMode[] {
    return ["DRIVING", "TRANSIT", "WALKING", "CYCLING"];
  }

  async getTravelTime(request: RouteRequest): Promise<RouteResult | null> {
    const body: Record<string, unknown> = {
      origin: waypoint(request.origin),
      destination: waypoint(request.destination),
      travelMode: MODE_MAP[request.mode],
      departureTime: request.depart_at.toISOString(),
      languageCode: "en-AU",
      units: "METRIC",
    };
    // routingPreference is only valid for DRIVE/TWO_WHEELER, and the API
    // rejects the request outright if it is sent for walking or transit.
    if (request.mode === "DRIVING") {
      body.routingPreference = "TRAFFIC_AWARE";
    }

    const response = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;

    const json = (await response.json()) as { routes?: GoogleRoute[] };
    const route = json.routes?.[0];
    // No route is a fact, not an error: a Saturday-morning transit itinerary
    // that does not exist must make the candidate infeasible, not crash us.
    if (!route) {
      return {
        mode: request.mode,
        duration_minutes: 0,
        distance_km: 0,
        summary: "",
        feasible: false,
        provider: this.name,
        fetched_at: new Date().toISOString(),
      };
    }

    return {
      mode: request.mode,
      duration_minutes: parseDuration(route.duration) / 60,
      distance_km: (route.distanceMeters ?? 0) / 1000,
      summary: summarise(route, request.mode),
      feasible: true,
      provider: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  async getRouteDistance(request: RouteRequest): Promise<number | null> {
    return (await this.getTravelTime(request))?.distance_km ?? null;
  }

  async getRouteSummary(request: RouteRequest): Promise<string | null> {
    return (await this.getTravelTime(request))?.summary ?? null;
  }
}

interface GoogleRoute {
  duration?: string;
  distanceMeters?: number;
  description?: string;
  legs?: Array<{
    steps?: Array<{ transitDetails?: { transitLine?: { nameShort?: string } } }>;
  }>;
}

function waypoint(point: { lat: number; lng: number }) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } };
}

/** Google durations are protobuf strings: "1234s". */
export function parseDuration(duration: string | undefined): number {
  if (!duration) return 0;
  const seconds = Number(duration.replace(/s$/, ""));
  return Number.isFinite(seconds) ? seconds : 0;
}

function summarise(route: GoogleRoute, mode: TransportMode): string {
  if (mode === "TRANSIT") {
    const lines = (route.legs ?? [])
      .flatMap((leg) => leg.steps ?? [])
      .map((step) => step.transitDetails?.transitLine?.nameShort)
      .filter((n): n is string => Boolean(n));
    if (lines.length > 0) return lines.join(" → ");
  }
  return route.description ?? "";
}
