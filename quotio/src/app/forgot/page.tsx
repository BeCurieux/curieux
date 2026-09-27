import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { emailEnabled } from "@/lib/email/mailer";

export const metadata: Metadata = { title: "Reset your password" };
export const dynamic = "force-dynamic";

/**
 * The page someone reaches when they are already locked out.
 *
 * Which is exactly why it must not perform. If this deployment has no mail
 * provider, saying "check your inbox" strands them on a screen waiting for
 * something that is never coming — so the form is replaced with the address
 * of a person who can help (§41).
 */
export default async function ForgotPage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-title">Forgotten your password?</h1>

        {emailEnabled() ? (
          <>
            <p className="mt-3 leading-relaxed text-slate">
              Put in the email you signed up with and we&rsquo;ll send you a link. It works once,
              and only for an hour.
            </p>
            <ForgotForm />
          </>
        ) : (
          <>
            <p className="mt-3 leading-relaxed text-slate">
              We can&rsquo;t send email from this deployment yet, so there&rsquo;s no automatic
              link to give you. Email us and a person will sort it out.
            </p>
            <a href={`mailto:${brand.supportEmail}`} className="btn btn-lg mt-6">
              {brand.supportEmail}
            </a>
          </>
        )}

        <p className="mt-8 text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-purple">
            Sign in
          </Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
