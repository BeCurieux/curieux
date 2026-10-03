import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Wordmark } from "@/components/shell/wordmark";
import { homePath } from "@/lib/auth/roles";
import { ownerTwoStepNeeded, requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { TwoStepForm } from "./two-step-form";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function TwoStepPage() {
  const viewer = await requireViewer();
  if (!(await ownerTwoStepNeeded())) redirect(homePath(viewer.shells));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const setUp = data.totp.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <Wordmark />
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          {setUp ? "Enter your code" : "Protect your school"}
        </h1>
        <p className="text-lg text-muted">
          {setUp
            ? "Open your authenticator app and enter the 6-digit code for Ovyko."
            : "Owners sign in with their password and a code from an authenticator app, so a stolen password alone can't open your families' details."}
        </p>
      </div>
      <TwoStepForm setUp={setUp} />
      <div className="flex flex-col gap-3 text-sm text-muted">
        <p>
          Lost your phone? Email{" "}
          <a href="mailto:hello@ovyko.com.au" className="underline underline-offset-2">
            hello@ovyko.com.au
          </a>
          . We&apos;ll check it&apos;s you, then let you set up a new one.
        </p>
        <SignOutButton />
      </div>
    </main>
  );
}
