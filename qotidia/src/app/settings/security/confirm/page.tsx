// Proving it again, before something that cannot be undone.
//
// Deliberately not a modal. A parent who has arrived here should be able to
// read what they are about to do, stop, and go elsewhere — a dialog over the
// top of the thing encourages clicking through it, which is the exact
// behaviour a second factor is supposed to interrupt.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { currentAssurance } from "@/lib/auth/step-up";
import {
  enrolledFactors,
  PROTECTED_ACTIONS,
  requiresStepUp,
  stepUpReason,
  type EnrolledFactor,
  type ProtectedAction,
} from "@/lib/auth/mfa";
import { ConfirmPanel } from "./panel";

export const dynamic = "force-dynamic";

function isProtected(value: string): value is ProtectedAction {
  return value in PROTECTED_ACTIONS;
}

/** Only ever return to our own pages. An open redirect here is a phish. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: { action?: string; next?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const next = safeNext(searchParams.next);
  const action = searchParams.action && isProtected(searchParams.action) ? searchParams.action : null;

  // Someone who has already proved themselves does not get asked twice.
  const assurance = await currentAssurance();
  if (!requiresStepUp(assurance)) redirect(next);

  const factors: EnrolledFactor[] = enrolledFactors(((user as any).factors ?? []) as any[]);

  return (
    <div className="py-16">
      <h1 className="text-title">Just checking it&rsquo;s you</h1>
      <p className="mt-3 max-w-[52ch] leading-relaxed text-stone">
        {action ? (
          <>
            You&rsquo;re about to do something we can&rsquo;t undo &mdash;{" "}
            {stepUpReason(action)}. We ask for your second factor before this
            one, even though you&rsquo;re already signed in.
          </>
        ) : (
          <>
            This one needs your second factor, even though you&rsquo;re
            already signed in.
          </>
        )}
      </p>

      <div className="mt-8 max-w-lg">
        {factors.length > 0 ? (
          <ConfirmPanel factors={factors} next={next} />
        ) : (
          // Should be unreachable: step-up is only demanded when a verified
          // factor exists. It rendered anyway the first time this page was
          // looked at, as a heading with an empty box under it — a dead end
          // on the way to something irreversible. A state that cannot happen
          // still should not be able to render as nothing.
          <p className="card text-sm leading-relaxed">
            We need a second factor for this, but we can&rsquo;t find one on
            your account.{" "}
            <Link href="/settings/security" className="text-ochre">
              Set one up
            </Link>{" "}
            and this will go through.
          </p>
        )}
      </div>

      <p className="mt-8 text-sm text-stone">
        Changed your mind?{" "}
        <Link href="/" className="text-ochre">
          Go back
        </Link>{" "}
        &mdash; nothing has happened yet.
      </p>
    </div>
  );
}
