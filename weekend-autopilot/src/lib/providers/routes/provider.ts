/**
 * RouteProvider interface (§12).
 *
 * Travel time is the fact that most often makes a beautiful plan impossible,
 * so it is never estimated by the model and never inferred from straight-line
 * distance in anything a customer sees. Straight-line maths is used only to
 * decide which candidates are worth asking about.
 */

import type { TransportMode } from "@/lib/types";
import type { LatLng } from "@/lib/util/geo";

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  mode: TransportMode;
  /** Departure instant. Matters enormously for transit and Saturday traffic. */
  depart_at: Date;
}

export interface RouteResult {
  mode: TransportMode;
  duration_minutes: number;
  distance_km: number;
  /** Short human summary, e.g. "via Victoria Rd" or "Ferry F4 + 8 min walk". */
  summary: string;
  /** Transit only: whether the itinerary actually exists at that time. */
  feasible: boolean;
  provider: string;
  fetched_at: string;
}

export interface RouteProvider {
  readonly name: string;

  getTravelTime(request: RouteRequest): Promise<RouteResult | null>;

  getRouteDistance(request: RouteRequest): Promise<number | null>;

  getRouteSummary(request: RouteRequest): Promise<string | null>;

  /** Modes this provider can actually answer for in the current market. */
  supportedModes(): TransportMode[];
}
