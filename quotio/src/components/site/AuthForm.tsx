"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAction, signUpAction } from "@/app/actions";

/**
 * Sign in / sign up (brief §27).
 *
 * The "and your work comes with you" line isn't decoration: someone arriving
 * here mid-build has widgets attached to an anonymous session, and telling
 * them that plainly is the difference between finishing and bailing out.
 */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signup = mode === "signup";

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);

        const data = new FormData(event.currentTarget);
        const result = signup ? await signUpAction(data) : await signInAction(data);

        if (result.ok) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        setError(result.error ?? "That didn't work.");
        setBusy(false);
      }}
    >
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" required className="input" />
      </label>

      <label className="block">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 8 : undefined}
          className="input"
        />
        {signup ? (
          <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
        ) : null}
      </label>

      {error ? (
        <p className="text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn w-full" disabled={busy}>
        {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
      </button>

      <p className="pt-2 text-center text-sm text-slate">
        {signup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-purple hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-purple hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
