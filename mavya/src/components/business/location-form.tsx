"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import { saveLocation } from "@/lib/business/actions";
import type { Location } from "@/lib/domain/timetable";

const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Perth",
  "Australia/Hobart",
  "Pacific/Auckland",
];

export function LocationForm({ location }: { location?: Location }) {
  return (
    <ActionForm
      action={saveLocation.bind(null, location?.id ?? null)}
      submitLabel={location ? "Save location" : "Add location"}
    >
      <TextField name="name" label="Name" defaultValue={location?.name} />
      <TextField
        name="addressLine1"
        label="Street address"
        optional
        defaultValue={location?.addressLine1}
        autoComplete="address-line1"
      />
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
        <TextField name="suburb" label="Suburb" optional defaultValue={location?.suburb} />
        <TextField name="state" label="State" optional defaultValue={location?.state} />
        <TextField
          name="postcode"
          label="Postcode"
          optional
          defaultValue={location?.postcode}
          inputMode="numeric"
        />
      </div>
      <SelectField
        name="timezone"
        label="Timezone"
        hint="Lesson times are shown in this timezone."
        defaultValue={location?.timezone ?? "Australia/Sydney"}
        options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace("_", " ") }))}
      />
    </ActionForm>
  );
}
