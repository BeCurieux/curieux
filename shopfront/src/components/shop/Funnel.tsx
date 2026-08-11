"use client";

/**
 * The funnel, from the browser's side.
 *
 * One `view` on mount, then a delegated click listener. Delegated rather than a
 * handler per card because the alternative is threading an onClick through
 * every block component, which would make the renderer — a pile of server
 * components with one interactive chip — a client tree for the sake of
 * analytics. The links stay ordinary `<a>` elements and this reads the
 * `data-fnl-*` attributes on the way past.
 *
 * Nothing here blocks a navigation. `keepalive` lets a request outlive the page
 * it was sent from, which is exactly the case that matters: a product click is a
 * click on a link to somewhere else, and an event that needed the page to stay
 * open would miss every one of them.
 */

import { useEffect } from "react";
import { newSessionId } from "@/lib/funnel/event";
import { readSource } from "@/lib/funnel/source";
import type { EventType, TrafficSource } from "@/lib/funnel/types";

const SESSION_KEY = "popuup.session";
const SOURCE_KEY = "popuup.source";
const CAMPAIGN_KEY = "popuup.campaign";

export function Funnel({ slug }: { slug: string }) {
  useEffect(() => {
    // sessionStorage, not a cookie: scoped to one tab on one origin, gone when
    // that tab closes, and nothing that survives to be joined against anything
    // else. In a private or storage-blocked context this throws, and a shop
    // that failed to render because analytics could not write is unacceptable —
    // so every access is guarded and the funnel simply goes quiet.
    let sessionId: string;
    let source: TrafficSource;
    let campaign: string | undefined;

    try {
      sessionId = sessionStorage.getItem(SESSION_KEY) ?? newSessionId();
      sessionStorage.setItem(SESSION_KEY, sessionId);

      // Read once and remembered for the session. The referrer is only present
      // on the first page, and a click three minutes later still came from
      // Instagram.
      const stored = sessionStorage.getItem(SOURCE_KEY);
      const params = new URLSearchParams(window.location.search);
      source =
        (stored as TrafficSource | null) ??
        readSource({
          referrer: document.referrer,
          utmSource: params.get("utm_source"),
          selfOrigin: window.location.origin,
        });
      sessionStorage.setItem(SOURCE_KEY, source);

      campaign = params.get("utm_campaign") ?? sessionStorage.getItem(CAMPAIGN_KEY) ?? undefined;
      if (campaign) sessionStorage.setItem(CAMPAIGN_KEY, campaign);
    } catch {
      return;
    }

    const send = (type: EventType, extra: { handle?: string; variantId?: string } = {}) => {
      const body = JSON.stringify({
        events: [
          {
            slug,
            sessionId,
            type,
            source,
            ...(campaign ? { campaign } : {}),
            ...extra,
          },
        ],
      });

      // `keepalive` rather than sendBeacon: same survive-the-navigation
      // guarantee, and it lets the request carry a JSON content type, which is
      // what the route validates against.
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    };

    send("view");

    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-fnl]");
      if (!target) return;

      const type = target.dataset["fnl"] as EventType | undefined;
      if (type !== "product_click" && type !== "checkout_start") return;

      const handle = target.dataset["fnlHandle"];
      const variantId = target.dataset["fnlVariant"];
      send(type, { ...(handle ? { handle } : {}), ...(variantId ? { variantId } : {}) });
    };

    // Capture phase, so an event is sent even if something downstream stops
    // propagation before it bubbles this far.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [slug]);

  return null;
}
