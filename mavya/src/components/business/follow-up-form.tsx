"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { followUp } from "@/lib/retention/actions";

// "Followed up", with an optional note (M8e).
export function FollowUpForm({ familyId, familyName }: { familyId: string; familyName: string }) {
  const [state, action, pending] = useActionState(followUp.bind(null, familyId), {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor={`note-${familyId}`}>
        Note about {familyName}
      </label>
      <input
        id={`note-${familyId}`}
        name="note"
        maxLength={200}
        placeholder="Note (optional), e.g. Called, Ava's had a cold"
        className="h-11 flex-1 rounded-sm border border-line bg-surface px-3 text-base"
      />
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Followed up"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
