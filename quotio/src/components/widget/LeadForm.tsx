"use client";

// Lead capture (brief §20).
//
// The default is "after the result", and the form is skippable. Holding a
// customer's quote hostage behind an email box is the single most common way
// these tools get built, and it is why people bounce off them — so the
// product's default is the opposite, and "required" is a deliberate choice
// the creator has to go and make.

import { useState } from "react";
import { CheckIcon } from "@/components/ui/Icons";
import type { LeadField, WidgetSettings } from "@/lib/widget/schema";
import { wording, wordingDefaults } from "@/lib/widget/wording";

export interface LeadValues {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

interface LeadFormProps {
  settings: WidgetSettings["leadCapture"];
  /** The author's button words, if they wrote any. */
  wordingOverrides: WidgetSettings["wording"];
  privacyNote: string;
  submitting?: boolean;
  submitted?: boolean;
  /** "before" gates the result, so its button says Continue rather than Send. */
  variant: "before" | "after";
  onSubmit: (values: LeadValues) => void;
  onSkip?: () => void;
}

const FIELD_META: Record<
  LeadField,
  { label: string; type: string; autoComplete: string; placeholder: string; multiline?: boolean }
> = {
  name: { label: "Name", type: "text", autoComplete: "name", placeholder: "Your name" },
  email: { label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
  phone: { label: "Phone", type: "tel", autoComplete: "tel", placeholder: "Your number" },
  message: {
    label: "Anything else?",
    type: "text",
    autoComplete: "off",
    placeholder: "Tell us anything useful",
    multiline: true,
  },
};

export function LeadForm({
  settings,
  wordingOverrides,
  privacyNote,
  submitting,
  submitted,
  variant,
  onSubmit,
  onSkip,
}: LeadFormProps) {
  // Keyed off this form's own variant rather than the widget's setting: they
  // agree today, but the variant is what actually decides whether this button
  // leads to a result or sends one.
  const labels = wordingDefaults(variant);
  const [values, setValues] = useState<LeadValues>({});
  const [touched, setTouched] = useState(false);

  if (submitted) {
    return (
      <div className="qw-surface mt-5 flex items-center gap-3 px-5 py-4">
        <span
          className="grid h-8 w-8 flex-none place-items-center rounded-full"
          style={{ background: "var(--w-accent)", color: "var(--w-on-accent)" }}
        >
          <CheckIcon size={16} strokeWidth={3} />
        </span>
        <p className="text-sm font-semibold">Thanks — we&rsquo;ve got your details.</p>
      </div>
    );
  }

  const emailIncluded = settings.fields.includes("email");
  const emailValid = !emailIncluded || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email?.trim() ?? "");
  const nameOk = !settings.fields.includes("name") || (values.name?.trim().length ?? 0) > 0;
  const canSubmit = emailValid && nameOk;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={variant === "after" ? "qw-surface mt-5 p-5 sm:p-6" : "mx-auto w-full max-w-md"}
      noValidate
    >
      <div className={variant === "before" ? "text-center" : ""}>
        <h3 className="text-lg font-bold tracking-tight">{settings.heading}</h3>
        {settings.description ? (
          <p className="qw-muted mt-1 text-sm leading-relaxed">{settings.description}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        {settings.fields.map((field) => {
          const meta = FIELD_META[field];
          const id = `lead-${field}`;
          return (
            <div key={field}>
              <label htmlFor={id} className="qw-muted mb-1.5 block text-xs font-semibold">
                {meta.label}
              </label>
              {meta.multiline ? (
                <textarea
                  id={id}
                  rows={3}
                  className="qw-field"
                  placeholder={meta.placeholder}
                  value={values[field] ?? ""}
                  onChange={(event) => setValues((old) => ({ ...old, [field]: event.target.value }))}
                />
              ) : (
                <input
                  id={id}
                  type={meta.type}
                  autoComplete={meta.autoComplete}
                  className="qw-field"
                  placeholder={meta.placeholder}
                  value={values[field] ?? ""}
                  onChange={(event) => setValues((old) => ({ ...old, [field]: event.target.value }))}
                />
              )}
            </div>
          );
        })}
      </div>

      {touched && !canSubmit ? (
        <p className="mt-2 text-xs font-medium" style={{ color: "#D2415E" }}>
          {nameOk ? "That email doesn't look right." : "We just need a name and a valid email."}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <button type="submit" className="qw-btn w-full" disabled={submitting}>
          {submitting ? "Sending…" : wording(wordingOverrides.leadSubmit, labels.leadSubmit)}
        </button>

        {/* §20: never force it. */}
        {!settings.required && onSkip ? (
          <button type="button" className="qw-btn-quiet mx-auto text-sm" onClick={onSkip}>
            {wording(wordingOverrides.leadSkip, labels.leadSkip)}
          </button>
        ) : null}
      </div>

      <p className="qw-faint mt-3 text-center text-xs">{privacyNote}</p>
    </form>
  );
}
