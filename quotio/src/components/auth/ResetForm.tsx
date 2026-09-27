"use client";

import { useState } from "react";
import { completePasswordResetAction } from "@/app/actions";

export function ResetForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="card mt-6 p-5" role="status">
        <p className="text-sm font-bold">Password changed.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          You can sign in with it now.
        </p>
        <a href="/login" className="btn mt-4">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      action={async (formData) => {
        setBusy(true);
        setError(null);
        const result = await completePasswordResetAction(formData);
        setBusy(false);
        if (result.ok) {
          setDone(true);
          return;
        }
        setError(result.error ?? "That didn't work.");
      }}
      onChange={() => setError(null)}
    >
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="label" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          required
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={busy}>
        {busy ? "Saving…" : "Set my password"}
      </button>
    </form>
  );
}
