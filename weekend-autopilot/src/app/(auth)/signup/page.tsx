import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export const metadata: Metadata = { title: "Create your account" };

/**
 * Account creation (§8).
 *
 * The flow is landing → checkout → account → onboarding, but the brief allows
 * the account to come first where checkout-before-account causes friction, and
 * this page serves both orders: the same magic link creates the account
 * whether the customer arrives before or after paying. Their Stripe payment is
 * matched to the household by the webhook, not by the browser’s return trip.
 */
export default function SignupPage({
  searchParams,
}: {
  searchParams: { tier?: string; session_id?: string };
}) {
  const paid = Boolean(searchParams.session_id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <BrandLogo />

      <h1 className="mt-8 text-[32px] leading-tight text-ink">
        {paid ? "You’re in." : "Let’s set you up."}
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-graphite">
        {paid
          ? "Confirm your email and we’ll take you straight to setup — about three minutes."
          : "Enter your email and we’ll send you a link. Setup takes about three minutes."}
      </p>

      <div className="mt-8">
        <MagicLinkForm next="/onboarding" />
      </div>

      <p className="mt-10 text-[14px] leading-relaxed text-mist">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline-offset-4 hover:underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          privacy note
        </Link>
        .
      </p>
    </div>
  );
}
