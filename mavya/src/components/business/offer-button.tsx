"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { offerSpot } from "@/lib/business/actions";
import type { FormState } from "@/lib/forms";

// Offers one open spot to one family. Once offered it shows so; a refusal
// (the spot went, the credit no longer fits) is shown in place.
export function OfferButton({
  occurrenceId,
  childId,
  name,
}: {
  occurrenceId: string;
  childId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    offerSpot.bind(null, occurrenceId, childId),
    {} as FormState,
  );
  if (state.ok) return <OfferState status="offered" />;
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <Button type="submit" size="sm" disabled={pending} aria-label={`Offer spot to ${name}`}>
        {pending ? "Offering…" : "Offer spot"}
      </Button>
      {state.error ? (
        <p role="alert" className="max-w-48 text-right text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

const LABELS = {
  offered: "Offered",
  claimed: "Claimed",
  declined: "Said no",
  expired: "Expired",
  filled: "Spot filled",
} as const;

export function OfferState({ status }: { status: keyof typeof LABELS }) {
  const good = status === "offered" || status === "claimed";
  return (
    <span
      className={
        good
          ? "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#dcf1e7] px-4 text-sm font-semibold text-[#23694c]"
          : "inline-flex h-10 shrink-0 items-center rounded-full bg-surface-soft px-4 text-sm font-semibold text-muted"
      }
    >
      {good ? <Check aria-hidden className="size-4" strokeWidth={3} /> : null}
      {LABELS[status]}
    </span>
  );
}
