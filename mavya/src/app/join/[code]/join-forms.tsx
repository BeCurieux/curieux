"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormShell } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { joinSignedIn, joinWithNewAccount, type JoinState } from "./actions";

export function NewAccountForm({ code, email }: { code: string; email: string }) {
  const [state, action, pending] = useActionState(joinWithNewAccount, {} as JoinState);
  return (
    <div className="flex flex-col gap-4">
      <FormShell
        action={action}
        state={state}
        pending={pending}
        submitLabel="Join"
        pendingLabel="Joining…"
        variant="warm"
      >
        <input type="hidden" name="code" value={code} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">Your email</p>
          <p className="text-lg font-semibold break-all">{email}</p>
        </div>
        <TextField name="name" label="Your name" autoComplete="name" defaultValue={state.name} />
        <TextField
          name="password"
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
        />
      </FormShell>
      {state.existingAccount ? (
        <Link href={`/sign-in?next=/join/${code}`} className="font-semibold underline">
          Sign in to join
        </Link>
      ) : null}
    </div>
  );
}

export function JoinButton({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinSignedIn, {} as JoinState);
  return (
    <FormShell
      action={action}
      state={state}
      pending={pending}
      submitLabel="Join"
      pendingLabel="Joining…"
      variant="warm"
    >
      <input type="hidden" name="code" value={code} />
    </FormShell>
  );
}
