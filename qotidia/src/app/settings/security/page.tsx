// Signing in, and proving it again when it matters.
//
// Written as reassurance rather than as a security control panel. A parent
// arriving here is worried about someone getting into their child's archive,
// not shopping for authentication factors, so the page leads with what is
// already true and offers one recommended thing to add.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { currentAssurance } from "@/lib/auth/step-up";
import { enrolledFactors, PROTECTED_ACTIONS, type EnrolledFactor } from "@/lib/auth/mfa";
import { SecurityPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // The user record carries its own factors, so this needs no extra call.
  const factors: EnrolledFactor[] = enrolledFactors(((user as any).factors ?? []) as any[]);
  const assurance = await currentAssurance();

  return (
    <div className="py-10">
      <p className="text-sm text-stone">
        <Link href="/settings/privacy" className="text-ochre">
          Archive settings
        </Link>
      </p>
      <h1 className="mt-2 text-title">Getting in</h1>
      <p className="mt-3 max-w-[54ch] leading-relaxed text-stone">
        Your archive is already private &mdash; nobody reaches it without
        signing in as you, or being invited by you. What this page adds is a
        second thing someone would need even if they had your password.
      </p>

      <section className="mt-10">
        <SecurityPanel factors={factors} />
      </section>

      <section className="mt-12 border-t border-rule pt-10">
        <h2 className="text-lg">When we&rsquo;ll ask again</h2>
        <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-stone">
          Once you&rsquo;ve added one of these, we ask for it again before
          anything that can&rsquo;t be undone &mdash; not just when you sign
          in. A stolen laptop that&rsquo;s already logged in still can&rsquo;t
          do these:
        </p>
        <ul className="mt-4 space-y-2">
          {Object.entries(PROTECTED_ACTIONS).map(([key, phrase]) => (
            <li key={key} className="card !p-3 text-sm">
              {phrase.charAt(0).toUpperCase() + phrase.slice(1)}
            </li>
          ))}
        </ul>
        {factors.length === 0 && (
          <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-ochre">
            None of that is switched on yet, because there&rsquo;s nothing to
            ask you for. Adding a passkey above turns all of it on at once.
          </p>
        )}
        {factors.length > 0 && assurance.currentLevel !== "aal2" && (
          <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-stone">
            This browser hasn&rsquo;t used your second factor yet, so
            you&rsquo;ll be asked once if you try any of them.
          </p>
        )}
      </section>

      <section className="mt-12 border-t border-rule pt-10">
        <h2 className="text-lg">What we don&rsquo;t offer</h2>
        <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-stone">
          Codes by text message. They&rsquo;re the one kind of second factor
          that can be taken from you without touching your phone, and putting
          the option here beside a passkey would suggest the two are
          equivalent. They aren&rsquo;t.
        </p>
      </section>
    </div>
  );
}
