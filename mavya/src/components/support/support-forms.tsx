"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { TextAreaField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { letSupportIn, shutSupportOut } from "@/lib/support/actions";

// Letting Ovyko support in, and ending it (M6g).

export function LetSupportInForm({ again }: { again: boolean }) {
  return (
    <ActionForm
      action={letSupportIn}
      submitLabel={again ? "Give support another 48 hours" : "Let Ovyko support in for 48 hours"}
      pendingLabel="Letting support in…"
    >
      <TextAreaField
        name="note"
        label="What do you need help with?"
        optional
        maxLength={500}
        hint="Support sees this note with your school."
      />
    </ActionForm>
  );
}

export function EndSupportButton() {
  const [state, action, pending] = useActionState(shutSupportOut, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="soft" disabled={pending} className="w-fit">
        {pending ? "Ending…" : "End support access now"}
      </Button>
      {state.ok ? (
        <p role="status" className="text-sm font-semibold text-[#23694c]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
