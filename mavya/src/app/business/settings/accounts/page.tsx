import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeeRemindersSwitch } from "@/components/business/account-forms";
import { VoucherDecision, VoucherSchemesForm } from "@/components/business/voucher-forms";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { requireOwner } from "@/lib/business/owner";
import { balanceWords, familyBalances, feeRemindersOn, formatMoney } from "@/lib/domain/accounts";
import { recentlyDecided, SCHEMES, voucherSchemes, vouchersToRedeem } from "@/lib/domain/vouchers";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { db, organisationId } = await requireOwner();
  const [balances, reminders, schemes, toRedeem, decided] = await Promise.all([
    familyBalances(db, organisationId),
    feeRemindersOn(db, organisationId),
    voucherSchemes(db, organisationId),
    vouchersToRedeem(db, organisationId),
    recentlyDecided(db, organisationId),
  ]);
  const owed = balances.filter((b) => b.balanceCents > 0).reduce((s, b) => s + b.balanceCents, 0);
  const overdue = balances.reduce((s, b) => s + b.overdueCents, 0);
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 max-w-xl text-muted">
          Term fees come from each class&apos;s price per lesson (on the class) and are added from a
          term&apos;s page. Record payments and credits on each family&apos;s page.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-muted">Owed to you</p>
          <p className="font-display text-3xl font-semibold tracking-tight">{formatMoney(owed)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-muted">Overdue</p>
          <p className="font-display text-3xl font-semibold tracking-tight">
            {formatMoney(overdue)}
          </p>
        </div>
      </div>
      <FeeRemindersSwitch on={reminders} />
      {balances.length === 0 ? (
        <EmptyState icon={<Wallet />} title="Everyone's paid up">
          Families with something owing or in credit show here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {balances.map((b) => (
            <li key={b.familyId}>
              <Link
                href={`/business/families/${b.familyId}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#faf9fc]"
              >
                <span className="font-semibold">{b.name}</span>
                <span className="flex flex-col items-end">
                  <span
                    className={
                      b.balanceCents > 0 ? "font-semibold tabular-nums" : "text-sm text-[#23694c]"
                    }
                  >
                    {balanceWords(b.balanceCents)}
                  </span>
                  {b.overdueCents > 0 ? (
                    <span className="text-sm font-semibold text-danger">
                      {formatMoney(b.overdueCents)} overdue
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="vouchers" className="flex flex-col gap-4">
        <h2 id="vouchers" className="font-display text-2xl font-semibold">
          Government vouchers
        </h2>
        {toRedeem.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {toRedeem.map((v) => (
              <li
                key={v.id}
                aria-label={`${SCHEMES[v.scheme].name} voucher from ${v.familyName}`}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"
              >
                <div>
                  <Link href={`/business/families/${v.familyId}`} className="font-semibold">
                    {v.familyName}
                  </Link>
                  <p className="text-muted">
                    {SCHEMES[v.scheme].name}
                    {v.childName ? ` for ${v.childName}` : ""} · code{" "}
                    <span className="font-mono font-semibold text-ink">{v.code}</span>
                  </p>
                </div>
                <VoucherDecision voucher={v} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No vouchers waiting to be redeemed.</p>
        )}
        {decided.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted">Dealt with this week</h3>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
              {decided.map((v) => (
                <li key={v.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                  <span>
                    <span className="font-semibold">{v.familyName}</span>
                    <span className="text-muted">
                      {" "}
                      · {SCHEMES[v.scheme].name} · {v.code}
                    </span>
                  </span>
                  <span className="text-sm">
                    {v.status === "redeemed" && v.amountCents
                      ? `${formatMoney(v.amountCents)} credited`
                      : `Declined: ${v.declineReason ?? ""}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-lg border border-line bg-surface p-5">
          <VoucherSchemesForm selected={schemes} />
        </div>
      </section>
    </div>
  );
}
