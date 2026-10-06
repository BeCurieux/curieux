"use client";

import { useActionState } from "react";
import { FormShell } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field";
import type { WaitlistPage } from "@/lib/domain/waitlist-page";
import type { FormState } from "@/lib/forms";
import { joinSchool } from "@/lib/site/school-waitlist";

// One school's waiting-list form for new families (M8d).
type State = FormState & { values?: Record<string, string>; days?: string[] };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SchoolWaitlistForm({ slug, page }: { slug: string; page: WaitlistPage }) {
  // What was typed, so a refused form comes back filled in, not empty.
  async function submit(_: State, form: FormData): Promise<State> {
    const values: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") values[k] = v;
    const days = form.getAll("weekdays").map(String);
    const result = await joinSchool(slug, {}, form);
    return { ...result, values, days };
  }
  const [state, action, pending] = useActionState(submit, {} as State);
  const v = state.values ?? {};
  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-[#dcf1e7] p-6 text-[#1d5a41]">
        <p className="font-display text-2xl font-semibold">Thanks, you&apos;re on the list.</p>
        <p>{page.school} will be in touch when a place comes up.</p>
      </div>
    );
  }
  return (
    <FormShell
      action={action}
      state={{ ...state, ok: undefined }}
      pending={pending}
      submitLabel="Join the waiting list"
      pendingLabel="Sending…"
      variant="warm"
    >
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-display text-xl font-semibold">Your child</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={v.childFirstName} name="childFirstName" label="First name" />
          <TextField defaultValue={v.childLastName} name="childLastName" label="Last name" />
          <TextField
            defaultValue={v.dateOfBirth}
            name="dateOfBirth"
            label="Date of birth"
            type="date"
          />
          <SelectField
            key={`level-${v.levelId ?? ""}`}
            defaultValue={v.levelId}
            name="levelId"
            label="Level"
            optional
            placeholder="Not sure"
            options={page.levels.map((l) => ({ value: l.id, label: l.name, group: l.program }))}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-display text-xl font-semibold">Times that suit</legend>
        <div role="group" aria-label="Days that work" className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label
              key={d}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={i + 1}
                defaultChecked={state.days?.includes(String(i + 1))}
                className="sr-only"
              />
              {d}
            </label>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="earliest"
            label="Earliest start"
            type="time"
            defaultValue={v.earliest ?? "15:30"}
          />
          <TextField
            name="latest"
            label="Latest start"
            type="time"
            defaultValue={v.latest ?? "18:00"}
          />
        </div>
        {page.locations.length > 1 ? (
          <SelectField
            key={`location-${v.locationId ?? ""}`}
            defaultValue={v.locationId}
            name="locationId"
            label="Location"
            optional
            placeholder="Any"
            options={page.locations.map((l) => ({ value: l.id, label: l.name }))}
          />
        ) : null}
        <TextAreaField
          defaultValue={v.note}
          name="note"
          label="Anything else?"
          optional
          maxLength={200}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-display text-xl font-semibold">You</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            defaultValue={v.parentName}
            name="parentName"
            label="Your name"
            autoComplete="name"
          />
          <TextField
            defaultValue={v.email}
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
          />
          <TextField
            defaultValue={v.phone}
            name="phone"
            label="Phone"
            optional
            type="tel"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
      </fieldset>

      {/* Hidden from people; only bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          defaultChecked={v.consent === "yes"}
          className="mt-1 size-5 accent-ink"
        />
        <span>
          {page.school} may keep these details to contact me about a place.
          {state.fieldErrors?.consent ? (
            <span className="block text-sm font-semibold text-danger">
              {state.fieldErrors.consent}
            </span>
          ) : null}
        </span>
      </label>
    </FormShell>
  );
}
