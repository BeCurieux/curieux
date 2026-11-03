"use client";

import { useActionState, useState } from "react";
import type { LeadState } from "@/app/(public)/lead-actions";

// The email form on /check, /hype and /waitlist. Works without JavaScript
// (a plain form post) and with it (no reload).

export function LeadForm({
  action,
  button,
  utmSource,
  interests,
  sentText,
}: {
  action: (state: LeadState, form: FormData) => Promise<LeadState>;
  button: string;
  utmSource?: string;
  interests?: { value: "founding" | "future_modules"; label: string }[];
  sentText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // Controlled, so an error doesn't clear what she typed (React resets
  // uncontrolled fields after every form action).
  const [email, setEmail] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  if (state.status === "sent" || state.status === "listed") {
    return (
      <div
        role="status"
        className="border-line bg-paper rounded-2xl border p-6"
        data-testid="lead-done"
      >
        {state.status === "sent" ? (
          <>
            <h2 className="text-2xl">Check your email</h2>
            <p className="mt-3">
              {sentText ?? "We've sent you a sign-in link."} It works once and expires in an hour.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl">You're on the list</h2>
            <p className="mt-3">We'll email {state.email} when there's news.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {utmSource ? <input type="hidden" name="utm_source" value={utmSource} /> : null}
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {interests ? (
        <fieldset>
          <legend className="font-semibold">Tell me about</legend>
          <div className="mt-2 space-y-2">
            {interests.map((i) => (
              <label key={i.value} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="interests"
                  value={i.value}
                  checked={chosen.includes(i.value)}
                  onChange={(event) =>
                    setChosen((all) =>
                      event.target.checked ? [...all, i.value] : all.filter((v) => v !== i.value),
                    )
                  }
                  className="size-5"
                />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div>
        <label htmlFor="lead-email" className="block font-semibold">
          Your email
        </label>
        <input
          id="lead-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-line bg-paper mt-2 block w-full rounded-xl border px-4 py-3 text-lg"
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold disabled:opacity-60"
      >
        {pending ? "Sending…" : button}
      </button>
    </form>
  );
}
