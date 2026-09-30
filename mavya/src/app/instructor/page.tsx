import { ArrowRight, Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/demo/empty-state";
import { firstName, instructorContext } from "@/lib/demo/context";
import { classSlug } from "@/lib/demo/service";
import { currentLessons, lessonAttendance } from "@/lib/domain/attendance";
import { classViews } from "@/lib/domain/lessons";
import { myMembershipId } from "@/lib/domain/schedule";
import { listClasses } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Teaching" };

const PASSES = ["pass-mint", "pass-butter", "pass-lilac", "pass-coral"];

export default async function InstructorHome() {
  const { viewer, db, organisationId, organisationName } = await instructorContext();
  const membershipId = await myMembershipId(db, viewer.userId, organisationId);
  const classes = (
    await classViews(db, await listClasses(db, { activeOnly: true, instructorId: membershipId }))
  ).sort((a, b) => (a.nextLesson ?? "").localeCompare(b.nextLesson ?? ""));

  const lessons = await currentLessons(
    db,
    classes.map((c) => c.id),
  );
  const openIds = [...lessons.values()].filter((l) => l.open).map((l) => l.id);
  const marks = await lessonAttendance(db, openIds);

  // What each class's pass says under its name.
  const note = (c: (typeof classes)[number]) => {
    const lesson = lessons.get(c.id);
    if (!lesson) return "No lessons scheduled";
    const date = formatLessonDate(lesson.startsAt, c.timezone);
    if (!lesson.open) return `Next: ${date}`;
    const marked = marks.get(lesson.id)?.size ?? 0;
    return marked === 0
      ? `${date} · attendance not taken`
      : `${date} · ${marked} of ${c.enrolled} marked`;
  };

  return (
    <div className="rise flex flex-col gap-6">
      <div>
        <p className="font-semibold text-muted">{organisationName}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Hi {firstName(viewer.name)}
        </h1>
      </div>
      {classes.length === 0 ? (
        <EmptyState icon={<Waves />} title="No classes yet">
          When you&apos;re assigned classes, they&apos;ll be here with their rosters one tap away.
        </EmptyState>
      ) : (
        <section aria-labelledby="classes" className="grid gap-3 md:grid-cols-2">
          <h2 id="classes" className="font-display text-xl font-semibold md:col-span-2">
            Your classes
          </h2>
          {classes.map((c, i) => (
            <Link
              key={c.id}
              href={`/instructor/class/${classSlug(c.id)}`}
              aria-label={`${c.name}, ${c.day} ${c.time}`}
              className={`pass ${PASSES[i % PASSES.length]} block p-6 text-ink`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-semibold tracking-tight">{c.name}</p>
                  <p className="text-lg font-semibold">
                    {c.day} {c.time} · {c.expected} {c.expected === 1 ? "child" : "children"}
                  </p>
                </div>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/60 [&_svg]:size-6">
                  <ArrowRight aria-hidden />
                </span>
              </div>
              <p className="tabular mt-6 inline-flex rounded-full bg-white/60 px-3 py-1 text-sm font-semibold">
                {note(c)}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
