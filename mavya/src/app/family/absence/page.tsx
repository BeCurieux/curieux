import { CalendarX2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { AbsenceForm } from "@/components/family/absence-form";
import { familyContext } from "@/lib/demo/context";
import { familyLessons } from "@/lib/domain/lessons";
import { getPolicy, policySummary } from "@/lib/domain/makeups";
import { familyChildren } from "@/lib/family/children";
import { lessonMoment } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Can't make it" };

// How many upcoming lessons a parent can choose from.
const CHOICES = 4;

export default async function AbsencePage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: wanted } = await searchParams;
  const { db } = await familyContext();
  const children = (await familyChildren(db)).filter((c) => c.classes.length > 0);
  const child = children.find((c) => c.slug === wanted) ?? children.find((c) => c.next) ?? null;

  if (!child) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/family">Home</BackLink>
        <EmptyState icon={<CalendarX2 />} title="No lessons to miss">
          Once your children have classes, you can let their provider know here.
        </EmptyState>
      </div>
    );
  }

  const policy = await getPolicy(db, child.classes[0]!.organisationId);
  const upcoming = (
    await familyLessons(db, [{ id: child.id, classIds: child.classes.map((k) => k.id) }], 28)
  )
    .filter(
      (l) =>
        l.kind === "regular" &&
        l.status === "scheduled" &&
        !l.absenceId &&
        new Date(l.startsAt) > new Date(),
    )
    .slice(0, CHOICES);
  const classById = new Map(child.classes.map((k) => [k.id, k]));
  const lessons = upcoming.map((l) => {
    const klass = classById.get(l.classId)!;
    const when = lessonMoment(l.startsAt, klass.timezone);
    return {
      occurrenceId: l.occurrenceId,
      title: `${when.day} ${when.date} · ${when.time}`,
      detail: `${child.firstName} · ${klass.program === "Learn to Swim" ? "Swimming" : klass.program}, ${klass.level}`,
    };
  });

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>
      <div>
        <p className="font-semibold text-muted">Can&apos;t make it?</p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          Let {child.organisation} know
        </h1>
      </div>

      {children.length > 1 ? (
        <nav aria-label="Child" className="flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/family/absence?child=${c.slug}`}
              aria-current={c.id === child.id ? "true" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 font-semibold transition",
                c.id === child.id
                  ? "bg-ink text-white"
                  : "bg-surface text-ink hover:bg-surface-soft",
              )}
            >
              {c.firstName}
            </Link>
          ))}
        </nav>
      ) : null}

      {lessons.length === 0 ? (
        <EmptyState icon={<CalendarX2 />} title="Nothing to report">
          {child.firstName} has no upcoming lessons you haven&apos;t already told us about.
        </EmptyState>
      ) : (
        <AbsenceForm
          key={child.id}
          childId={child.id}
          lessons={lessons}
          rules={policySummary(policy, child.primary?.level ?? null)}
          organisation={child.organisation}
        />
      )}
    </div>
  );
}
