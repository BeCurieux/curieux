"use client";

import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { saveChild, saveFamily } from "@/lib/business/actions";
import type { ChildRecord, FamilyRecord } from "@/lib/domain/families";

export function FamilyForm({ family }: { family?: FamilyRecord }) {
  return (
    <ActionForm
      action={saveFamily.bind(null, family?.id ?? null)}
      submitLabel={family ? "Save family" : "Add family"}
    >
      <TextField
        name="displayName"
        label="Family name"
        hint="For example: Burrows Family."
        defaultValue={family?.displayName}
      />
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 font-display text-xl font-semibold">Main contact</legend>
        <TextField
          name="contactName"
          label="Name"
          optional
          defaultValue={family?.contactName}
          autoComplete="off"
        />
        <TextField
          name="contactEmail"
          label="Email"
          type="email"
          inputMode="email"
          optional
          hint="They'll be invited to the Oviko app once invites are available."
          defaultValue={family?.contactEmail}
          autoComplete="off"
        />
        <TextField
          name="contactPhone"
          label="Phone"
          type="tel"
          inputMode="tel"
          optional
          defaultValue={family?.contactPhone}
          autoComplete="off"
        />
      </fieldset>
    </ActionForm>
  );
}

export function ChildForm({ familyId, child }: { familyId: string; child?: ChildRecord }) {
  return (
    <ActionForm
      action={saveChild.bind(null, familyId, child?.id ?? null)}
      submitLabel={child ? "Save child" : "Add child"}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="First name"
          defaultValue={child?.firstName}
          autoComplete="off"
        />
        <TextField
          name="lastName"
          label="Last name"
          defaultValue={child?.lastName}
          autoComplete="off"
        />
      </div>
      <TextField
        name="dateOfBirth"
        label="Date of birth"
        type="date"
        defaultValue={child?.dateOfBirth}
      />
    </ActionForm>
  );
}
