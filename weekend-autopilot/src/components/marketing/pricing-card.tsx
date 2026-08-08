"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Offer } from "@/lib/billing/plans";
import { Button, Card, SectionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * PricingCard (§37).
 *
 * The price label comes from the server, which reads it from Stripe — the
 * displayed price and the charged price must be the same number, and hard-
 * coding "A$29" in a component is how those drift apart.
 */
export function PricingCard({
  offer,
  highlighted,
  priceLabel,
}: {
  offer: Offer;
  highlighted?: boolean;
  priceLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: offer.tier }),
      });
      const body = (await response.json()) as { url?: string; error?: string };

      if (body.url) {
        window.location.href = body.url;
        return;
      }
      // Without Stripe configured (local development) we send people through
      // signup so the rest of the flow is still walkable.
      if (response.status === 503) {
        router.push(`/signup?tier=${offer.tier}`);
        return;
      }
      setError(body.error ?? "Something went wrong. Try again in a moment.");
    } catch {
      setError("Couldn’t reach the checkout. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "flex flex-col p-6",
        highlighted && "border-forest/30 bg-sage/40 shadow-lift"
      )}
    >
      <SectionLabel>{highlighted ? "Start here" : "Later"}</SectionLabel>

      <h3 className="mt-2 text-[23px] leading-tight text-ink">{offer.name}</h3>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[38px] leading-none text-ink">
          {priceLabel ?? offer.fallbackPriceLabel}
        </span>
        <span className="text-[15px] text-mist">
          {offer.mode === "payment" ? "one payment" : offer.tier === "ANNUAL" ? "a year" : "a month"}
        </span>
      </p>

      <p className="mt-3 text-[15px] leading-relaxed text-graphite">{offer.description}</p>

      <ul className="mt-5 space-y-2 text-[15px] leading-relaxed text-graphite">
        {offer.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-1">
        <Button onClick={start} disabled={busy} block variant={highlighted ? "primary" : "secondary"}>
          {busy ? "Just a moment…" : offer.mode === "payment" ? "Plan my next 4 weekends" : "Choose this"}
        </Button>
        {error ? (
          <p role="alert" className="mt-3 text-[14px] text-clay">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
