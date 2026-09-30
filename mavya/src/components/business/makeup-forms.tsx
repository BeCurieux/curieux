"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import { cancelLessons, saveMakeupPolicy } from "@/lib/business/actions";
import type { MakeupPolicy } from "@/lib/domain/makeups";
import type { Location } from "@/lib/domain/timetable";

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export function MakeupPolicyForm({ policy }: { policy: MakeupPolicy }) {
  return (
    <ActionForm action={saveMakeupPolicy} submitLabel="Save rules">
      <SelectField
        name="makeupsEnabled"
        label="Offer make-ups"
        defaultValue={policy.makeupsEnabled ? "yes" : "no"}
        options={yesNo}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="noticeHours"
          label="Notice needed (hours)"
          hint="How long before class a parent must tell you to get a credit."
          type="number"
          inputMode="numeric"
          min={0}
          max={168}
          defaultValue={Math.round(policy.minimumNoticeMinutes / 60)}
        />
        <TextField
          name="creditValidityDays"
          label="A credit lasts (days)"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          defaultValue={policy.creditValidityDays}
        />
        <TextField
          name="maxActiveCredits"
          label="Most credits a child can hold"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          defaultValue={policy.maxActiveCredits}
        />
        <TextField
          name="bookingHorizonDays"
          label="Book up to (days ahead)"
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          defaultValue={policy.bookingHorizonDays}
        />
        <TextField
          name="cancellationNoticeHours"
          label="Cancel a make-up (hours before)"
          hint="With this much notice, the credit comes back."
          type="number"
          inputMode="numeric"
          min={0}
          max={168}
          defaultValue={Math.round(policy.cancellationNoticeMinutes / 60)}
        />
        <SelectField
          name="allowFutureLevel"
          label="Allow the next level up"
          defaultValue={policy.allowFutureLevel ? "yes" : "no"}
          options={yesNo}
        />
      </div>
    </ActionForm>
  );
}

export function CancelLessonsForm({ locations, today }: { locations: Location[]; today: string }) {
  return (
    <ActionForm action={cancelLessons} submitLabel="Cancel lessons" pendingLabel="Cancelling…">
      <SelectField
        name="locationId"
        label="Location"
        defaultValue={locations.length === 1 ? locations[0]!.id : ""}
        placeholder="Choose a location"
        options={locations.map((l) => ({ value: l.id, label: l.name }))}
      />
      <TextField name="date" label="Date" type="date" defaultValue={today} />
    </ActionForm>
  );
}
