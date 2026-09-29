// What analytics is allowed to see.
//
// Oviko holds children's data, so analytics works from an allowlist rather
// than a blocklist: every event is declared here with the only properties it
// may carry, and anything else is dropped before it leaves the browser. A
// child's name can't leak through a property nobody thought to block.
//
// URLs get the same treatment. Later routes will carry identifiers
// (/family/kids/ava), so only the first path segment is ever reported.

import type { Shell } from "@/lib/auth/roles";

export type AnalyticsEvents = {
  shell_viewed: { shell: Shell };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

const ALLOWED_PROPERTIES: { [E in AnalyticsEventName]: readonly (keyof AnalyticsEvents[E])[] } = {
  shell_viewed: ["shell"],
};

type Primitive = string | number | boolean;

export function sanitiseEventProperties(
  event: AnalyticsEventName,
  properties: Record<string, unknown>,
): Record<string, Primitive> {
  const allowed = ALLOWED_PROPERTIES[event] as readonly string[] | undefined;
  if (!allowed) return {};
  const clean: Record<string, Primitive> = {};
  for (const key of allowed) {
    const value = properties[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}

// Reduces a URL to origin plus first path segment, with no query or hash.
export function coarsenUrl(value: string): string {
  try {
    const url = new URL(value);
    const first = url.pathname.split("/").filter(Boolean)[0];
    return `${url.origin}/${first ?? ""}`;
  } catch {
    return "";
  }
}

export function coarsenPath(value: string): string {
  const first = value.split(/[?#]/)[0]?.split("/").filter(Boolean)[0];
  return `/${first ?? ""}`;
}

const URL_PROPERTIES = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"];
const PATH_PROPERTIES = ["$pathname", "$initial_pathname"];

// Applied to every outgoing PostHog payload's properties, including the ones
// the library adds on its own.
export function scrubAutomaticProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (typeof out[key] === "string") out[key] = coarsenUrl(out[key]);
  }
  for (const key of PATH_PROPERTIES) {
    if (typeof out[key] === "string") out[key] = coarsenPath(out[key]);
  }
  delete out.$search_query;
  return out;
}
