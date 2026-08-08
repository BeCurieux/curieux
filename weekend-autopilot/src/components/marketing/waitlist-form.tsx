"use client";

import { useState } from "react";
import { Button, Card, SectionLabel } from "@/components/ui";

/**
 * "Not in your city yet?" (§5).
 *
 * Shown to everyone rather than only to visitors we have geolocated, because
 * we do not geolocate visitors. Someone who reads far enough to find this has
 * already told us they are interested.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, city }),
    });
    setState(response.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <Card className="p-6 text-center">
        <p className="font-display text-[20px] text-ink">Thanks — we’ll let you know.</p>
        <p className="mt-2 text-[15px] text-mist">
          We open cities one at a time, so it may be a while. We won’t email you about
          anything else.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <SectionLabel>Not in your city yet?</SectionLabel>
      <p className="mt-2 max-w-prose text-[16px] leading-relaxed text-graphite">
        We plan weekends in Sydney today. Tell us where you are and we’ll let you know
        when we get there.
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 flex-1 rounded-xl border border-rule bg-white px-4 text-[15px] text-ink placeholder:text-mist"
        />
        <label className="sr-only" htmlFor="waitlist-city">
          Your city
        </label>
        <input
          id="waitlist-city"
          type="text"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Your city"
          className="h-12 flex-1 rounded-xl border border-rule bg-white px-4 text-[15px] text-ink placeholder:text-mist"
        />
        <Button type="submit" disabled={state === "sending"} variant="secondary">
          {state === "sending" ? "Adding…" : "Join the list"}
        </Button>
      </form>

      {state === "error" ? (
        <p role="alert" className="mt-3 text-[14px] text-clay">
          That didn’t work. Try again in a moment.
        </p>
      ) : null}
    </Card>
  );
}
