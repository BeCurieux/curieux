"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import {
  addToWaitingList,
  offerPlaceTo,
  placeChild,
  removeFromEnquiries,
  withdrawOffer,
} from "@/lib/wishes/actions";

// Enrolling a child from their family's request (M8b).
export function PlaceButton({
  wishId,
  classId,
  label,
}: {
  wishId: string;
  classId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    placeChild.bind(null, wishId, classId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" size="sm" disabled={pending || Boolean(state.ok)} className="w-fit">
        {pending ? "Enrolling…" : label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-semibold text-[#23694c]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

// A one-tap owner action with its result shown under the button (M8c).
function ActionButton({
  run,
  label,
  pendingLabel,
  variant = "primary",
}: {
  run: () => Promise<FormState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "soft";
}) {
  const [state, action, pending] = useActionState(run, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button
        type="submit"
        size="sm"
        variant={variant}
        disabled={pending || Boolean(state.ok)}
        className="w-fit"
      >
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-semibold text-[#23694c]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

export function OfferButton({ wishId, classId }: { wishId: string; classId: string }) {
  return (
    <ActionButton
      run={offerPlaceTo.bind(null, wishId, classId)}
      label="Offer the place"
      pendingLabel="Offering…"
      variant="soft"
    />
  );
}

export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  return (
    <ActionButton
      run={withdrawOffer.bind(null, offerId)}
      label="Withdraw"
      pendingLabel="Withdrawing…"
      variant="soft"
    />
  );
}

export function AddEnquiryButton({ enquiryId }: { enquiryId: string }) {
  return (
    <ActionButton
      run={addToWaitingList.bind(null, enquiryId)}
      label="Add to the waiting list"
      pendingLabel="Adding…"
    />
  );
}

export function RemoveEnquiryButton({ enquiryId }: { enquiryId: string }) {
  return (
    <ActionButton
      run={removeFromEnquiries.bind(null, enquiryId)}
      label="Remove"
      pendingLabel="Removing…"
      variant="soft"
    />
  );
}
