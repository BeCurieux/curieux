import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Balance, Statement } from "@/components/accounts/statement";
import { EmptyState } from "@/components/demo/empty-state";
import { PayButton } from "@/components/payments/pay-forms";
import { familyContext } from "@/lib/demo/context";
import { balanceOf, familyLines, formatMoney } from "@/lib/domain/accounts";
import { canPayOnline, onlinePayment, paymentsToShow } from "@/lib/domain/payments";
import { paymentsOn } from "@/lib/payments/stripe";

export const metadata: Metadata = { title: "Fees" };

// Each family's statement (M7a), and paying what's owing by card or direct
// debit when the school takes payments in Ovyko (M7b).
export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { viewer, db } = await familyContext();
  const { paid } = await searchParams;
  const { data: orgs } = await db
    .from("families")
    .select("id, organisation_id")
    .in(
      "id",
      viewer.families.map((f) => f.familyId),
    );
  const on = paymentsOn();
  const accounts = await Promise.all(
    viewer.families.map(async (f) => {
      const org = orgs?.find((o) => o.id === f.familyId)?.organisation_id;
      const [lines, payments, payable] = await Promise.all([
        familyLines(db, f.familyId),
        paymentsToShow(db, f.familyId),
        on && org ? canPayOnline(db, org) : false,
      ]);
      return { family: f, lines, payments, payable };
    }),
  );
  const justPaid = paid && /^[0-9a-f-]{36}$/.test(paid) ? await onlinePayment(db, paid) : null;
  const any = accounts.some((a) => a.lines.length > 0 || a.payments.length > 0);
  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Fees</h1>
      {justPaid ? (
        <p role="status" className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]">
          {justPaid.status === "paid"
            ? `Thank you. Your payment of ${formatMoney(justPaid.amountCents)} is in, and a receipt is on its way to your email.`
            : justPaid.status === "processing"
              ? `Thank you. Your direct debit of ${formatMoney(justPaid.amountCents)} is on its way; it takes up to three business days.`
              : justPaid.status === "started"
                ? "Thank you. Stripe is confirming your payment; it'll show here in a moment."
                : null}
        </p>
      ) : null}
      {!any ? (
        <EmptyState icon={<Wallet />} title="Nothing to pay">
          When your activity provider adds term fees, they&apos;ll show here.
        </EmptyState>
      ) : (
        accounts
          .filter((a) => a.lines.length > 0 || a.payments.length > 0)
          .map(({ family, lines, payments, payable }) => {
            const balance = balanceOf(lines);
            const owing =
              balance -
              payments
                .filter((p) => p.status === "processing")
                .reduce((s, p) => s + p.amountCents, 0);
            return (
              <section
                key={family.familyId}
                aria-label={family.displayName}
                className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]"
              >
                <p className="text-sm font-semibold text-muted">{family.displayName}</p>
                <Balance cents={balance} />
                {payments.map((p) =>
                  p.status === "processing" ? (
                    <p key={p.id} className="text-sm">
                      Direct debit of {formatMoney(p.amountCents)} on its way. It takes up to three
                      business days.
                    </p>
                  ) : (
                    <p key={p.id} className="text-sm font-semibold text-danger">
                      A payment of {formatMoney(p.amountCents)} didn&apos;t go through. Try again,
                      or check with your bank.
                    </p>
                  ),
                )}
                {payable && owing >= 50 ? (
                  <>
                    <PayButton familyId={family.familyId} amount={formatMoney(owing)} />
                    <p className="text-sm text-muted">
                      By card, Apple Pay, Google Pay or direct debit, on Stripe&apos;s secure page.
                    </p>
                  </>
                ) : !payable && balance > 0 ? (
                  <p className="text-sm text-muted">
                    To pay, use the details your activity provider gave you.
                  </p>
                ) : null}
                <Statement lines={lines} />
              </section>
            );
          })
      )}
    </div>
  );
}
