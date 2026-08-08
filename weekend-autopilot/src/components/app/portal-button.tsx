"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** Opens the Stripe Customer Portal (§29). */
export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const body = (await response.json()) as { url?: string; error?: string };
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error ?? "Couldn’t open billing just now.");
    setBusy(false);
  }

  return (
    <div>
      <Button variant="secondary" onClick={open} disabled={busy}>
        {busy ? "Opening…" : "Manage payment and billing"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-[14px] text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}
