import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { ResetForm } from "@/components/auth/ResetForm";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

/**
 * Redeeming a reset link.
 *
 * The token is checked here only to decide which screen to draw — a dead link
 * should say so before someone types a password into it, rather than after.
 * It is *redeemed* in the action, inside the store, because a check here
 * followed by a use there is a race two people holding the same link could
 * both win.
 */
export default async function ResetPage({ params }: { params: { token: string } }) {
  const user = await currentUser();
  const reset = await getStore().getPasswordReset(params.token);
  const usable = Boolean(reset && !reset.usedAt && reset.expiresAt > new Date().toISOString());

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-md px-5 py-16">
        {usable ? (
          <>
            <h1 className="text-title">Choose a new password</h1>
            <p className="mt-3 leading-relaxed text-slate">
              At least 8 characters. Setting it signs you out anywhere else you were signed in.
            </p>
            <ResetForm token={params.token} />
          </>
        ) : (
          <>
            <h1 className="text-title">That link has expired.</h1>
            <p className="mt-3 leading-relaxed text-slate">
              Reset links last an hour and only work once — this one has been used or run out.
              Nothing has changed about your account.
            </p>
            <Link href="/forgot" className="btn btn-lg mt-6">
              Send me a new one
            </Link>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
