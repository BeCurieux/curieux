/**
 * Geographic helpers.
 *
 * Distances here are straight-line and used only for cheap pre-filtering —
 * deciding which candidates are worth a routing call. Anything a customer
 * sees comes from the RouteProvider, never from this file (§13: the AI, and
 * for that matter our own arithmetic, does not invent travel times).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Optimistic travel-time estimate used to prune candidates before we pay for
 * routing. Deliberately generous — it must never exclude something the real
 * router would have said was reachable.
 */
export function optimisticMinutes(distanceKm: number, mode: string): number {
  const kmh =
    mode === "WALKING" ? 4.8 : mode === "CYCLING" ? 15 : mode === "TRANSIT" ? 28 : 45;
  return (distanceKm / kmh) * 60;
}

/**
 * Rounds coordinates to roughly 100 m before storage (§51). We need enough
 * precision to compute a travel time from someone's neighbourhood, and no
 * more than that. Applied at every write of a home location.
 */
export function coarsenLocation(point: LatLng): LatLng {
  return {
    lat: Math.round(point.lat * 1000) / 1000,
    lng: Math.round(point.lng * 1000) / 1000,
  };
}

/**
 * Does the ordered stop list double back on itself? A plan that drives past
 * its own lunch stop to reach a walk and then returns feels badly planned
 * even when the total time is fine (§15, §17).
 *
 * Returns the ratio of the actual path length to the direct home→furthest→home
 * distance. 1.0 is a clean out-and-back; anything above ~1.45 is a zigzag.
 */
export function backtrackRatio(home: LatLng, stops: LatLng[]): number {
  if (stops.length === 0) return 1;

  let pathKm = 0;
  let previous = home;
  for (const stop of stops) {
    pathKm += haversineKm(previous, stop);
    previous = stop;
  }
  pathKm += haversineKm(previous, home);

  const furthest = stops.reduce(
    (best, stop) => {
      const d = haversineKm(home, stop);
      return d > best.d ? { d, stop } : best;
    },
    { d: 0, stop: stops[0] as LatLng }
  );

  const idealKm = furthest.d * 2;
  if (idealKm < 0.5) return 1; // everything is on top of everything else
  return pathKm / idealKm;
}

/** Centre of a set of points. Used to pick a food stop near the anchor. */
export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error("centroid of empty set");
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
