import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { AttendanceButtons } from "@/components/instructor/attendance-buttons";
import { instructorContext } from "@/lib/demo/context";
import { reportedAway, resolveClassId } from "@/lib/demo/service";
import { EMPTY_STATE } from "@/lib/demo/state-schema";
import { currentLesson, lessonAttendance } from "@/lib/domain/attendance";
import { classRoster } from "@/lib/domain/enrolments";
import { getClass } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };

export default async function InstructorClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { state, demo, db } = await instructorContext();
  const c = await getClass(db, resolveClassId(slug));
  if (!c) notFound();

  const [lesson, roster] = await Promise.all([currentLesson(db, c.id), classRoster(db, c.id)]);
  const open = lesson?.open ?? false;
  const marks = open ? ((await lessonAttendance(db, [lesson!.id])).get(lesson!.id) ?? null) : null;
  const overlay = demo ? state : EMPTY_STATE;
  const kids = roster.map((k) => {
    const status = marks?.get(k.childId);
    return {
      ...k,
      name: `${k.firstName} ${k.lastName}`,
      status: status === "present" || status === "absent" ? status : null,
      reportedAway: reportedAway(k.childId, c.id, overlay),
    };
  });
  const present = kids.filter((k) => k.status === "present").length;
  const marked = kids.filter((k) => k.status !== null).length;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/instructor">Your classes</BackLink>
      <div>
        <p className="font-semibold text-muted">
          {c.day} {c.time}
          {c.location ? ` · ${c.location}` : ""}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{c.name}</h1>
        {!lesson ? (
          <p className="mt-1 text-muted">No lessons scheduled.</p>
        ) : open ? (
          <p className="tabular mt-1 text-muted" aria-live="polite">
            Lesson {formatLessonDate(lesson.startsAt, c.timezone)} · {present} here · {marked} of{" "}
            {kids.length} marked
          </p>
        ) : (
          <p className="mt-1 text-muted">
            Next lesson {formatLessonDate(lesson.startsAt, c.timezone)}. Attendance opens an hour
            before it starts.
          </p>
        )}
      </div>

      {kids.length === 0 ? (
        <p className="rounded-lg bg-surface p-5 text-muted shadow-[0_1px_0_var(--border)]">
          No children are enrolled in this class yet.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 md:gap-3">
          {kids.map((kid) => (
            <li
              key={kid.childId}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-surface p-2 pl-4 shadow-[0_1px_0_var(--border)]",
                kid.status === "present" && "bg-[#eef8f3]",
                kid.status === "absent" && "bg-[#fff4f1]",
              )}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/instructor/child/${kid.childId}`}
                  className="inline-flex min-h-11 items-center gap-1 text-lg font-semibold underline-offset-4 hover:underline"
                >
                  {kid.name}
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                </Link>
                {kid.reportedAway ? (
                  <p className="-mt-1 text-sm font-semibold text-[#b4503d]">Parent reported away</p>
                ) : null}
              </div>
              {open ? (
                <AttendanceButtons
                  occurrenceId={lesson!.id}
                  childId={kid.childId}
                  name={kid.name}
                  status={kid.status}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
