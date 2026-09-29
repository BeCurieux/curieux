import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import { ASSESS_EVERY_DAYS, progressOverview } from "@/lib/domain/progress";
import { formatLessonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Progress" };

const SHOW_GAPS = 12;

export default async function ProgressPage() {
  const { db } = await requireOwner();
  const { levels, gaps } = await progressOverview(db);
  const weeks = ASSESS_EVERY_DAYS / 7;

  if (levels.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Progress</h1>
        <EmptyState icon={<TrendingUp />} title="No levels yet">
          Set up your levels and skills to track how children are progressing.
        </EmptyState>
        <Button asChild variant="soft" className="w-fit">
          <Link href="/business/settings/programs">Set up levels</Link>
        </Button>
      </div>
    );
  }

  const most = Math.max(1, ...levels.map((l) => l.children));

  return (
    <div className="rise flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Progress</h1>

      <section aria-labelledby="levels" className="flex flex-col gap-3">
        <h2 id="levels" className="font-display text-2xl font-semibold tracking-tight">
          Levels
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {levels.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[160px_1fr_auto]"
            >
              <div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-muted">{l.program}</p>
              </div>
              <div className="order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-surface-soft sm:order-none sm:col-span-1">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${(l.children / most) * 100}%` }}
                />
              </div>
              <p className="tabular text-right text-sm text-muted">
                {l.children} {l.children === 1 ? "child" : "children"} ·{" "}
                {l.skills === 0 ? (
                  <Link
                    href={`/business/settings/levels/${l.id}`}
                    className="font-semibold text-ink underline underline-offset-2"
                  >
                    add skills
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{l.toAssess} to assess</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="assess" className="flex flex-col gap-3">
        <div>
          <h2 id="assess" className="font-display text-2xl font-semibold tracking-tight">
            Children needing assessment
          </h2>
          <p className="text-muted">No skills updated in the last {weeks} weeks.</p>
        </div>
        {gaps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-5 text-muted">
            Everyone has been assessed recently.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {gaps.slice(0, SHOW_GAPS).map((c) => (
              <li
                key={`${c.childId}-${c.level}`}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.lastAssessed
                      ? `Last assessed ${formatLessonDate(c.lastAssessed, "Australia/Sydney")}`
                      : "Not assessed yet"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-soft px-3 py-1 text-sm font-semibold">
                  {c.level}
                </span>
              </li>
            ))}
          </ul>
        )}
        {gaps.length > SHOW_GAPS ? (
          <p className="text-sm text-muted">And {gaps.length - SHOW_GAPS} more.</p>
        ) : null}
      </section>
    </div>
  );
}
