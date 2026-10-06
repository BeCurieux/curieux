import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import { EndSupportButton, LetSupportInForm } from "@/components/support/support-forms";
import { requireOwner } from "@/lib/business/owner";
import { openSupportGrant, supportLooks } from "@/lib/domain/support";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Ovyko support" };

// Letting Ovyko support see how the school is set up, for 48 hours, and
// every time they looked (docs/M6_MIGRATION_PILOT.md, M6g).
export default async function SupportPage() {
  const { db, organisationId } = await requireOwner();
  const [grant, looks] = await Promise.all([
    openSupportGrant(db, organisationId),
    supportLooks(db, organisationId),
  ]);
  return (
    <div className="rise flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ovyko support</h1>
        <p className="mt-1 text-muted">
          Need a hand? Let Ovyko support see how your school is set up: your classes, terms,
          locations and settings, and whether payments and emails are working. They never see
          children&apos;s or families&apos; names, health notes, contact details or accounts, and
          can&apos;t change anything.
        </p>
      </div>

      <section
        aria-labelledby="access"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="access" className="font-display text-2xl font-semibold">
          {grant ? "Support can see your school" : "Support can't see your school"}
        </h2>
        {grant ? (
          <>
            <p>
              Until {formatDateTime(grant.expiresAt)}.
              {grant.note ? ` Your note: “${grant.note}”` : ""}
            </p>
            <EndSupportButton />
          </>
        ) : (
          <p className="text-muted">
            Only you can let them in, and it ends by itself after 48 hours.
          </p>
        )}
        <LetSupportInForm again={grant !== null} />
      </section>

      <section aria-labelledby="looks" className="flex flex-col gap-3">
        <h2 id="looks" className="font-display text-2xl font-semibold">
          When support looked
        </h2>
        {looks.length === 0 ? (
          <p className="text-muted">Nobody from Ovyko has looked at your school.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {looks.map((l) => (
              <li key={l.lookedAt} className="flex justify-between gap-4 px-5 py-3">
                <span>{l.lookedBy}</span>
                <span className="text-right text-muted">{formatDateTime(l.lookedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
