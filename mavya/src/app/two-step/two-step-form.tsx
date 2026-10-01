"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startSetup, verifyCode, type TwoStepState } from "./actions";

export function TwoStepForm({ setUp }: { setUp: boolean }) {
  const [setup, begin, starting] = useActionState(startSetup, {} as TwoStepState);
  const [state, verify, verifying] = useActionState(verifyCode, {} as TwoStepState);
  const factor = setup.factorId ? setup : null;

  if (!setUp && !factor) {
    return (
      <form action={begin} className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>Install an authenticator app, like Google Authenticator or 1Password.</li>
          <li>Tap Set up, then scan the code with the app.</li>
          <li>Enter the 6-digit code it shows.</li>
        </ol>
        {setup.error ? (
          <p role="alert" className="font-semibold text-danger">
            {setup.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={starting}>
          {starting ? "Setting up…" : "Set up"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {factor ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-white p-5">
          {/* A data URL made by Supabase Auth: next/image can't optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={factor.qrCode}
            alt="QR code to scan with your authenticator app"
            width={200}
            height={200}
          />
          <p className="text-center text-sm text-ink">
            Can&apos;t scan? Enter this key in the app:
          </p>
          <p
            aria-label="Set-up key"
            className="font-mono text-sm break-all text-ink"
            data-testid="totp-secret"
          >
            {factor.secret}
          </p>
        </div>
      ) : null}
      <form action={verify} className="flex flex-col gap-4" noValidate>
        {factor ? <input type="hidden" name="factor" value={factor.factorId} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            required
            aria-invalid={state.error ? true : undefined}
            className="font-mono text-2xl tracking-[0.3em]"
          />
        </div>
        {state.error ? (
          <p role="alert" className="font-semibold text-danger">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={verifying}>
          {verifying ? "Checking…" : factor ? "Finish set-up" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
