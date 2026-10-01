"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { addRestriction, removeRestriction, saveChildHealth } from "@/lib/business/actions";
import type { FormState } from "@/lib/forms";

export function OwnerHealthForm({
  familyId,
  childId,
  allergies,
  medicalNotes,
}: {
  familyId: string;
  childId: string;
  allergies: string | null;
  medicalNotes: string | null;
}) {
  return (
    <ActionForm action={saveChildHealth} submitLabel="Save health notes">
      <input type="hidden" name="familyId" value={familyId} />
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
        hint="Asthma, epilepsy, an EpiPen in their bag: what an instructor needs to know."
      />
    </ActionForm>
  );
}

export function AddRestrictionForm({ familyId, childId }: { familyId: string; childId: string }) {
  return (
    <ActionForm action={addRestriction} submitLabel="Add restriction" pendingLabel="Adding…">
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="childId" value={childId} />
      <TextField name="personName" label="Person's name" />
      <SelectField
        name="kind"
        label="What isn't allowed"
        placeholder="Choose"
        options={[
          { value: "no_collect", label: "May not collect the child" },
          { value: "no_contact", label: "No contact with the child" },
        ]}
      />
      <TextAreaField
        name="details"
        label="Details"
        optional
        maxLength={2000}
        hint="Only owners see this: a court order, who to call. Instructors see the name and the warning."
      />
    </ActionForm>
  );
}

export function RemoveRestrictionButton({
  restrictionId,
  familyId,
  name,
}: {
  restrictionId: string;
  familyId: string;
  name: string;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Remove the restriction on ${name}`}
        onClick={() =>
          start(async () => setState(await removeRestriction(restrictionId, familyId)))
        }
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {state.error ? (
        <span role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </span>
      ) : null}
    </span>
  );
}
