"use client";

// The step-up ceremony itself.
//
// Verifying an MFA challenge issues a new access token carrying aal2, so the
// session cookies have to be replaced before navigating on — otherwise the
// page we return to reads the old aal1 token and bounces straight back here,
// which reads as a broken loop rather than as a security control.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { rpIdFrom, type EnrolledFactor } from "@/lib/auth/mfa";

export function ConfirmPanel({ factors, next }: { factors: EnrolledFactor[]; next: string }) {
  const router = useRouter();
  const passkey = factors.find((f) => f.kind === "passkey");
  const app = factors.find((f) => f.kind === "authenticator");

  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  /** Hand the upgraded tokens to the server, then continue. */
  const land = useCallback(
    async (accessToken: string, refreshToken: string) => {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      });
      if (!res.ok) {
        setProblem("We couldn't finish signing you in. Try once more.");
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    },
    [next, router]
  );

  const withPasskey = useCallback(async () => {
    if (!passkey) return;
    setBusy(true);
    setProblem(null);
    const { data, error } = await browserClient().auth.mfa.webauthn.authenticate({
      factorId: passkey.id,
      webauthn: { rpId: rpIdFrom(window.location.origin), rpOrigins: [window.location.origin] },
    });
    if (error || !data) {
      setProblem("That didn't go through. Nothing has happened.");
      setBusy(false);
      return;
    }
    await land(data.access_token, data.refresh_token);
  }, [passkey, land]);

  const withCode = useCallback(async () => {
    if (!app) return;
    setBusy(true);
    setProblem(null);
    const supabase = browserClient();
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: app.id });
    if (challengeErr || !challenge) {
      setProblem("We couldn't check that code. Try again.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.auth.mfa.verify({
      factorId: app.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error || !data) {
      setProblem("That code didn't match. They expire quickly — try the next one.");
      setCode("");
      setBusy(false);
      return;
    }
    await land(data.access_token, data.refresh_token);
  }, [app, code, land]);

  // A passkey prompt is better offered immediately than behind a button:
  // the browser shows its own dialog, so there is no surprise in it.
  useEffect(() => {
    if (passkey && !app) void withPasskey();
    // Once, on arrival. Re-running would re-prompt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {passkey && (
        <div className="card">
          <h2 className="text-base">Use your passkey</h2>
          <p className="mt-1 text-sm text-stone">Your face, fingerprint or device PIN.</p>
          <button className="btn mt-4" disabled={busy} onClick={() => void withPasskey()}>
            {busy ? "Waiting…" : "Use passkey"}
          </button>
        </div>
      )}

      {app && (
        <div className="card">
          <h2 className="text-base">Or a code from your app</h2>
          <div className="mt-3 flex gap-2">
            <input
              className="input w-40"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-secondary" disabled={busy || code.trim().length < 6} onClick={() => void withCode()}>
              Confirm
            </button>
          </div>
        </div>
      )}

      {problem && <p className="text-sm text-ochre">{problem}</p>}
    </div>
  );
}
