import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Balance, Statement } from "@/components/accounts/statement";
import { EmptyState } from "@/components/demo/empty-state";
import { VoucherForm } from "@/components/family/voucher-form";
import { InstalmentButtons, PayButton, PayRestButton } from "@/components/payments/pay-forms";
import { familyContext } from "@/lib/demo/context";
import { balanceOf, familyLines, formatMoney } from "@/lib/domain/accounts";
import {
  canPayOnline,
  familyOwing,
  instalmentsOffered,
  onlinePayment,
  openPlan,
  paymentsToShow,
  splitInstalments,
  type InstalmentPlan,
} from "@/lib/domain/payments";
import { familyVouchers, SCHEMES, STATUS_LABELS, voucherSchemes } from "@/lib/domain/vouchers";
import { formatLessonDate } from "@/lib/format";
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
      const [lines, payments, payable, offered, plan, dues, schemes, vouchers, kids] =
        await Promise.all([
          familyLines(db, f.familyId),
          paymentsToShow(db, f.familyId),
          on && org ? canPayOnline(db, org) : false,
          on && org ? instalmentsOffered(db, org) : false,
          openPlan(db, f.familyId),
          familyOwing(db, f.familyId),
          org ? voucherSchemes(db, org) : [],
          familyVouchers(db, f.familyId),
          db
            .from("children")
            .select("id, first_name")
            .eq("family_id", f.familyId)
            .eq("active", true)
            .order("first_name")
            .then(({ data }) => (data ?? []).map((c) => ({ id: c.id, name: c.first_name }))),
        ]);
      return { family: f, lines, payments, payable, offered, plan, dues, schemes, vouchers, kids };
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
          .map(({ family, lines, payments, payable, offered, plan, dues }) => {
            const balance = balanceOf(lines);
            // As the database counts it: less direct debits on their way and
            // instalments a plan will take later.
            const owing = dues.owingNow;
            const busy = plan?.instalments.some(
              (i) => i.status === "started" || i.status === "processing",
            );
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
                {plan ? <PlanSummary plan={plan} /> : null}
                {payable && plan?.status === "active" && dues.owingWithPlan > owing && !busy ? (
                  <PayRestButton
                    familyId={family.familyId}
                    amount={formatMoney(dues.owingWithPlan)}
                  />
                ) : null}
                {payable && owing >= 50 ? (
                  <>
                    <PayButton familyId={family.familyId} amount={formatMoney(owing)} />
                    {offered && !plan && owing >= 10000 ? (
                      <>
                        <p className="text-sm font-semibold">Or spread it out, at no extra cost:</p>
                        <InstalmentButtons
                          familyId={family.familyId}
                          options={([2, 4] as const).map((n) => ({
                            payments: n,
                            label: `${n} payments of ${formatMoney(splitInstalments(owing, n)[1] ?? 0)}`,
                          }))}
                        />
                      </>
                    ) : null}
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
      {accounts
        .filter((a) => (a.schemes.length > 0 && a.kids.length > 0) || a.vouchers.length > 0)
        .map(({ family, schemes, vouchers, kids }) => (
          <section
            key={`vouchers-${family.familyId}`}
            aria-label={`Activity vouchers: ${family.displayName}`}
            className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]"
          >
            <div>
              <h2 className="font-display text-2xl font-semibold">Activity vouchers</h2>
              <p className="text-sm text-muted">
                Got a government voucher, like Active and Creative Kids? Hand it over here and
                it&apos;ll come off your fees once your activity provider redeems it.
              </p>
            </div>
            {vouchers.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line">
                {vouchers.map((v) => (
                  <li key={v.id} className="flex flex-col gap-1 py-3">
                    <span className="font-semibold">
                      {SCHEMES[v.scheme].name}
                      {v.childName ? ` for ${v.childName}` : ""}
                    </span>
                    <span className="text-sm text-muted">
                      {v.code} · {STATUS_LABELS[v.status]}
                      {v.status === "redeemed" && v.amountCents
                        ? `: ${formatMoney(v.amountCents)} off`
                        : ""}
                      {v.status === "declined" && v.declineReason ? `: ${v.declineReason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {schemes.length > 0 && kids.length > 0 ? (
              <VoucherForm kids={kids} schemes={schemes} />
            ) : null}
          </section>
        ))}
    </div>
  );
}

const INSTALMENT_LABELS: Record<InstalmentPlan["instalments"][number]["status"], string> = {
  scheduled: "To come",
  started: "Being paid",
  processing: "On its way",
  paid: "Paid",
  failed: "Didn't go through",
  cancelled: "Cancelled",
};

// A family's instalments: what's paid and what's to come.
function PlanSummary({ plan }: { plan: InstalmentPlan }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-soft p-4">
      <p className="font-semibold">
        {plan.status === "pending"
          ? `Paying ${formatMoney(plan.totalCents)} in ${plan.payments} payments, once the first is in.`
          : `Paying ${formatMoney(plan.totalCents)} in ${plan.payments} payments.`}
      </p>
      <ul aria-label="Instalments" className="flex flex-col gap-1 text-sm">
        {plan.instalments.map((i) => (
          <li key={i.seq} className="flex justify-between gap-4">
            <span>
              {formatMoney(i.amountCents)} on {formatLessonDate(`${i.dueOn}T12:00:00Z`, "UTC")}
            </span>
            <span className="text-muted">{INSTALMENT_LABELS[i.status]}</span>
          </li>
        ))}
      </ul>
      {plan.status === "active" ? (
        <p className="text-sm text-muted">
          Taken automatically from the card or bank account you used. If one doesn&apos;t go
          through, we&apos;ll email you and the rest is simply owed.
        </p>
      ) : null}
    </div>
  );
}
