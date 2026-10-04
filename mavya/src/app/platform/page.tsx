import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { ownerTwoStepNeeded, requireViewer } from "@/lib/auth/viewer";
import { formatMoney } from "@/lib/domain/accounts";
import Link from "next/link";
import { amPlatformAdmin, platformMonths, platformTotals } from "@/lib/domain/platform";
import { supportSchools } from "@/lib/domain/support";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ovyko totals" };

// Ovyko's own numbers across every real school (docs/PLATFORM_TOTALS.md).
// Only for the people who run Ovyko, after two-step sign-in; anyone else
// gets "not found". Totals only: no school, family or child is named.
export default async function PlatformPage() {
  await requireViewer();
  if (await ownerTwoStepNeeded()) redirect("/two-step");
  const db = await createClient();
  if (!(await amPlatformAdmin(db))) notFound();
  const [t, months, helping] = await Promise.all([
    platformTotals(db),
    platformMonths(db),
    supportSchools(db),
  ]);

  const tiles: [string, string][] = [
    ["Schools", String(t.schools)],
    ["Paying for Ovyko", String(t.schoolsPaying)],
    ["Monthly subscriptions", formatMoney(t.monthlyRecurringCents)],
    ["Teaching in the next fortnight", String(t.schoolsTeaching)],
    ["Taking payments in Ovyko", String(t.schoolsTakingPayments)],
    ["Families", String(t.families)],
    ["Children enrolled", String(t.childrenEnrolled)],
    ["Fees charged, last 12 months", formatMoney(t.feesCharged365dCents)],
    ["Paid online, last 30 days", formatMoney(t.paidOnline30dCents)],
    ["Paid online, last 12 months", formatMoney(t.paidOnline365dCents)],
    ["Ovyko's share, last 30 days", formatMoney(t.ovykoFees30dCents)],
    ["Ovyko's share, last 12 months", formatMoney(t.ovykoFees365dCents)],
    ["Paid outside Ovyko, last 12 months", formatMoney(t.recordedPayments365dCents)],
  ];
  const monthName = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Wordmark />
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ovyko totals</h1>
        <p className="mt-1 text-muted">
          Every real school, demo schools left out. Numbers only: no family or child is named here,
          and a school only once it has let support in.
        </p>
      </div>
      <section aria-labelledby="support" className="flex flex-col gap-3">
        <h2 id="support" className="font-display text-2xl font-semibold">
          Schools that have let support in
        </h2>
        {helping.length === 0 ? (
          <p className="text-muted">
            None right now. A school lets support in from Settings → Ovyko support, for 48 hours.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {helping.map((h) => (
              <li key={h.organisationId} className="flex flex-col gap-1 px-5 py-3">
                <Link
                  href={`/platform/support/${h.organisationId}`}
                  className="font-semibold underline underline-offset-4"
                >
                  {h.name}
                </Link>
                <span className="text-sm text-muted">
                  Open until {formatDateTime(h.expiresAt)}
                  {h.note ? ` · “${h.note}”` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value]) => (
          <li key={label} className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
          </li>
        ))}
      </ul>
      <section aria-labelledby="months" className="flex flex-col gap-3">
        <h2 id="months" className="font-display text-2xl font-semibold">
          Month by month
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {months.map((m) => (
            <li
              key={m.month}
              className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
            >
              <span className="font-semibold">{monthName(m.month)}</span>
              <span className="text-sm text-muted tabular-nums">
                {m.newSchools} new {m.newSchools === 1 ? "school" : "schools"} ·{" "}
                {formatMoney(m.paidOnlineCents)} paid online · Ovyko {formatMoney(m.ovykoFeesCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
