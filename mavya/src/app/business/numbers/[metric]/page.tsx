import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { businessContext } from "@/lib/demo/context";
import { classSlug } from "@/lib/demo/service";
import { classViews } from "@/lib/domain/lessons";
import {
  absencesThisWeek,
  creditsExpiringThisWeek,
  makeupsDelivered,
  type NumberRow,
} from "@/lib/domain/numbers";
import { listClasses } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Behind the number" };

// Each number on Today, opened: the records it counts and the rule it's
// counted by, in plain words.
const METRICS = {
  today: {
    title: "Children expected today",
    rule: "Everyone enrolled in today's lessons, minus children reported away, plus make-ups booked in.",
  },
  absences: {
    title: "Reported absences",
    rule: "Absences families have reported for lessons in the next 7 days.",
  },
  credits: {
    title: "Make-up credits expiring",
    rule: "Unused make-up credits that run out in the next 7 days.",
  },
  makeups: {
    title: "Make-ups delivered",
    rule: "Make-ups in lessons that have happened in the last 12 weeks: places that would have sat empty, filled without an extra class.",
  },
} as const;

type Metric = keyof typeof METRICS;

export default async function NumberPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  if (!(metric in METRICS)) notFound();
  const { title, rule } = METRICS[metric as Metric];
  const { db } = await businessContext();

  return (
    <div className="rise flex max-w-3xl flex-col gap-6">
      <BackLink href="/business">Today</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted">{rule}</p>
      </div>
      {metric === "today" ? <Today db={db} /> : <Rows rows={await rowsFor(db, metric)} />}
    </div>
  );
}

async function rowsFor(db: Parameters<typeof absencesThisWeek>[0], metric: string) {
  if (metric === "absences") return absencesThisWeek(db);
  if (metric === "credits") return creditsExpiringThisWeek(db);
  return makeupsDelivered(db);
}

function Rows({ rows }: { rows: NumberRow[] }) {
  if (rows.length === 0)
    return (
      <EmptyState icon={<ListChecks />} title="Nothing to count yet">
        Records show up here as they happen.
      </EmptyState>
    );
  return (
    <>
      <p className="tabular font-semibold">
        {rows.length} {rows.length === 1 ? "record" : "records"}
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-muted">{r.detail}</p>
            </div>
            <p className="tabular shrink-0 text-sm font-semibold text-muted">
              {formatLessonDate(r.when, r.timezone)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Today({ db }: { db: Parameters<typeof classViews>[0] }) {
  const views = await classViews(db, await listClasses(db, { activeOnly: true }));
  const now = new Date();
  const today = views.filter(
    (c) =>
      c.lesson &&
      new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }).format(
        new Date(c.lesson.startsAt),
      ) === new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }).format(now),
  );
  if (today.length === 0)
    return (
      <EmptyState icon={<ListChecks />} title="No lessons left today">
        Lessons that haven&apos;t finished yet show up here.
      </EmptyState>
    );
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {today.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
          <Link href={`/business/classes/${classSlug(c.id)}`} className="min-w-0 hover:underline">
            <span className="block font-semibold">
              {c.name} · {c.time}
            </span>
            <span className="block text-sm text-muted">
              {c.enrolled} enrolled − {c.absences} away + {c.makeups} make-ups
            </span>
          </Link>
          <p className="tabular shrink-0 font-semibold">{c.expected}</p>
        </li>
      ))}
    </ul>
  );
}
