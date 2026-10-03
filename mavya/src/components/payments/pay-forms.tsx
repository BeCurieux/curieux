"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { payOnline, setUpPayments } from "@/lib/payments/actions";

// The buttons that take someone to Stripe (M7b).

function Problem({ state }: { state: FormState }) {
  return state.error ? (
    <p role="alert" className="text-sm font-semibold text-danger">
      {state.error}
    </p>
  ) : null;
}

export function SetUpPaymentsButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState(setUpPayments, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Opening Stripe…" : label}
      </Button>
      <Problem state={state} />
    </form>
  );
}

export function PayButton({ familyId, amount }: { familyId: string; amount: string }) {
  const [state, action, pending] = useActionState(payOnline.bind(null, familyId), {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="warm" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Opening secure payment…" : `Pay ${amount}`}
      </Button>
      <Problem state={state} />
    </form>
  );
}
