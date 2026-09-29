"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { bookMakeup, cancelMakeup, withdrawAbsence } from "@/lib/family/actions";
import type { FormState } from "@/lib/forms";

function Message({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]">
        {state.ok}
      </p>
    );
  return null;
}

// The sticky bar that confirms a make-up. The database checks the booking
// again; a refusal (someone took the last place) is shown here.
export function ConfirmMakeup({
  creditId,
  occurrenceId,
  summary,
  child,
}: {
  creditId: string;
  occurrenceId: string;
  summary: string;
  child: string;
}) {
  const [state, action, pending] = useActionState(
    bookMakeup.bind(null, creditId, occurrenceId),
    {} as FormState,
  );
  return (
    <form
      action={action}
      className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-lg bg-ink p-4 text-white shadow-2xl"
    >
      <Message state={state} />
      <p className="text-center">
        <span className="text-white/70">{child} · </span>
        <span className="font-semibold">{summary}</span>
      </p>
      <Button type="submit" variant="warm" size="lg" disabled={pending}>
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}

export function CancelMakeup({ bookingId, label }: { bookingId: string; label: string }) {
  const [state, action, pending] = useActionState(
    cancelMakeup.bind(null, bookingId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Message state={state} />
      {state.ok ? null : (
        <Button type="submit" variant="soft" size="lg" disabled={pending} aria-label={label}>
          {pending ? "Cancelling…" : "Cancel make-up"}
        </Button>
      )}
    </form>
  );
}

export function WithdrawAbsence({ absenceId, label }: { absenceId: string; label: string }) {
  const [state, action, pending] = useActionState(
    withdrawAbsence.bind(null, absenceId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Message state={state} />
      {state.ok ? null : (
        <Button type="submit" variant="soft" size="lg" disabled={pending} aria-label={label}>
          {pending ? "Updating…" : "We can make it after all"}
        </Button>
      )}
    </form>
  );
}
