"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { useFormAction } from "@/components/ui/use-form-action";
import type { FormState } from "@/app/studio/actions";
import { claimLicenseAction, deleteAccountAction, findPurchasesAction } from "./actions";

export function ClaimForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(claimLicenseAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field id="licenseKey" label="Licence key" hint="It's in your Gumroad receipt email, and in your Gumroad library.">
        <input id="licenseKey" name="licenseKey" autoComplete="off" className="field-input font-mono" aria-describedby="licenseKey-hint" />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Checking with Gumroad…" : "Verify my purchase"}</Button>
      {state.message ? <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice> : null}
    </form>
  );
}

export function FindPurchases() {
  const { state, onSubmit, pending } = useFormAction<FormState>(findPurchasesAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Button type="submit" variant="quiet" disabled={pending}>{pending ? "Looking…" : "Look for purchases made with my email"}</Button>
      {state.message ? <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice> : null}
    </form>
  );
}

export function DeleteAccount() {
  const { state, onSubmit, pending } = useFormAction<FormState>(deleteAccountAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field id="confirm" label="Type DELETE to confirm" hint="This removes your profiles, products, photos, generated assets and login. It can't be undone.">
        <input id="confirm" name="confirm" autoComplete="off" className="field-input max-w-48" aria-describedby="confirm-hint" />
      </Field>
      <Button type="submit" variant="danger" disabled={pending}>{pending ? "Deleting…" : "Delete my account and data"}</Button>
      {state.message ? <Notice tone="danger">{state.message}</Notice> : null}
    </form>
  );
}
