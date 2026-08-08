"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { safeRedirectPath } from "@/lib/security/sanitise";

/**
 * Magic-link request.
 *
 * The `next` parameter is validated before it is used (§50): only same-origin
 * paths survive, so an emailed link cannot be turned into an open redirect by
 * appending someone else’s domain.
 */
export function MagicLinkForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");

    const redirect = safeRedirectPath(next, "/app");
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-card border border-rule bg-white p-6">
        <p className="font-display text-[20px] text-ink">Check your email.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">
          We’ve sent a link to <span className="font-semibold text-ink">{email}</span>. It
          works once, and expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 text-[14px] text-mist underline-offset-4 hover:underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="email" className="block text-[14px] font-medium text-graphite">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-12 w-full rounded-xl border border-rule bg-white px-4 text-[16px] text-ink placeholder:text-mist"
      />
      <Button type="submit" block disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a link"}
      </Button>
      {state === "error" && message ? (
        <p role="alert" className="text-[14px] text-clay">
          {message}
        </p>
      ) : null}
    </form>
  );
}
