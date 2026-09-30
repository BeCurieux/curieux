"use client";

import { useActionState } from "react";
import { ActionForm, FormShell } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import {
  cancelLessons,
  previewCancelLessons,
  saveMakeupPolicy,
  type CancelState,
} from "@/lib/business/actions";
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

// Two steps: see what cancelling a day would affect, then confirm. Nothing
// changes until the second step.
export function CancelLessonsForm({ locations, today }: { locations: Location[]; today: string }) {
  const [checked, check, checking] = useActionState(previewCancelLessons, {} as CancelState);
  const preview = checked.preview;
  const place = locations.find((l) => l.id === checked.locationId)?.name;
  return (
    <div className="flex flex-col gap-6">
      <FormShell
        action={check}
        state={checked}
        pending={checking}
        submitLabel="Check what this affects"
        pendingLabel="Checking…"
      >
        <SelectField
          name="locationId"
          label="Location"
          defaultValue={checked.locationId ?? (locations.length === 1 ? locations[0]!.id : "")}
          placeholder="Choose a location"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
        />
        <TextField name="date" label="Date" type="date" defaultValue={checked.date ?? today} />
      </FormShell>

      {preview ? (
        <section
          aria-labelledby="preview"
          className="flex flex-col gap-4 rounded-lg border-2 border-ink bg-surface p-5"
        >
          <h2 id="preview" className="font-display text-xl font-semibold">
            Cancelling {place} on {checked.date} will:
          </h2>
          <ul className="flex flex-col gap-2 text-lg">
            <li>
              cancel <strong>{count(preview.lessons, "lesson")}</strong>
            </li>
            <li>
              affect <strong>{count(preview.children, "child", "children")}</strong> in{" "}
              <strong>{count(preview.families, "family", "families")}</strong>, who are told in the
              app
            </li>
            <li>
              issue <strong>{count(preview.credits, "make-up credit")}</strong>
            </li>
            {preview.makeups > 0 ? (
              <li>
                cancel <strong>{count(preview.makeups, "booked make-up")}</strong> and give the
                credits back
              </li>
            ) : null}
          </ul>
          <ActionForm
            action={cancelLessons}
            submitLabel={`Cancel ${count(preview.lessons, "lesson")}`}
            pendingLabel="Cancelling…"
          >
            <input type="hidden" name="locationId" value={checked.locationId} />
            <input type="hidden" name="date" value={checked.date} />
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
