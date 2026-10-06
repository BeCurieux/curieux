"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { tryOvyko } from "@/lib/site/try-demo";

// Opens a pretend swim school of the visitor's own (docs/TRY_IT_YOURSELF.md).
export function TryItButton({ variant = "warm" }: { variant?: "warm" | "soft" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(tryOvyko, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <Button type="submit" variant={variant} size="lg" disabled={pending}>
        {pending ? "Setting up your school…" : "Try it yourself"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-[#b54a33]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
