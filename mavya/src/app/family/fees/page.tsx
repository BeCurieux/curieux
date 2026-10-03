import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Balance, Statement } from "@/components/accounts/statement";
import { EmptyState } from "@/components/demo/empty-state";
import { familyContext } from "@/lib/demo/context";
import { balanceOf, familyLines } from "@/lib/domain/accounts";

export const metadata: Metadata = { title: "Fees" };

// Each family's statement (M7a): what's owed and every line. Read-only:
// paying in Ovyko comes with card payments.
export default async function FeesPage() {
  const { viewer, db } = await familyContext();
  const accounts = await Promise.all(
    viewer.families.map(async (f) => ({ family: f, lines: await familyLines(db, f.familyId) })),
  );
  const any = accounts.some((a) => a.lines.length > 0);
  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Fees</h1>
      {!any ? (
        <EmptyState icon={<Wallet />} title="Nothing to pay">
          When your activity provider adds term fees, they&apos;ll show here.
        </EmptyState>
      ) : (
        accounts
          .filter((a) => a.lines.length > 0)
          .map(({ family, lines }) => (
            <section
              key={family.familyId}
              aria-label={family.displayName}
              className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]"
            >
              <p className="text-sm font-semibold text-muted">{family.displayName}</p>
              <Balance cents={balanceOf(lines)} />
              <p className="text-sm text-muted">
                To pay, use the details your activity provider gave you. Paying in Ovyko is coming
                soon.
              </p>
              <Statement lines={lines} />
            </section>
          ))
      )}
    </div>
  );
}
