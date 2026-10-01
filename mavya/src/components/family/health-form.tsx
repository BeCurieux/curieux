"use client";

import { ActionForm } from "@/components/forms/action-form";
import { TextAreaField } from "@/components/forms/field";
import { saveChildHealth } from "@/lib/family/actions";

// A parent's health notes for their child.
export function HealthForm({
  childId,
  allergies,
  medicalNotes,
}: {
  childId: string;
  allergies: string | null;
  medicalNotes: string | null;
}) {
  return (
    <ActionForm action={saveChildHealth} submitLabel="Save health notes" variant="warm">
      <input type="hidden" name="childId" value={childId} />
      <TextAreaField
        name="allergies"
        label="Allergies"
        optional
        maxLength={1000}
        defaultValue={allergies}
      />
      <TextAreaField
        name="medicalNotes"
        label="Medical notes"
        optional
        maxLength={2000}
        defaultValue={medicalNotes}
        hint="Anything their instructor should know, like asthma or an EpiPen in their bag."
      />
    </ActionForm>
  );
}
