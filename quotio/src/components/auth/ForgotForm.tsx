"use client";

import { useState } from "react";
import { requestPasswordResetAction } from "@/app/actions";

/**
 * Asking for a reset link.
 *
 * The confirmation is the same whether or not the address has an account
 * behind it. Saying "no account with that email" would turn this form into a
 * way of asking us which addresses are our customers.
 */
export function ForgotForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div className="card mt-6 p-5" role="status">
        <p className="text-sm font-bold">Check your email.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          If that address has an account, a link is on its way. It expires in an hour, and using
          it signs you out everywhere else.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      action={async (formData) => {
        setState("sending");
        setError(null);
        const result = await requestPasswordResetAction(formData);
        if ("delivered" in result) {
          // `delivered` is false when the deployment lost its mail provider
          // between rendering this page and submitting it. Rare, but the
          // alternative is telling someone to wait for nothing.
          setState(result.delivered ? "sent" : "idle");
          if (!result.delivered) setError("We couldn't send that just now. Try again shortly.");
          return;
        }
        setState("idle");
        setError(result.error ?? "That didn't work.");
      }}
      onChange={() => setError(null)}
    >
      <div>
        <label className="label" htmlFor="reset-email">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          required
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send me a link"}
      </button>
    </form>
  );
}
