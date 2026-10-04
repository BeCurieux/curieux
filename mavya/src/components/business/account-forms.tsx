"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import { SettingSwitch } from "@/components/forms/setting-switch";
import { Button } from "@/components/ui/button";
import {
  addAccountLine,
  cancelAccountLine,
  createTermFees,
  recordPayment,
  setFeeReminders,
} from "@/lib/business/actions";
import type { FormState } from "@/lib/forms";

// Owners' account forms (M7a).

export function RecordPaymentForm({ familyId, today }: { familyId: string; today: string }) {
  return (
    <ActionForm action={recordPayment.bind(null, familyId)} submitLabel="Record payment">
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField name="amount" label="Amount ($)" inputMode="decimal" />
        <SelectField
          name="method"
          label="Paid by"
          placeholder="Choose"
          options={[
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "card", label: "Card" },
            { value: "cash", label: "Cash" },
            { value: "other", label: "Other" },
          ]}
        />
        <TextField name="paidOn" label="Date paid" type="date" defaultValue={today} />
      </div>
      <TextField name="note" label="Note" optional />
    </ActionForm>
  );
}

export function AddLineForm({ familyId }: { familyId: string }) {
  return (
    <ActionForm action={addAccountLine.bind(null, familyId)} submitLabel="Add to account">
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_2fr]">
        <SelectField
          name="kind"
          label="Type"
          placeholder="Choose"
          options={[
            { value: "credit", label: "Credit" },
            { value: "charge", label: "Charge" },
          ]}
        />
        <TextField name="amount" label="Amount ($)" inputMode="decimal" />
        <TextField name="reason" label="Reason" hint="Families see this on their statement." />
      </div>
    </ActionForm>
  );
}

// "Cancel" opens a reason box; the line stays, struck through, with its
// opposite added.
export function CancelLine({
  familyId,
  lineId,
  label,
}: {
  familyId: string;
  lineId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="w-fit"
        aria-label={`Cancel ${label}`}
        onClick={() => setOpen(true)}
      >
        Cancel this line
      </Button>
    );
  return (
    <ActionForm
      action={cancelAccountLine.bind(null, familyId, lineId)}
      submitLabel="Cancel line"
      pendingLabel="Cancelling…"
      className="rounded-md bg-surface-soft p-4"
    >
      <TextField name="reason" label="Why?" hint="Shown on the statement." />
    </ActionForm>
  );
}

export function CreateTermFeesButton({ termId }: { termId: string }) {
  const [state, action, pending] = useActionState(
    createTermFees.bind(null, termId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Working out fees…" : "Create term fees"}
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

// Fee reminders by email (M7c), on or off for the whole school.
export function FeeRemindersSwitch({ on }: { on: boolean }) {
  return (
    <SettingSwitch on={on} title="Email fee reminders" save={setFeeReminders}>
      A week before fees are due, on the day, and a week and two weeks after if they&apos;re still
      unpaid. Families who&apos;ve paid get nothing.
    </SettingSwitch>
  );
}
