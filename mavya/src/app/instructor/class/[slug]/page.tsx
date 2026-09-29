import { Check, ChevronRight, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/demo/back-link";
import { markAttendance } from "@/lib/demo/actions";
import { instructorContext } from "@/lib/demo/context";
import { PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { resolveClassId, rosterStatus } from "@/lib/demo/service";
import { EMPTY_STATE } from "@/lib/demo/state-schema";
import { classRoster } from "@/lib/domain/enrolments";
import { getClass } from "@/lib/domain/timetable";
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

  // Attendance is demo until M3, and only on the demo's Wednesday class.
  const attendance = demo && c.id === PRIMARY_CLASS_ID;
  const overlay = demo ? state : EMPTY_STATE;
  const kids = (await classRoster(db, c.id)).map((k) => ({
    ...k,
    name: `${k.firstName} ${k.lastName}`,
    ...rosterStatus(k.childId, c.id, overlay),
  }));
  const present = kids.filter((k) => k.status === "present").length;
  const marked = kids.filter((k) => k.status === "present" || k.status === "absent").length;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/instructor">Your classes</BackLink>
      <div>
        <p className="font-semibold text-muted">
          {c.day} {c.time}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{c.name}</h1>
        <p className="tabular mt-1 text-muted" aria-live="polite">
          {attendance
            ? `${present} here · ${marked} of ${kids.length} marked`
            : `${kids.length} ${kids.length === 1 ? "child" : "children"} enrolled`}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
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
              {attendance && kid.hasProgress ? (
                <Link
                  href="/instructor/child/ava"
                  className="inline-flex min-h-11 items-center gap-1 text-lg font-semibold underline-offset-4 hover:underline"
                >
                  {kid.name}
                  <ChevronRight aria-hidden className="size-5 text-muted" />
                </Link>
              ) : (
                <p className="py-2.5 text-lg font-semibold">{kid.name}</p>
              )}
              {kid.reportedAway ? (
                <p className="-mt-1 text-sm font-semibold text-[#b4503d]">Parent reported away</p>
              ) : null}
            </div>
            {attendance ? (
              <>
                <AttendanceButton
                  childId={kid.childId}
                  name={kid.name}
                  value="present"
                  current={kid.status}
                />
                <AttendanceButton
                  childId={kid.childId}
                  name={kid.name}
                  value="absent"
                  current={kid.status}
                />
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttendanceButton({
  childId,
  name,
  value,
  current,
}: {
  childId: string;
  name: string;
  value: "present" | "absent";
  current: string;
}) {
  const on = current === value;
  const Icon = value === "present" ? Check : X;
  return (
    <form action={markAttendance.bind(null, childId, value)}>
      <button
        type="submit"
        aria-pressed={on}
        aria-label={`Mark ${name} ${value === "present" ? "here" : "away"}`}
        className={cn(
          "grid size-14 place-items-center rounded-md border-2 transition active:scale-95 [&_svg]:size-7",
          on && value === "present" && "border-success bg-success text-white",
          on && value === "absent" && "border-danger bg-danger text-white",
          !on && "border-line bg-surface text-muted hover:border-ink hover:text-ink",
        )}
      >
        <Icon aria-hidden strokeWidth={3} />
      </button>
    </form>
  );
}
