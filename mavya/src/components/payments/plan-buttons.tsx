"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { managePlan, startPlan, updatePlanLocations } from "@/lib/payments/plan-actions";

// The buttons on the Ovyko plan page (docs/SUBSCRIPTIONS.md).

function Note({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm font-semibold text-[#23694c]">
        {state.ok}
      </p>
    );
  return null;
}

function ActionButton({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: () => Promise<FormState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "soft";
}) {
  const [state, run, pending] = useActionState(action, {} as FormState);
  return (
    <form action={run} className="flex flex-col gap-2">
      <Button type="submit" variant={variant} disabled={pending} className="w-fit">
        {pending ? pendingLabel : label}
      </Button>
      <Note state={state} />
    </form>
  );
}

export const StartPlanButton = ({ label }: { label: string }) => (
  <ActionButton action={startPlan} label={label} pendingLabel="Opening Stripe…" />
);

export const ManagePlanButton = () => (
  <ActionButton
    action={managePlan}
    label="Card, invoices and cancelling"
    pendingLabel="Opening Stripe…"
    variant="soft"
  />
);

export const UpdateLocationsButton = ({ label }: { label: string }) => (
  <ActionButton
    action={updatePlanLocations}
    label={label}
    pendingLabel="Updating…"
    variant="soft"
  />
);
