import { ArrowRight, Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/demo/empty-state";
import { firstName, instructorContext } from "@/lib/demo/context";
import { PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { classSlug, rosterStatus, withDemo } from "@/lib/demo/service";
import { EMPTY_STATE } from "@/lib/demo/state-schema";
import { classRoster } from "@/lib/domain/enrolments";
import { myMembershipId } from "@/lib/domain/schedule";
import { listClasses } from "@/lib/domain/timetable";
import { formatLessonDate } from "@/lib/format";

export const metadata: Metadata = { title: "Teaching" };

const PASSES = ["pass-mint", "pass-butter", "pass-lilac", "pass-coral"];

export default async function InstructorHome() {
  const { viewer, db, state, demo, organisationId, organisationName } = await instructorContext();
  const membershipId = await myMembershipId(db, viewer.userId, organisationId);
  const overlay = demo ? state : EMPTY_STATE;
  const classes = (await listClasses(db, { activeOnly: true, instructorId: membershipId }))
    .map((c) => withDemo(c, overlay))
    .sort((a, b) => (a.nextLesson ?? "").localeCompare(b.nextLesson ?? ""));

  // Attendance is demo until M3, on the demo's Wednesday class only.
  const demoRoster = classes.some((c) => c.id === PRIMARY_CLASS_ID)
    ? await classRoster(db, PRIMARY_CLASS_ID)
    : [];
  const marked = demoRoster.filter((k) => {
    const { status } = rosterStatus(k.childId, PRIMARY_CLASS_ID, overlay);
    return status === "present" || status === "absent";
  }).length;

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
        <section aria-labelledby="classes" className="flex flex-col gap-3">
          <h2 id="classes" className="font-display text-xl font-semibold">
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
                {c.id === PRIMARY_CLASS_ID
                  ? marked === 0
                    ? "Attendance not taken"
                    : `${marked} of ${demoRoster.length} marked`
                  : c.nextLesson
                    ? `Next: ${formatLessonDate(c.nextLesson, c.timezone)}`
                    : "No lessons scheduled"}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
