"use client";

import { updateProfileAction, uploadLogoAction, type FormState } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { useFormAction } from "@/components/ui/use-form-action";
import type { ProfileFacts } from "@/lib/domain/profile";
import { BusinessFields, CustomerFields, PracticalFields, StyleFields } from "./profile-fields";

export function ProfileEditForm({
  profileId,
  defaults,
}: {
  profileId: string;
  defaults: ProfileFacts;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    updateProfileAction.bind(null, profileId),
    {},
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      {state.message ? (
        <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>
      ) : null}
      <section className="space-y-6">
        <h2 className="text-2xl">Your business</h2>
        <BusinessFields errors={state.errors} defaults={defaults} />
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl">Your customer</h2>
        <CustomerFields errors={state.errors} defaults={defaults} />
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl">The look</h2>
        <StyleFields errors={state.errors} defaults={defaults} />
      </section>
      <section className="space-y-6">
        <h2 className="text-2xl">Practicalities and facts</h2>
        <PracticalFields errors={state.errors} defaults={defaults} />
      </section>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save business details"}
      </Button>
    </form>
  );
}

export function UploadForm({
  action,
  field,
  label,
  hint,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  field: string;
  label: string;
  hint: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor={field} className="block text-sm font-semibold">
        {label}
      </label>
      <p id={`${field}-hint`} className="text-mute text-sm">
        {hint}
      </p>
      <input
        id={field}
        name={field}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-describedby={`${field}-hint`}
        className="file:bg-blush file:text-charcoal block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:px-4 file:font-semibold"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.message ? (
        <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>
      ) : null}
    </form>
  );
}

export function LogoUpload({ profileId }: { profileId: string }) {
  return (
    <UploadForm
      action={uploadLogoAction.bind(null, profileId)}
      field="logo"
      label="Logo (optional)"
      hint="JPEG, PNG or WebP, up to 5 MB."
    />
  );
}
