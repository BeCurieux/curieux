"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, describedBy } from "@/components/ui/field";
import { useFormAction } from "@/components/ui/use-form-action";
import { EMAIL_CONSENT_TEXT } from "@/content/consent";
import { optIn, type OptInState } from "./actions";

// The optional opt-in. The box starts unticked; nothing is sent without it.
export function OptInForm() {
  const { state, onSubmit, pending } = useFormAction<OptInState>(optIn, { status: "idle" });
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // Campaign names from the link she followed, read after the page loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUtm({
      source: p.get("utm_source") ?? p.get("ref") ?? "",
      medium: p.get("utm_medium") ?? "",
      campaign: p.get("utm_campaign") ?? "",
    });
  }, []);

  if (state.status === "done")
    return (
      <Notice tone="success" title="You're on the list">
        Thank you. The emails come from hello@herlittleempire.com, and every one has an unsubscribe
        link.
      </Notice>
    );

  const error = state.status === "error" ? state.message : undefined;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="source" value={utm.source} />
      <input type="hidden" name="medium" value={utm.medium} />
      <input type="hidden" name="campaign" value={utm.campaign} />
      <div aria-hidden="true" className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field id="optin-email" label="Your email" error={error}>
        <input
          id="optin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field-input"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy("optin-email", false, error)}
        />
      </Field>
      <label className="text-charcoal flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" value="yes" className="mt-1 size-4 shrink-0" />
        <span>{EMAIL_CONSENT_TEXT}</span>
      </label>
      <p className="text-mute text-xs">
        We keep your email, the wording you agreed to and when. See{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
        .
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "One moment…" : "Send me the emails"}
      </Button>
    </form>
  );
}
