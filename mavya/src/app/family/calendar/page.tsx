import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CHILD_FILL } from "@/components/demo/activity-pass";
import { EmptyState } from "@/components/demo/empty-state";
import { familyContext } from "@/lib/demo/context";
import { familyChildren, familyWeek } from "@/lib/family/children";
import { lessonMoment } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const { db } = await familyContext();
  const children = await familyChildren(db);

  if (children.every((c) => c.classes.length === 0)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">This week</h1>
        <EmptyState icon={<CalendarDays />} title="A quiet week">
          Classes will appear here once they&apos;re booked.
        </EmptyState>
      </div>
    );
  }

  const lessons = await familyWeek(db, children);
  const byChild = new Map(children.map((c) => [c.id, c]));
  // The next seven days, starting today, in the family's first timezone.
  const tz = children.find((c) => c.primary)?.primary?.timezone ?? "Australia/Sydney";
  const days = weekDays(tz);

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">This week</h1>
      <ol className="flex flex-col gap-2">
        {days.map((day) => {
          const items = lessons.filter(
            (l) => lessonMoment(l.startsAt, l.klass.timezone).date === day.key,
          );
          return (
            <li key={day.key} className="flex gap-4">
              <div className="w-12 shrink-0 pt-3 text-sm font-bold tracking-wide text-muted uppercase">
                {day.label}
                <span className="block text-xs font-semibold normal-case">
                  {day.key.split(" ").slice(1).join(" ")}
                </span>
              </div>
              <div className="flex min-h-12 flex-1 flex-col gap-2 border-t border-line pt-2">
                {items.map((item) => {
                  const child = byChild.get(item.childId)!;
                  const when = lessonMoment(item.startsAt, item.klass.timezone);
                  const off = Boolean(item.absenceId) || item.status === "cancelled";
                  const activity =
                    item.klass.program === "Learn to Swim" ? "Swimming" : item.klass.program;
                  return (
                    <Link
                      key={`${item.childId}-${item.occurrenceId}`}
                      href={`/family/kids/${child.slug}`}
                      className={cn(
                        "flex items-center gap-3 rounded-md p-3 transition hover:brightness-95",
                        off ? "bg-surface text-muted" : CHILD_FILL[child.colour],
                      )}
                    >
                      <span className="tabular font-display text-lg font-semibold">
                        {when.time}
                      </span>
                      <span className={cn("flex-1 font-semibold", off && "line-through")}>
                        {child.firstName} · {item.kind === "makeup" ? "Make-up" : activity} ·{" "}
                        {item.klass.level}
                      </span>
                      {item.status === "cancelled" ? (
                        <span className="text-sm font-semibold">Cancelled</span>
                      ) : item.absenceId ? (
                        <span className="text-sm font-semibold">Away</span>
                      ) : item.kind === "makeup" ? (
                        <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold uppercase">
                          Make-up
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Today and the six days after it, as the family's timezone names them.
function weekDays(tz: string) {
  const now = Date.now();
  return Array.from({ length: 7 }, (_, i) => {
    const moment = lessonMoment(new Date(now + i * 86_400_000).toISOString(), tz);
    return { key: moment.date, label: moment.day.slice(0, 3) };
  });
}
