// What you're paying, and how to stop.
//
// Built because the product could start a subscription and had no way to end
// one from inside itself. That is a support burden, and in Australia a
// subscription must be as easy to leave as it was to join, so it was also
// arguably a compliance problem.
//
// Cancelling is one button. No confirmation step, no offer, no survey, no
// "are you sure you want to lose everything" — because they do not lose
// everything, and a product whose whole claim is that a family's memories
// are theirs cannot make leaving harder than joining. The page says what
// happens, then does it.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { roleInFamily } from "@/lib/family/membership";
import { canManageAccess } from "@/lib/family/roles";
import { bookPriceFor } from "@/lib/billing/price";
import {
  CANCELLATION_PROMISE,
  MONTHS_FOR_INCLUDED_BOOK,
  PLAN_PRICES,
  bookIncluded,
} from "@/lib/billing/plans";
import { cancelMembership, resumeMembershipAction, startMembership } from "@/app/actions";
import { friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

const aud = (cents: number) => `A$${Math.round(cents / 100)}`;

const STATE_LABEL: Record<string, string> = {
  active: "Running",
  past_due: "A payment didn't go through",
  cancelled: "Stopped",
  none: "No membership",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { stopped?: string; resumed?: string; started?: string; error?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: family } = await db
    .from("families")
    .select("id, plan, membership_state, paid_until, months_paid_total, months_paid_this_year")
    .limit(1)
    .maybeSingle();
  if (!family) redirect("/home");

  const role = await roleInFamily(db, family.id, user.id);
  const canManage = canManageAccess(role);
  const price = await bookPriceFor(db, family.id);
  const monthly = family.plan === "monthly";
  const monthsThisYear = family.months_paid_this_year ?? 0;

  const { data: events } = await db
    .from("billing_events")
    .select("kind, amount_aud, note, created_at")
    .eq("family_id", family.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="text-sm text-stone">
        <Link href="/settings/privacy" className="text-ochre">Archive settings</Link>
      </p>
      <h1 className="mt-2 text-title">What you&rsquo;re paying</h1>

      {searchParams.stopped && (
        <p className="mt-6 rounded-lg bg-rule/50 p-4 text-sm leading-relaxed">
          Stopped. You won&rsquo;t be charged again.{" "}
          {family.paid_until && <>You keep everything until {friendlyDate(family.paid_until)}, and after that {CANCELLATION_PROMISE.charAt(0).toLowerCase() + CANCELLATION_PROMISE.slice(1)}</>}
        </p>
      )}
      {searchParams.resumed && (
        <p className="mt-6 rounded-lg bg-rule/50 p-4 text-sm">Still going. Nothing changed.</p>
      )}
      {searchParams.started && (
        <p className="mt-6 rounded-lg bg-rule/50 p-4 text-sm">That&rsquo;s set up. Thank you.</p>
      )}
      {searchParams.error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{searchParams.error}</p>
      )}

      <section className="card mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl">
            {monthly ? "Keep the year" : "Just the book"}
          </h2>
          <span className="text-sm text-stone">
            {STATE_LABEL[family.membership_state] ?? family.membership_state}
          </span>
        </div>

        {monthly ? (
          <>
            <p className="mt-3 text-2xl font-display">
              {aud(PLAN_PRICES.monthlyAud())} <span className="font-body text-sm text-stone">a month</span>
            </p>
            {family.paid_until && (
              <p className="mt-2 text-sm text-stone">
                Paid up to {friendlyDate(family.paid_until)}.
              </p>
            )}
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed">
              {bookIncluded(monthsThisYear) ? (
                <>This year&rsquo;s book is included &mdash; nothing more to pay for it.</>
              ) : (
                <>
                  {monthsThisYear === 0
                    ? "No months counted toward this year's book yet."
                    : `${monthsThisYear} of ${MONTHS_FOR_INCLUDED_BOOK} months counted toward this year's book.`}{" "}
                  {price.explanation}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-stone">
            You pay for each book when you order it. Nothing recurring, and no
            card kept on file unless you asked us to keep one for next year.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------- the button */}
      {canManage && (
        <section className="mt-8">
          {monthly && family.membership_state !== "cancelled" && (
            <form action={cancelMembership}>
              <input type="hidden" name="family_id" value={family.id} />
              <button className="btn-secondary">Stop the membership</button>
              <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-stone">
                One click, no reason needed. It stops at the end of the month
                you&rsquo;ve already paid for &mdash; we don&rsquo;t take back
                what you&rsquo;ve bought. {CANCELLATION_PROMISE}
              </p>
            </form>
          )}

          {monthly && family.membership_state === "cancelled" && (
            <form action={resumeMembershipAction}>
              <input type="hidden" name="family_id" value={family.id} />
              <button className="btn">Start it again</button>
              <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-stone">
                The months you already paid still count toward this
                year&rsquo;s book.
              </p>
            </form>
          )}

          {!monthly && (
            <form action={startMembership}>
              <input type="hidden" name="family_id" value={family.id} />
              <button className="btn">Switch to monthly</button>
              <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-stone">
                {aud(PLAN_PRICES.monthlyAud())} a month, each year&rsquo;s book
                included.{" "}
                <Link href="/pricing" className="text-ochre">The two side by side</Link>
              </p>
            </form>
          )}
        </section>
      )}

      {/* ---------------------------------------------------- the record */}
      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="text-lg">What&rsquo;s happened</h2>
        <p className="mt-1 max-w-[54ch] text-sm leading-relaxed text-stone">
          Every charge and every change, kept by us rather than only by
          Stripe &mdash; so a question about a payment a year from now has an
          answer here.
        </p>
        {(events ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-stone">Nothing yet.</p>
        ) : (
          <ul className="mt-4 space-y-1.5 text-sm">
            {(events ?? []).map((e: any, i: number) => (
              <li key={i} className="flex flex-wrap justify-between gap-3 border-b border-rule/60 py-2">
                <span>
                  {e.kind.replace(/[._]/g, " ")}
                  {e.note && <span className="text-stone"> &mdash; {e.note}</span>}
                </span>
                <span className="text-stone">
                  {e.amount_aud ? `${aud(e.amount_aud)} · ` : ""}
                  {friendlyDate(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
