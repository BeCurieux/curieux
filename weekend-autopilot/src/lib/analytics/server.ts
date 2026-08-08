/**
 * Server-side analytics (§45).
 *
 * PostHog when configured, a no-op otherwise, so that neither local
 * development nor CI depends on an analytics vendor being reachable.
 *
 * The identifier is the household, not the person: the product's unit of
 * analysis is a household's weekends, and it keeps us from accumulating a
 * per-individual behavioural profile we do not need (§51).
 */

import { PostHog } from "posthog-node";
import { serverEnv, publicEnv } from "@/config/env";
import type { AnalyticsEvent, EventProperties } from "./events";

let client: PostHog | null = null;
let initialised = false;

function posthog(): PostHog | null {
  if (initialised) return client;
  initialised = true;

  const key = serverEnv().POSTHOG_KEY ?? publicEnv.posthogKey;
  if (!key) return null;

  client = new PostHog(key, { host: publicEnv.posthogHost, flushAt: 1, flushInterval: 0 });
  return client;
}

export function track(
  householdId: string,
  event: AnalyticsEvent,
  properties: EventProperties = {}
): void {
  const ph = posthog();
  if (!ph) return;
  ph.capture({ distinctId: householdId, event, properties });
}

/** Flush before a serverless function exits, or events are lost. */
export async function flushAnalytics(): Promise<void> {
  const ph = posthog();
  if (!ph) return;
  await ph.shutdown();
}
