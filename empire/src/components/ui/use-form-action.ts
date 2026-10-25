"use client";

import { startTransition, useActionState, type FormEvent } from "react";

// Submits a form to a server action without React's automatic form reset,
// so a validation error never wipes what she typed.
export function useFormAction<S extends object>(
  action: (prev: S, form: FormData) => Promise<S>,
  initial: S,
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, onSubmit, pending };
}
