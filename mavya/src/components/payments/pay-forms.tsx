"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { SettingSwitch } from "@/components/forms/setting-switch";
import {
  payInInstalments,
  payOnline,
  payRestOfPlan,
  setInstalments,
  setUpPayments,
} from "@/lib/payments/actions";

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

export function InstalmentsSwitch({ on }: { on: boolean }) {
  return (
    <SettingSwitch on={on} title="Instalments" save={setInstalments}>
      Families who owe $100 or more can pay in 2 payments four weeks apart, or 4 payments a
      fortnight apart, at no extra cost. Ovyko takes each one on its date; if one fails, the rest is
      simply owed.
    </SettingSwitch>
  );
}

// A family pays in 2 or 4 payments: the first now, the rest on their dates.
export function InstalmentButtons({
  familyId,
  options,
}: {
  familyId: string;
  options: { payments: 2 | 4; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    (_: FormState, form: FormData) => payInInstalments(familyId, Number(form.get("payments"))),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {options.map((o) => (
          <Button
            key={o.payments}
            type="submit"
            name="payments"
            value={o.payments}
            variant="soft"
            disabled={pending}
            className="w-full sm:w-fit"
          >
            {o.label}
          </Button>
        ))}
      </div>
      {pending ? <p className="text-sm text-muted">Opening secure payment…</p> : null}
      <Problem state={state} />
    </form>
  );
}

export function PayRestButton({ familyId, amount }: { familyId: string; amount: string }) {
  const [state, action, pending] = useActionState(
    payRestOfPlan.bind(null, familyId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="soft" disabled={pending} className="w-full sm:w-fit">
        {pending ? "Opening secure payment…" : `Pay the rest now: ${amount}`}
      </Button>
      <Problem state={state} />
    </form>
  );
}
