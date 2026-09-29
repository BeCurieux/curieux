"use client";

import { useEffect, useRef } from "react";
import { resetAnalytics } from "@/lib/analytics/client";
import { IDLE_LIMIT_MS } from "@/lib/auth/idle";

const ACTIVITY = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
// How often activity is reported to the server, which refuses requests from
// a session it hasn't heard from in IDLE_LIMIT_MS.
const REPORT_EVERY_MS = 5 * 60 * 1000;

// Signs a shared device out after IDLE_LIMIT_MS without a tap, so a roster
// left open on a poolside iPad goes back to sign-in by itself. Checked on a
// timer and whenever the page comes back into view, because a sleeping
// tablet pauses timers.
export function IdleSignOut() {
  const form = useRef<HTMLFormElement>(null);
  const lastActive = useRef(0);
  const lastReported = useRef(0);

  useEffect(() => {
    lastActive.current = Date.now();
    lastReported.current = Date.now();
    const touch = () => {
      lastActive.current = Date.now();
      if (lastActive.current - lastReported.current > REPORT_EVERY_MS) {
        lastReported.current = lastActive.current;
        void fetch("/auth/active", { method: "POST" }).catch(() => {});
      }
    };
    const check = () => {
      if (Date.now() - lastActive.current > IDLE_LIMIT_MS) {
        resetAnalytics();
        form.current?.submit();
      }
    };
    for (const event of ACTIVITY) window.addEventListener(event, touch, { passive: true });
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 30_000);
    return () => {
      for (const event of ACTIVITY) window.removeEventListener(event, touch);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, []);

  return <form ref={form} action="/auth/sign-out?idle=1" method="post" hidden />;
}
