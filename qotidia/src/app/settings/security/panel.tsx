"use client";

// Enrolling and removing second factors.
//
// A client component because both ceremonies are browser APIs: the passkey
// flow reaches for navigator.credentials, and the authenticator flow shows a
// QR code the phone camera reads. Neither can happen on the server.
//
// The enrolment states are modelled explicitly rather than with a pile of
// booleans, because the failure mode this most needs to avoid is a screen
// that says a passkey was added when the browser prompt was dismissed.

import { useCallback, useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
import {
  defaultFactorName,
  FACTOR_BLURB,
  FACTOR_LABEL,
  isLastFactor,
  rpIdFrom,
  SUPABASE_FACTOR_TYPE,
  type EnrolledFactor,
  type SecondFactorKind,
} from "@/lib/auth/mfa";

type Stage =
  | { at: "idle" }
  | { at: "working"; kind: SecondFactorKind }
  /** TOTP only: the secret is on screen and waiting for the first code. */
  | { at: "confirming"; factorId: string; qr: string; secret: string }
  | { at: "failed"; message: string };

export function SecurityPanel({ factors: initial }: { factors: EnrolledFactor[] }) {
  const [factors, setFactors] = useState(initial);
  const [stage, setStage] = useState<Stage>({ at: "idle" });
  const [code, setCode] = useState("");

  const addPasskey = useCallback(async () => {
    setStage({ at: "working", kind: "passkey" });
    const supabase = browserClient();
    // register() does enrol -> challenge -> navigator.credentials.create ->
    // verify in one call. Hand-rolling those four steps is where the rpId
    // gets passed inconsistently between the challenge and the verify, which
    // produces a credential that enrols cleanly and then never works again.
    const { data, error } = await supabase.auth.mfa.webauthn.register({
      friendlyName: defaultFactorName("passkey", factors),
      webauthn: { rpId: rpIdFrom(window.location.origin), rpOrigins: [window.location.origin] },
    });

    if (error || !data) {
      // A dismissed browser prompt is not a failure worth alarming anyone
      // about — it is someone changing their mind, and it must not read as
      // either an error or a success.
      const name = (error as { name?: string } | null)?.name ?? "";
      setStage({
        at: "failed",
        message: /NotAllowed|Abort|cancel/i.test(name + String(error?.message ?? ""))
          ? "That was cancelled. Nothing changed."
          : "Your browser or device couldn't make a passkey. An authenticator app works everywhere.",
      });
      return;
    }

    // Read the new factor back off the returned user rather than assuming
    // what was created — the same discipline as everywhere else here.
    const created = (data.user?.factors ?? []).find(
      (f) => f.factor_type === "webauthn" && f.status === "verified" && !factors.some((x) => x.id === f.id)
    );
    setFactors((prev) => [
      ...prev,
      {
        id: created?.id ?? "",
        kind: "passkey",
        friendlyName: created?.friendly_name ?? null,
        addedAt: created?.created_at ?? new Date().toISOString(),
      },
    ]);
    setStage({ at: "idle" });
  }, [factors]);

  const addAuthenticator = useCallback(async () => {
    setStage({ at: "working", kind: "authenticator" });
    const supabase = browserClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: SUPABASE_FACTOR_TYPE.authenticator,
      friendlyName: defaultFactorName("authenticator", factors),
      issuer: BRAND,
    });
    if (error || !data) {
      setStage({ at: "failed", message: "We couldn't set that up. Try again in a moment." });
      return;
    }
    setStage({ at: "confirming", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }, [factors]);

  const confirmAuthenticator = useCallback(async () => {
    if (stage.at !== "confirming") return;
    const supabase = browserClient();
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: stage.factorId,
    });
    if (challengeErr || !challenge) {
      setStage({ at: "failed", message: "We couldn't check that code. Try again." });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: stage.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) {
      // Stay on the confirming screen: the secret is still valid and the
      // usual cause is a code that expired while it was being typed.
      setCode("");
      return;
    }
    setFactors((prev) => [
      ...prev,
      { id: stage.factorId, kind: "authenticator", friendlyName: null, addedAt: new Date().toISOString() },
    ]);
    setCode("");
    setStage({ at: "idle" });
  }, [stage, code]);

  const remove = useCallback(async (factorId: string) => {
    const last = isLastFactor(factors, factorId);
    const message = last
      ? "This is the only thing protecting your archive beyond your password. Remove it?"
      : "Remove this?";
    if (!window.confirm(message)) return;
    const { error } = await browserClient().auth.mfa.unenroll({ factorId });
    if (error) {
      setStage({ at: "failed", message: "We couldn't remove that. Try again in a moment." });
      return;
    }
    setFactors((prev) => prev.filter((f) => f.id !== factorId));
  }, [factors]);

  if (stage.at === "confirming") {
    return (
      <div className="card max-w-lg">
        <h2 className="text-lg">Point your authenticator app at this</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone">
          Then type the six digits it shows, to prove it worked.
        </p>
        <img
          src={`data:image/svg+xml;utf-8,${encodeURIComponent(stage.qr)}`}
          alt=""
          className="mt-4 h-44 w-44 bg-white p-2"
        />
        <details className="mt-3 text-xs text-stone">
          <summary className="cursor-pointer">Can&rsquo;t scan it?</summary>
          <code className="mt-2 block break-all">{stage.secret}</code>
        </details>
        <div className="mt-4 flex gap-2">
          <input
            className="input w-40"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" onClick={() => void confirmAuthenticator()} disabled={code.trim().length < 6}>
            Confirm
          </button>
          <button className="btn-secondary" onClick={() => { setCode(""); setStage({ at: "idle" }); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {factors.length > 0 ? (
        <ul className="space-y-2">
          {factors.map((f) => (
            <li key={f.id} className="card flex items-center justify-between gap-4 !p-4">
              <span>
                <span className="block">{f.friendlyName ?? FACTOR_LABEL[f.kind]}</span>
                <span className="mt-0.5 block text-xs text-stone">
                  {f.kind === "passkey" ? "A passkey on one of your devices" : "A code from your authenticator app"}
                </span>
              </span>
              <button className="text-sm text-stone underline" onClick={() => void remove(f.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-[54ch] text-sm leading-relaxed text-stone">
          Right now your password is the only thing in the way. Adding one of
          these takes about twenty seconds and you rarely see it again.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(["passkey", "authenticator"] as SecondFactorKind[]).map((kind) => (
          <div key={kind} className="card">
            <h3 className="text-base">
              {FACTOR_LABEL[kind]}
              {kind === "passkey" && <span className="ml-2 text-xs text-ochre">Recommended</span>}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-stone">{FACTOR_BLURB[kind]}</p>
            <button
              className={kind === "passkey" ? "btn mt-4" : "btn-secondary mt-4"}
              disabled={stage.at === "working"}
              onClick={() => void (kind === "passkey" ? addPasskey() : addAuthenticator())}
            >
              {stage.at === "working" && stage.kind === kind ? "Waiting…" : `Add ${kind === "passkey" ? "a passkey" : "an app"}`}
            </button>
          </div>
        ))}
      </div>

      {stage.at === "failed" && (
        <p className="mt-4 text-sm text-ochre">{stage.message}</p>
      )}
    </div>
  );
}
