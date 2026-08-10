"use client";

// Browser-side event sending (brief §25/§26).
//
// Three properties matter more than sophistication here:
//
//   1. It must never block or break the widget. Every failure is swallowed —
//      a customer getting their cleaning quote should not care that our
//      analytics endpoint is down.
//   2. It must survive the page closing, so `widget_complete` isn't lost when
//      someone clicks the CTA and navigates away. Hence sendBeacon.
//   3. It must be off in the builder preview. Editing your own widget for an
//      afternoon must not invent 400 views (§41 — no fake analytics).

import type { EventType, WidgetEvent } from "./events";

const SESSION_KEY = "qw_session";

/**
 * An anonymous, per-tab id used only to de-duplicate views and measure
 * completion. sessionStorage, not a cookie: it dies with the tab, never
 * crosses sites, and needs no consent banner.
 */
export function sessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = randomId();
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode or a sandboxed iframe: fall back to a per-load id.
    return randomId();
  }
}

function randomId(): string {
  const globalCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface Tracker {
  track(type: EventType, detail?: { stepId?: string; metadata?: WidgetEvent["metadata"] }): void;
}

/** A tracker that does nothing — used by the builder preview and templates. */
export const noopTracker: Tracker = { track: () => {} };

/**
 * Create a tracker for one widget.
 *
 * Events are queued for a tick and posted as a batch, so answering five
 * questions quickly is one request rather than five.
 */
export function createTracker(widgetId: string, endpoint = "/api/events"): Tracker {
  if (typeof window === "undefined") return noopTracker;

  const session = sessionId();
  let queue: WidgetEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const seenOnce = new Set<string>();

  const flush = (useBeacon = false) => {
    if (queue.length === 0) return;
    const body = JSON.stringify({ events: queue.slice(0, 20) });
    queue = [];
    timer = null;

    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Analytics is never worth an exception in the runtime.
    }
  };

  window.addEventListener("pagehide", () => flush(true));

  return {
    track(type, detail) {
      // Views and starts are once-per-session facts, not counters.
      if (type === "widget_view" || type === "widget_start" || type === "widget_complete") {
        if (seenOnce.has(type)) return;
        seenOnce.add(type);
      }

      queue.push({
        widgetId,
        sessionId: session,
        type,
        stepId: detail?.stepId,
        metadata: detail?.metadata,
      });

      if (timer === null) timer = setTimeout(() => flush(false), 400);
    },
  };
}
