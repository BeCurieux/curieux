"use client";

import { createContext, useActionState, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

const FieldErrors = createContext<Record<string, string>>({});

export function useFieldError(name: string): string | undefined {
  return useContext(FieldErrors)[name];
}

// A form posting to a server action. Shows the action's error above the
// submit button and passes field errors down to each Field.
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  children,
  className,
  variant = "primary",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "warm";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <FieldErrors.Provider value={state.fieldErrors ?? {}}>
      <form action={formAction} noValidate className={cn("flex flex-col gap-5", className)}>
        {children}
        {state.error ? (
          <p
            role="alert"
            className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]"
          >
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p
            role="status"
            className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]"
          >
            {state.ok}
          </p>
        ) : null}
        <Button type="submit" variant={variant} disabled={pending} className="w-fit">
          {pending ? pendingLabel : submitLabel}
        </Button>
      </form>
    </FieldErrors.Provider>
  );
}
