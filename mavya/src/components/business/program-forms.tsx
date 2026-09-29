"use client";

import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { addLevel, createProgram } from "@/lib/business/actions";

export function NewProgramForm() {
  return (
    <ActionForm
      action={createProgram}
      submitLabel="Add program"
      className="rounded-lg border border-line bg-surface p-5"
    >
      <TextField
        name="name"
        label="New program"
        hint="For example: Learn to Swim, Squad, Adult classes."
      />
    </ActionForm>
  );
}

export function NewLevelForm({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  return (
    <ActionForm
      action={addLevel.bind(null, programId)}
      submitLabel={`Add level to ${programName}`}
      pendingLabel="Adding…"
    >
      <TextField
        name="name"
        label="New level"
        hint="Levels are listed in the order you add them."
      />
    </ActionForm>
  );
}
