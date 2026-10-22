"use client";

import { useEffect } from "react";

// Client-side events (views, copies, downloads) go through /api/events,
// which only accepts names and properties on the allow list.

export function sendEvent(name: string, props: Record<string, string | number | boolean> = {}) {
  try {
    const body = JSON.stringify({ name, props });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {
    // Never let measurement break the page.
  }
}

export function ViewBeacon({ name, props }: { name: string; props?: Record<string, string> }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("utm_source") ?? new URLSearchParams(window.location.search).get("ref");
    if (source) document.cookie = `empire_source=${encodeURIComponent(source.slice(0, 40))}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax`;
    sendEvent(name, JSON.parse(key) as Record<string, string>);
  }, [name, key]);
  return null;
}
