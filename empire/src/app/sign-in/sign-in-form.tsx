"use client";

import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { useFormAction } from "@/components/ui/use-form-action";
import { signIn, type SignInState } from "./actions";

export function SignInForm({ local, next }: { local: boolean; next: string }) {
  const { state, onSubmit, pending } = useFormAction<SignInState>(signIn, { status: "idle" });

  if (state.status === "sent") {
    return (
      <Notice tone="success" title="Check your inbox">
        We've sent a sign-in link to <strong>{state.email}</strong>. It works once and expires in an
        hour. No email after a couple of minutes? Check spam, or try again.
      </Notice>
    );
  }

  const error = state.status === "error" ? state.message : undefined;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field
        id="email"
        label="Your email"
        hint={
          local
            ? "Local mode: you'll be signed in straight away."
            : "We'll email you a link. No password to forget."
        }
        error={error}
      >
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field-input"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy("email", true, error)}
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "One moment…" : local ? "Sign in" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
