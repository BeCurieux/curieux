"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SelectField } from "@/components/forms/field";
import { enrolChild } from "@/lib/business/actions";

export function EnrolForm({
  classId,
  options,
}: {
  classId: string;
  options: { id: string; name: string; family: string }[];
}) {
  return (
    <ActionForm
      action={enrolChild.bind(null, classId)}
      submitLabel="Enrol"
      pendingLabel="Enrolling…"
    >
      <SelectField
        name="childId"
        label="Enrol a child"
        placeholder="Choose a child"
        options={options.map((c) => ({ value: c.id, label: `${c.name} · ${c.family}` }))}
      />
    </ActionForm>
  );
}
