import { CalendarDays, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrolForm } from "@/components/business/enrol-form";
import { OccupancyBar } from "@/components/business/occupancy-bar";
import { Stat } from "@/components/business/stat";
import { BackLink } from "@/components/demo/back-link";
import { Button } from "@/components/ui/button";
import { endEnrolment } from "@/lib/business/actions";
import { businessContext } from "@/lib/demo/context";
import { candidatesFor, reportedAway, resolveClassId, withDemo } from "@/lib/demo/service";
import { currentLesson, lessonAttendance } from "@/lib/domain/attendance";
import { classRoster } from "@/lib/domain/enrolments";
import { childrenNotInClass } from "@/lib/domain/families";
import { getClass, upcomingLessons } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, organisationId, state, demo } = await businessContext();
  const real = await getClass(db, resolveClassId(slug));
  if (!real) notFound();

  const c = withDemo(real, demo ? state : { ...state, absence: null, makeupClassId: null });
  const [roster, lessons, available, lesson] = await Promise.all([
    classRoster(db, c.id),
    upcomingLessons(db, c.id),
    childrenNotInClass(db, organisationId, c.id),
    currentLesson(db, c.id),
  ]);
  // Attendance for the lesson on now or most recently.
  const marks = lesson?.open
    ? ((await lessonAttendance(db, [lesson.id])).get(lesson.id) ?? new Map())
    : null;
  const here = marks ? [...marks.values()].filter((s) => s === "present").length : 0;
  const away = marks ? [...marks.values()].filter((s) => s === "absent").length : 0;
  const candidates = demo ? candidatesFor(c.id, state) : [];
  const full = c.enrolled >= c.capacity;

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/classes">Classes</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-muted">
            {c.day} {c.time} · {c.location} · {c.level}
            {c.active ? "" : " · Not running"}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{c.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="soft">
            <Link href={`/business/classes/${c.id}/edit`}>
              <Pencil aria-hidden />
              Edit class
            </Link>
          </Button>
          {c.temporaryVacancies > 0 ? (
            <Button asChild variant="warm">
              <Link href="/business/fill">
                Fill {c.temporaryVacancies} open {c.temporaryVacancies === 1 ? "spot" : "spots"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <section
        aria-labelledby="occupancy"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="occupancy" className="font-semibold">
          Occupancy
        </h2>
        <OccupancyBar
          expected={c.expected}
          vacancies={c.temporaryVacancies}
          capacity={c.capacity}
        />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Enrolled" value={c.enrolled} suffix={` / ${c.capacity}`} />
          <Stat label="Absences" value={c.absences} />
          <Stat
            label="Temporary vacancies"
            value={c.temporaryVacancies}
            tone={c.temporaryVacancies > 0 ? "attention" : "plain"}
          />
          <Stat label="Make-up candidates" value={candidates.length} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="roster" className="flex flex-col gap-3">
          <h2 id="roster" className="font-display text-2xl font-semibold tracking-tight">
            Roster
          </h2>
          {marks ? (
            <p className="tabular -mt-2 text-muted">
              Lesson {formatLessonDate(lesson!.startsAt, c.timezone)}:{" "}
              {marks.size === 0
                ? "attendance not taken yet"
                : `${here} here · ${away} away · ${roster.length - marks.size} not marked`}
            </p>
          ) : null}
          {roster.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface p-5 text-muted">
              No one enrolled yet.
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
              {roster.map((child) => {
                // A parent's report comes first; then this lesson's attendance.
                const mark = marks?.get(child.childId);
                const label = reportedAway(
                  child.childId,
                  c.id,
                  demo ? state : { ...state, absence: null },
                )
                  ? "Reported away"
                  : mark === "present"
                    ? "Here"
                    : mark === "absent"
                      ? "Away"
                      : marks
                        ? "Not marked"
                        : "Expected";
                return (
                  <li
                    key={child.enrolmentId}
                    className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-sm text-muted">{child.family}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-sm font-semibold",
                          label === "Reported away" || label === "Away"
                            ? "bg-[#fff0ec] text-[#b4503d]"
                            : label === "Here"
                              ? "bg-[#dcf1e7] text-[#1d5a41]"
                              : "bg-surface-soft text-muted",
                        )}
                      >
                        {label}
                      </span>
                      <form action={endEnrolment.bind(null, child.enrolmentId)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${child.firstName} ${child.lastName} from ${c.name}`}
                        >
                          Remove
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="enrol" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="enrol" className="sr-only">
              Enrol a child
            </h2>
            {!c.active ? (
              <p className="text-muted">
                This class isn&apos;t running, so no one can be enrolled.
              </p>
            ) : full ? (
              <p className="font-semibold">This class is full.</p>
            ) : available.length === 0 ? (
              <p className="text-muted">
                Every child is already in this class.{" "}
                <Link href="/business/families/new" className="font-semibold text-ink underline">
                  Add a family
                </Link>{" "}
                to enrol someone new.
              </p>
            ) : (
              <EnrolForm classId={c.id} options={available} />
            )}
          </section>

          <section aria-labelledby="lessons" className="flex flex-col gap-3">
            <h2
              id="lessons"
              className="inline-flex items-center gap-2 font-display text-xl font-semibold"
            >
              <CalendarDays aria-hidden className="size-5" />
              Upcoming lessons
            </h2>
            {lessons.length === 0 ? (
              <p className="text-muted">None scheduled.</p>
            ) : (
              <ol className="grid grid-cols-2 gap-2">
                {lessons.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      "tabular rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold",
                      l.status === "cancelled" && "text-muted line-through",
                    )}
                  >
                    {formatLessonDate(l.startsAt, c.timezone)}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
