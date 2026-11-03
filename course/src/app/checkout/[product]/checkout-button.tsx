"use client";

import { useActionState } from "react";
import type { CheckoutState } from "./actions";

export function CheckoutButton({
  action,
  label,
}: {
  action: (state: CheckoutState, form: FormData) => Promise<CheckoutState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-8">
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold disabled:opacity-60"
      >
        {pending ? "Opening secure checkout…" : label}
      </button>
      {state.error ? (
        <p role="alert" className="bg-danger-soft text-danger mt-4 rounded-xl p-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
