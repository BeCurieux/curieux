import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Log in" };

/**
 * Passwordless email (§8). No password field, because a weekly product that
 * people open on a phone from an email link does not need one, and a password
 * is one more thing to lose. Google and Apple sign-in slot in later without
 * changing this page’s shape.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <BrandLogo />
      <h1 className="mt-8 text-[32px] leading-tight text-ink">Welcome back.</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-graphite">
        We’ll email you a link. No password to remember.
      </p>

      <div className="mt-8">
        <MagicLinkForm next={searchParams.next} />
      </div>

      {searchParams.error ? (
        <p role="alert" className="mt-4 text-[14px] text-clay">
          That link didn’t work — it may have expired. Try again.
        </p>
      ) : null}

      <p className="mt-10 text-[15px] text-mist">
        Don’t have an account yet?{" "}
        <Link href="/pricing" className="font-semibold text-forest underline-offset-4 hover:underline">
          Start with four weekends
        </Link>
        .
      </p>
      <p className="mt-3 text-[14px] text-mist">
        Trouble signing in? Write to{" "}
        <a href={`mailto:${brand.supportEmail}`} className="underline-offset-4 hover:underline">
          {brand.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
