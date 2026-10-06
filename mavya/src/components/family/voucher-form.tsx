"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import { SCHEMES, type Scheme } from "@/lib/domain/vouchers";
import { submitVoucher } from "@/lib/family/actions";

// Handing a government activity voucher to the school (M7d).
export function VoucherForm({
  kids,
  schemes,
}: {
  kids: { id: string; name: string }[];
  schemes: Scheme[];
}) {
  return (
    <ActionForm action={submitVoucher} submitLabel="Hand it over" pendingLabel="Sending…">
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="childId"
          label="For"
          placeholder="Choose"
          defaultValue={kids.length === 1 ? kids[0]!.id : undefined}
          options={kids.map((k) => ({ value: k.id, label: k.name }))}
        />
        <SelectField
          name="scheme"
          label="Voucher"
          placeholder="Choose"
          defaultValue={schemes.length === 1 ? schemes[0] : undefined}
          options={schemes.map((s) => ({ value: s, label: SCHEMES[s].name }))}
        />
      </div>
      <TextField name="code" label="Voucher code" hint="As it's printed on the voucher." />
    </ActionForm>
  );
}
