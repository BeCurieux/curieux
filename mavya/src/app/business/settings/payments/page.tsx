import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import { SetUpPaymentsButton } from "@/components/payments/pay-forms";
import { requireOwner } from "@/lib/business/owner";
import { PLATFORM_FEE_PERCENT, paymentAccount } from "@/lib/domain/payments";
import { refreshPaymentAccount } from "@/lib/payments/accounts";
import { paymentsOn } from "@/lib/payments/stripe";

export const metadata: Metadata = { title: "Payments" };

// Setting up card and direct-debit payments (M7b): the school's own Stripe
// account, and what it costs.
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
}) {
  const { db, organisationId } = await requireOwner();
  const { back } = await searchParams;
  const on = paymentsOn();
  let account = await paymentAccount(db, organisationId);
  // Back from Stripe's sign-up: ask Stripe now rather than wait for its message.
  if (on && back && account && !account.canTakePayments) {
    await refreshPaymentAccount(organisationId, account.stripeAccountId);
    account = await paymentAccount(db, organisationId);
  }

  return (
    <div className="rise flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-muted">
          Families pay what they owe from their phone, by card, Apple Pay, Google Pay or direct
          debit. The money goes straight to your bank account through Stripe, and each payment is
          added to the family&apos;s account.
        </p>
      </div>

      <section
        aria-labelledby="status"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="status" className="font-display text-2xl font-semibold">
          {!on
            ? "Coming soon"
            : account?.canTakePayments
              ? "You're taking payments"
              : account
                ? "Finish setting up with Stripe"
                : "Set up payments"}
        </h2>
        {!on ? (
          <p className="text-muted">
            Paying in Ovyko isn&apos;t switched on yet. Until it is, record payments on each
            family&apos;s page.
          </p>
        ) : account?.canTakePayments ? (
          <>
            <p>
              Families see a Pay button on their Fees screen.
              {account.payoutsOn
                ? " Stripe pays the money into your bank account."
                : " Stripe needs a little more before it can pay money out to your bank."}
            </p>
            <p className="text-sm text-muted">
              Refunds, payouts and disputes are in your Stripe dashboard. A refund there is added to
              the family&apos;s account here automatically.
            </p>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noreferrer"
              className="w-fit font-semibold underline underline-offset-4"
            >
              Open Stripe
            </a>
            {account.payoutsOn ? null : <SetUpPaymentsButton label="Continue with Stripe" />}
          </>
        ) : account ? (
          <>
            <p>
              {account.detailsSubmitted
                ? "Stripe is checking your details. This page updates when it's done, usually within a day."
                : "Stripe needs a few more details about your business before families can pay."}
            </p>
            <SetUpPaymentsButton label="Continue with Stripe" />
          </>
        ) : (
          <>
            <p>
              Stripe, the payment company, checks who your business is and asks for your bank
              account. It takes about 10 minutes; have your ABN and bank details ready.
            </p>
            <SetUpPaymentsButton label="Set up with Stripe" />
          </>
        )}
      </section>

      <section aria-labelledby="costs" className="flex flex-col gap-3">
        <h2 id="costs" className="font-display text-2xl font-semibold">
          What it costs
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          <li className="flex justify-between gap-4 px-5 py-3">
            <span>Australian cards</span>
            <span className="text-right text-muted">Stripe: 1.65% + 30c</span>
          </li>
          <li className="flex justify-between gap-4 px-5 py-3">
            <span>Direct debit</span>
            <span className="text-right text-muted">Stripe: 1% + 30c, at most $3.50</span>
          </li>
          <li className="flex justify-between gap-4 px-5 py-3">
            <span>Ovyko</span>
            <span className="text-right text-muted">{PLATFORM_FEE_PERCENT}% of each payment</span>
          </li>
        </ul>
        <p className="text-sm text-muted">
          Taken from each payment before it reaches your bank. Since 1 October 2026 Australian
          businesses can&apos;t add a card surcharge, so families pay exactly what they owe.
          Payments you record yourself cost nothing.
        </p>
      </section>
    </div>
  );
}
