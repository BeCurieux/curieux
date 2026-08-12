"use client";

// Changing a password, and closing an account.
//
// Two things shape this. Deleting is behind a second step, so it can't be a
// stray click on a settings page — and the step that appears says what will
// actually be destroyed, counted from the account rather than described in
// the abstract. And nothing here reports success it hasn't had: every message
// comes back from the server action.

import { useState } from "react";
import { changePasswordAction, deleteAccountAction } from "@/app/actions";

export function ChangePassword() {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (formData: FormData) => {
    setState("saving");
    setError(null);
    const result = await changePasswordAction(formData);
    if (result.ok) {
      setState("done");
      // Nothing to keep on screen — the fields are cleared by the reset below.
    } else {
      setState("idle");
      setError(result.error ?? "That didn't work.");
    }
  };

  return (
    <form
      action={async (formData) => {
        await submit(formData);
      }}
      // Clears the last failure as soon as you start correcting it — leaving
      // "that password isn't right" on screen while you retype reads as a
      // verdict on what you're typing now.
      onChange={() => {
        setState("idle");
        setError(null);
      }}
      className="mt-3 max-w-sm space-y-3"
    >
      <div>
        <label className="label" htmlFor="current-password">
          Current password
        </label>
        <input
          id="current-password"
          name="current"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="input"
          required
        />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>

      {error ? (
        <p className="text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      {state === "done" ? (
        <p className="text-sm font-medium text-navy" role="status">
          Password changed. Anywhere else you were signed in has been signed
          out.
        </p>
      ) : null}

      <button type="submit" className="btn-secondary" disabled={state === "saving"}>
        {state === "saving" ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

export function DeleteAccount({
  widgets,
  enquiries,
}: {
  widgets: number;
  enquiries: number;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!asking) {
    return (
      <div className="mt-3">
        <button type="button" className="btn-secondary" onClick={() => setAsking(true)}>
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        setError(null);
        const result = await deleteAccountAction(formData);
        if (result.ok) {
          // The session cookie is gone; a full load lands on the signed-out
          // homepage rather than a dashboard that no longer has an account.
          window.location.href = "/";
          return;
        }
        setBusy(false);
        setError(result.error ?? "That didn't work.");
      }}
      className="mt-3 max-w-sm rounded-card border border-coral/40 bg-coral-soft p-4"
    >
      {/* Counted, not described: "3 widgets and 56 enquiries" is a decision
          you can make, "all your data" is one you can only guess at. */}
      <p className="text-sm leading-relaxed text-navy">
        <strong className="font-bold">This deletes everything.</strong>{" "}
        {widgets === 0
          ? "You have no widgets, so there is nothing published to take down."
          : `Your ${widgets} widget${widgets === 1 ? "" : "s"} will stop working
             immediately — any page they're embedded on will show nothing.`}{" "}
        {enquiries > 0
          ? `Your ${enquiries} enquir${enquiries === 1 ? "y" : "ies"} and all
             analytics go with them.`
          : "Your analytics go with them."}{" "}
        We can&rsquo;t undo it.
      </p>

      <label className="label mt-4 block" htmlFor="delete-password">
        Enter your password to confirm
      </label>
      <input
        id="delete-password"
        name="password"
        type="password"
        autoComplete="current-password"
        className="input"
        required
      />

      {error ? (
        <p className="mt-2 text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn bg-coral text-white hover:bg-[#E96A59]"
        >
          {busy ? "Deleting…" : "Delete my account"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setAsking(false);
            setError(null);
          }}
        >
          Keep my account
        </button>
      </div>
    </form>
  );
}
