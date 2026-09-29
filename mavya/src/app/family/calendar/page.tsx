import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CHILD_FILL } from "@/components/demo/activity-pass";
import { EmptyState } from "@/components/demo/empty-state";
import { familyContext } from "@/lib/demo/context";
import { PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { familyChildren } from "@/lib/demo/family";
import { EMPTY_STATE } from "@/lib/demo/state-schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Entry = {
  child: string;
  slug: string;
  time: string;
  label: string;
  colour: keyof typeof CHILD_FILL;
  away?: boolean;
  makeup?: boolean;
};

export default async function CalendarPage() {
  const { state, db, demo } = await familyContext();
  const children = await familyChildren(db, demo ? state : EMPTY_STATE);

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

  const entries = new Map<string, Entry[]>();
  const add = (day: string, entry: Entry) => entries.set(day, [...(entries.get(day) ?? []), entry]);
  for (const child of children) {
    for (const klass of child.classes) {
      add(klass.day, {
        child: child.firstName,
        slug: child.slug,
        time: klass.time,
        label: `${klass.program === "Learn to Swim" ? "Swimming" : klass.program} · ${klass.level}`,
        colour: child.colour,
        away: child.away && klass.id === PRIMARY_CLASS_ID,
      });
    }
    if (child.makeup) {
      add(child.makeup.day, {
        child: child.firstName,
        slug: child.slug,
        time: child.makeup.time,
        label: `Make-up · ${child.makeup.level}`,
        colour: child.colour,
        makeup: true,
      });
    }
  }

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">This week</h1>
      <ol className="flex flex-col gap-2">
        {WEEK.map((day) => {
          const items = entries.get(day) ?? [];
          return (
            <li key={day} className="flex gap-4">
              <div className="w-12 shrink-0 pt-3 text-sm font-bold tracking-wide text-muted uppercase">
                {day.slice(0, 3)}
              </div>
              <div className="flex min-h-12 flex-1 flex-col gap-2 border-t border-line pt-2">
                {items.map((item) => (
                  <Link
                    key={`${item.child}-${item.time}`}
                    href={`/family/kids/${item.slug}`}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-3 transition hover:brightness-95",
                      item.away ? "bg-surface text-muted" : CHILD_FILL[item.colour],
                    )}
                  >
                    <span className="tabular font-display text-lg font-semibold">{item.time}</span>
                    <span className={cn("flex-1 font-semibold", item.away && "line-through")}>
                      {item.child} · {item.label}
                    </span>
                    {item.away ? <span className="text-sm font-semibold">Away</span> : null}
                    {item.makeup ? (
                      <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold uppercase">
                        New
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
