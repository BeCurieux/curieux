import { History } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { requireOwner } from "@/lib/business/owner";
import { recentActivity } from "@/lib/domain/activity";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const { db, organisationId } = await requireOwner();
  const items = await recentActivity(db, organisationId);
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-muted">
          The latest 50 changes to your classes, families and enrolments.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<History />} title="Nothing yet">
          Changes you and your staff make will be listed here.
        </EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5"
            >
              <p>
                <span className="font-semibold">{item.who}</span> <span>{item.what}</span>
              </p>
              <time dateTime={item.when} className="tabular text-sm text-muted">
                {formatDateTime(item.when)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
