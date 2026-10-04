"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import type { WishChoices } from "@/lib/domain/wishes";
import type { FormState } from "@/lib/forms";
import { askForTimes, withdrawRequest } from "@/lib/wishes/actions";

// A family asking their school for times that suit (M8b).

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WishForm({
  childId,
  path,
  choices,
}: {
  childId: string;
  path: string;
  choices: WishChoices;
}) {
  return (
    <ActionForm
      action={askForTimes.bind(null, childId, path)}
      submitLabel="Send to your activity provider"
      pendingLabel="Sending…"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Days that work</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label
              key={d}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
            >
              <input type="checkbox" name="weekdays" value={i + 1} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="earliest" label="Earliest start" type="time" defaultValue="15:30" />
        <TextField name="latest" label="Latest start" type="time" defaultValue="18:00" />
      </div>
      <SelectField
        name="levelId"
        label="Level"
        optional
        placeholder="Not sure"
        options={choices.levels.map((l) => ({ value: l.id, label: l.name, group: l.program }))}
      />
      {choices.locations.length > 1 ? (
        <SelectField
          name="locationId"
          label="Location"
          optional
          placeholder="Any"
          options={choices.locations.map((l) => ({ value: l.id, label: l.name }))}
        />
      ) : null}
      <TextAreaField name="note" label="Anything else?" optional maxLength={200} />
    </ActionForm>
  );
}

export function WithdrawWish({ wishId, path }: { wishId: string; path: string }) {
  const [state, action, pending] = useActionState(
    withdrawRequest.bind(null, wishId, path),
    {} as FormState,
  );
  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Withdrawing…" : "Withdraw"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
