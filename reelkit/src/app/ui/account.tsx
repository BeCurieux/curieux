"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

export type Me = {
  accounts: boolean;
  payments: boolean;
  ai: boolean;
  freeCredits: number;
  packs: { id: string; name: string; credits: number; price: string }[];
  viewer: { email: string | null } | null;
  credits?: number;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok) setMe((await res.json()) as Me);
    } catch {
      // Offline: keep what we had.
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { me, refresh, setCredits: (credits: number) => setMe((m) => (m ? { ...m, credits } : m)) };
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button type="button" className="ghost close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
};

export function SignIn({ open, onClose, onSignedIn, me, reason }: { open: boolean; onClose: () => void; onSignedIn: () => void; me: Me; reason?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/auth/start", { email });
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "We couldn't send the code."));
    setStage("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post("/api/auth/verify", { email, code });
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "That code didn't work."));
    setStage("email");
    setCode("");
    onSignedIn();
  }

  return (
    <Dialog open={open} onClose={onClose} title={stage === "email" ? "Sign in or sign up" : "Check your email"}>
      {stage === "email" ? (
        <form onSubmit={send} className="stack">
          <p className="note">
            {reason ?? "Use your email — no password."} New here? Your first {me.freeCredits} sets of ads are free.
          </p>
          <label className="field">
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="note">
            We sent a code to <strong>{email}</strong>. Enter it here, or tap the link in the email.
          </p>
          <label className="field">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="link" onClick={() => setStage("email")}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </Dialog>
  );
}

export function BuyCredits({ open, onClose, me, reason }: { open: boolean; onClose: () => void; me: Me; reason?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(pack: string) {
    setBusy(pack);
    setError(null);
    const r = await post("/api/billing/checkout", { pack });
    if (r.ok && typeof r.data.url === "string") {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(null);
    setError(String(r.data.error ?? "Checkout couldn't start."));
  }

  return (
    <Dialog open={open} onClose={onClose} title="Get more credits">
      <p className="note">{reason ?? "One credit makes one set of three AI-written ads. Downloads are always free."}</p>
      {me.payments ? (
        <div className="packs">
          {me.packs.map((p) => (
            <button key={p.id} type="button" className="pack" onClick={() => buy(p.id)} disabled={busy !== null}>
              <span className="pack-name">{p.name}</span>
              <span className="pack-credits">{p.credits} credits</span>
              <span className="pack-price">{busy === p.id ? "Opening…" : p.price}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="note">Buying credits isn't open yet.</p>
      )}
      <p className="note">One-off payments through Stripe. No subscription; credits don't expire.</p>
      {error && <p className="error">{error}</p>}
    </Dialog>
  );
}

export function AccountBar({ me, onSignIn, onBuy, onSignedOut }: { me: Me | null; onSignIn: () => void; onBuy: () => void; onSignedOut: () => void }) {
  if (!me?.accounts) return null;
  if (!me.viewer) {
    return (
      <div className="account">
        <button type="button" className="ghost" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    );
  }
  return (
    <div className="account">
      <span className="credits" title={me.viewer.email ?? undefined}>
        {me.credits ?? 0} {me.credits === 1 ? "credit" : "credits"}
      </span>
      {me.payments && (
        <button type="button" className="ghost" onClick={onBuy}>
          Buy credits
        </button>
      )}
      <button
        type="button"
        className="link"
        onClick={async () => {
          await post("/api/auth/sign-out", {});
          onSignedOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
