import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/demo/empty-state";
import { businessContext } from "@/lib/demo/context";
import { LEVELS, NEEDS_ASSESSMENT } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { demo } = await businessContext();
  if (!demo) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Progress</h1>
        <EmptyState icon={<TrendingUp />} title="No levels yet">
          Set up your levels and skills to track how children are progressing.
        </EmptyState>
      </div>
    );
  }

  const most = Math.max(...LEVELS.map((l) => l.children));

  return (
    <div className="rise flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Progress</h1>

      <section aria-labelledby="levels" className="flex flex-col gap-3">
        <h2 id="levels" className="font-display text-2xl font-semibold tracking-tight">
          Learn to Swim levels
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {LEVELS.map((l) => (
            <li
              key={l.name}
              className="grid grid-cols-[110px_1fr_auto] items-center gap-4 px-5 py-4"
            >
              <p className="font-semibold">{l.name}</p>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${(l.children / most) * 100}%` }}
                />
              </div>
              <p className="tabular text-sm text-muted">
                {l.children} children ·{" "}
                <span className="font-semibold text-ink">{l.needAssessment} to assess</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="assess" className="flex flex-col gap-3">
        <h2 id="assess" className="font-display text-2xl font-semibold tracking-tight">
          Children needing assessment
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {NEEDS_ASSESSMENT.map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">{c.note}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-soft px-3 py-1 text-sm font-semibold">
                {c.level}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
