"use client";

import { useActionState } from "react";
import { FormShell } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import type { FormState } from "@/lib/forms";
import { joinWaitlist } from "@/lib/site/waitlist";

// The founding-schools waitlist form (docs/WAITLIST_PAGE.md).
type State = FormState & { values?: Record<string, string> };

// What was typed, so a refused form comes back filled in, not empty.
async function submit(_: State, form: FormData): Promise<State> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") values[k] = v;
  const result = await joinWaitlist({}, form);
  return { ...result, values };
}

export function WaitlistForm() {
  const [state, action, pending] = useActionState(submit, {} as State);
  const v = state.values ?? {};
  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-[#dcf1e7] p-6 text-[#1d5a41]">
        <p className="font-display text-2xl font-semibold">You&apos;re on the list. Thank you.</p>
        <p>
          We&apos;ll be in touch before founding places open. If you&apos;d like to talk sooner,
          email{" "}
          <a href="mailto:hello@ovyko.com.au" className="font-semibold underline">
            hello@ovyko.com.au
          </a>
          .
        </p>
      </div>
    );
  }
  return (
    <FormShell
      action={action}
      state={{ ...state, ok: undefined }}
      pending={pending}
      submitLabel="Join the waitlist"
      pendingLabel="Joining…"
      variant="warm"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField defaultValue={v.name} name="name" label="Your name" autoComplete="name" />
        <TextField
          defaultValue={v.school}
          name="school"
          label="Swim school"
          autoComplete="organization"
        />
        <TextField
          defaultValue={v.suburb}
          name="suburb"
          label="Suburb"
          autoComplete="address-level2"
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
        <SelectField
          key={`swimmers-${v.swimmers ?? ""}`}
          defaultValue={v.swimmers}
          name="swimmers"
          label="About how many swimmers?"
          optional
          placeholder="Choose"
          options={[
            { value: "under_200", label: "Under 200" },
            { value: "200_500", label: "200 to 500" },
            { value: "500_1000", label: "500 to 1,000" },
            { value: "over_1000", label: "Over 1,000" },
          ]}
        />
        <SelectField
          key={`system-${v.currentSystem ?? ""}`}
          defaultValue={v.currentSystem}
          name="currentSystem"
          label="What do you use today?"
          optional
          placeholder="Choose"
          options={[
            { value: "iclasspro", label: "iClassPro" },
            { value: "simplyswim", label: "SimplySwim" },
            { value: "class_manager", label: "Class Manager" },
            { value: "spreadsheets", label: "Spreadsheets" },
            { value: "other", label: "Something else" },
          ]}
        />
        <TextField
          defaultValue={v.nextBreak}
          name="nextBreak"
          label="When's your next term break?"
          optional
        />
      </div>
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
          Email me about Ovyko&apos;s founding schools. I can unsubscribe at any time.
          {state.fieldErrors?.consent ? (
            <span className="block text-sm font-semibold text-danger">
              {state.fieldErrors.consent}
            </span>
          ) : null}
        </span>
      </label>
      <p className="text-sm text-muted">
        No spam, and we never share your details. We&apos;ll email you once when founding places
        open, and you can unsubscribe at any time.
      </p>
    </FormShell>
  );
}
