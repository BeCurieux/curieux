"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { declineVoucher, redeemVoucher, setVoucherSchemes } from "@/lib/business/actions";
import { SCHEME_IDS, SCHEMES, type Scheme, type Voucher } from "@/lib/domain/vouchers";

// Owners' voucher forms (M7d).

const dollars = (cents: number) => `$${cents / 100}`;

export function VoucherSchemesForm({ selected }: { selected: Scheme[] }) {
  return (
    <ActionForm action={setVoucherSchemes} submitLabel="Save vouchers">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm text-muted">
          Tick the schemes you&apos;re a registered provider for.
        </legend>
        {SCHEME_IDS.map((id) => (
          <label key={id} className="flex items-center gap-3 text-lg">
            <input
              type="checkbox"
              name="scheme"
              value={id}
              defaultChecked={selected.includes(id)}
              className="size-5 accent-ink"
            />
            <span>
              {SCHEMES[id].name}{" "}
              <span className="text-sm text-muted">up to {dollars(SCHEMES[id].maxCents)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </ActionForm>
  );
}

export function VoucherDecision({ voucher }: { voucher: Voucher }) {
  const [declining, setDeclining] = useState(false);
  const max = SCHEMES[voucher.scheme].maxCents;
  return (
    <div className="flex flex-col gap-3">
      <ActionForm
        action={redeemVoucher.bind(null, voucher.id)}
        submitLabel="Redeemed"
        pendingLabel="Saving…"
      >
        <TextField
          name="amount"
          label="Amount the voucher gave ($)"
          inputMode="decimal"
          defaultValue={String(max / 100)}
          hint={`Redeem it in the government's portal first. Up to ${dollars(max)}.`}
        />
      </ActionForm>
      {declining ? (
        <ActionForm
          action={declineVoucher.bind(null, voucher.id)}
          submitLabel="Decline voucher"
          pendingLabel="Declining…"
          className="rounded-md bg-surface-soft p-4"
        >
          <TextField name="reason" label="Why?" hint="The family sees this." />
        </ActionForm>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setDeclining(true)}
        >
          Can&apos;t redeem it?
        </Button>
      )}
    </div>
  );
}
