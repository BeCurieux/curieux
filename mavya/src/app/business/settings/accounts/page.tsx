import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { requireOwner } from "@/lib/business/owner";
import { balanceWords, familyBalances, formatMoney } from "@/lib/domain/accounts";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { db, organisationId } = await requireOwner();
  const balances = await familyBalances(db, organisationId);
  const owed = balances.filter((b) => b.balanceCents > 0).reduce((s, b) => s + b.balanceCents, 0);
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
      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="text-sm font-semibold text-muted">Owed to you</p>
        <p className="font-display text-3xl font-semibold tracking-tight">{formatMoney(owed)}</p>
      </div>
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
                <span
                  className={
                    b.balanceCents > 0 ? "font-semibold tabular-nums" : "text-sm text-[#23694c]"
                  }
                >
                  {balanceWords(b.balanceCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
