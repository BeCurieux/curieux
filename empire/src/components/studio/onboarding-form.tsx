"use client";

import { useEffect, useRef, useState } from "react";
import { createProfileAction, type FormState } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { useFormAction } from "@/components/ui/use-form-action";
import { BusinessFields, CustomerFields, PracticalFields, StyleFields } from "./profile-fields";

// The questionnaire, one step at a time. All steps are in one form (hidden
// steps keep their answers), so nothing is lost moving back and forth, and
// the server validates the whole thing at the end.

const STEPS = ["Your business", "Your customer", "The look", "Practicalities"] as const;
const STEP_OF: Record<string, number> = {
  brandName: 0,
  category: 0,
  productsSummary: 0,
  fulfilment: 0,
  stage: 0,
  websiteUrl: 0,
  audience: 1,
  goal: 1,
  personality: 2,
  visualStyle: 2,
  colours: 2,
  market: 3,
  currency: 3,
  verifiedClaims: 3,
  prohibitedClaims: 3,
};

export function OnboardingForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(createProfileAction, {});
  const [step, setStep] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  // When the server sends errors back, jump to the first step with one.
  useEffect(() => {
    const first = Object.keys(state.errors ?? {})
      .map((k) => STEP_OF[k] ?? 0)
      .sort()[0];
    // Responding to a server result that just arrived, not deriving state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (first !== undefined) setStep(first);
  }, [state]);

  const next = () => {
    const fields = form.current?.querySelectorAll<HTMLInputElement>(
      `[data-step="${step}"] [required]`,
    );
    for (const field of fields ?? []) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="space-y-8">
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label}>
            <span
              aria-current={i === step ? "step" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                i === step
                  ? "bg-oxblood text-ivory"
                  : i < step
                    ? "bg-blush text-ink"
                    : "border-line text-ink-soft border"
              }`}
            >
              <span aria-hidden>{i + 1}</span> {label}
            </span>
          </li>
        ))}
      </ol>
      {state.message ? <Notice tone="danger">{state.message}</Notice> : null}
      {[
        <BusinessFields key="b" errors={state.errors} />,
        <CustomerFields key="c" errors={state.errors} />,
        <StyleFields key="s" errors={state.errors} />,
        <PracticalFields key="p" errors={state.errors} />,
      ].map((child, i) => (
        <div key={i} data-step={i} hidden={i !== step}>
          <h2 className="mb-6 text-3xl">{STEPS[i]}</h2>
          {child}
        </div>
      ))}
      <div className="border-line flex flex-wrap items-center gap-3 border-t pt-6">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save and build my blueprint"}
          </Button>
        )}
        <p className="text-ink-soft text-sm">
          Step {step + 1} of {STEPS.length}. You can change any of this later.
        </p>
      </div>
    </form>
  );
}
