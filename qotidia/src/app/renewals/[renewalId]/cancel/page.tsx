// Stopping a charge.
//
// Linked from the renewal emails, and it has to work on the first tap from a
// phone, from an inbox, without remembering a password. A cancellation that
// requires a login is a chargeback with extra steps.
//
// The renewal id is the credential. That is a deliberate trade: it can only
// ever be used to *stop* a payment, so the worst a leaked link can do is
// prevent us taking someone's money — which is not a harm worth adding
// friction to guard against.

import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/server";
import { stopRenewalByLink } from "@/app/actions";
import { friendlyDate } from "@/lib/words";
import { bookPriceFor } from "@/lib/billing/price";

export const dynamic = "force-dynamic";

export default async function CancelRenewalPage(
  props: {
    params: Promise<{ renewalId: string }>;
    searchParams: Promise<{ done?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const admin = adminClient();
  const { data: renewal } = await admin
    .from("renewals")
    .select("id, status, scheduled_for, amount_aud, subject_id, subjects(display_name, family_id)")
    .eq("id", params.renewalId)
    .maybeSingle();

  if (!renewal) redirect("/");
  const childName = (renewal as any).subjects?.display_name ?? "their";

  if (searchParams.done || renewal.status === "cancelled") {
    return (
      <div className="mx-auto !max-w-md py-20">
        <h1 className="text-3xl">Stopped.</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">
          Nothing will be charged and nothing will print. Everything in{" "}
          {childName}&rsquo;s archive is exactly where you left it, and we
          won&rsquo;t set this up again unless you ask.
        </p>
        <p className="mt-6 text-sm text-stone">
          If you change your mind, you can order the book any time from{" "}
          {childName}&rsquo;s page.
        </p>
      </div>
    );
  }

  if (renewal.status !== "scheduled") {
    return (
      <div className="mx-auto !max-w-md py-20">
        <h1 className="text-3xl">Nothing to stop</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">
          {renewal.status === "charged"
            ? "This one has already been paid and is on its way to print. Reply to any of our emails and we will sort it out."
            : "There is no payment scheduled for this book."}
        </p>
      </div>
    );
  }

  const price = await bookPriceFor(admin, (renewal as any).subjects?.family_id ?? "");

  return (
    <div className="mx-auto !max-w-md py-20">
      <h1 className="text-3xl">Don&rsquo;t print {childName}&rsquo;s book this year?</h1>
      <p className="mt-4 text-sm leading-relaxed text-stone">
        {/* From the plan, not from renewal.amount_aud, which is the full
            price fixed when the renewal was scheduled. This page is reached
            from an email link by someone who may well be a monthly member
            with the book already included. */}
        {price.amountAud === 0 ? (
          <>
            We were going to send it to print on {friendlyDate(renewal.scheduled_for)}
            {" "}&mdash; included in your membership, nothing to pay. Stopping it
            takes one tap, and nothing in the archive is deleted or changed.
          </>
        ) : (
          <>
            We were going to charge A${Math.round(price.amountAud / 100)} on{" "}
            {friendlyDate(renewal.scheduled_for)} and send it to print. Stopping it
            takes one tap, and nothing in the archive is deleted or changed.
          </>
        )}
      </p>

      <form action={stopRenewalByLink} className="mt-8">
        <input type="hidden" name="renewal_id" value={renewal.id} />
        <button className="btn w-full">Don&rsquo;t charge me</button>
      </form>

      <p className="mt-4 text-center text-xs text-stone">
        You can order the book yourself later, at any time, for the same price.
      </p>
    </div>
  );
}
