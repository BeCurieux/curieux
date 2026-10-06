"use client";

import posthog from "posthog-js";
import { publicEnv } from "@/env";
import {
  sanitiseEventProperties,
  scrubAutomaticProperties,
  type AnalyticsEventName,
  type AnalyticsEvents,
} from "./sanitise";

// PostHog, configured to collect as little as it can. Off entirely unless
// NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST are both set. No autocapture, no automatic pageviews, no
// session recording, no person profiles: only the typed events declared in
// sanitise.ts, with URLs coarsened on the way out.

let started = false;

export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  const env = publicEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST) return;

  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    person_profiles: "never",
    save_referrer: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: (event) =>
      event ? { ...event, properties: scrubAutomaticProperties(event.properties) } : null,
  });
  started = true;
}

export function track<E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]) {
  if (!started) return;
  posthog.capture(event, sanitiseEventProperties(event, properties));
}

export function resetAnalytics() {
  if (started) posthog.reset();
}
