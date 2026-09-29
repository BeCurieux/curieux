import { ArrowRight, Waves } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/demo/empty-state";
import { firstName, instructorContext } from "@/lib/demo/context";
import { ORGANISATION, PRIMARY_CLASS_ID } from "@/lib/demo/data";
import { classSlug, findClass, roster } from "@/lib/demo/service";

export const metadata: Metadata = { title: "Teaching" };

export default async function InstructorHome() {
  const { viewer, state, demo } = await instructorContext();
  const orgName = viewer.staff.find((s) => s.role === "instructor")?.organisationName ?? "";

  const heading = (
    <div>
      <p className="font-semibold text-muted">{demo ? ORGANISATION.name : orgName}</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Hi {firstName(viewer.name)}
      </h1>
    </div>
  );

  if (!demo) {
    return (
      <>
        {heading}
        <EmptyState icon={<Waves />} title="No classes today">
          When you&apos;re assigned classes, they&apos;ll be here with attendance one tap away.
        </EmptyState>
      </>
    );
  }

  const today = findClass(PRIMARY_CLASS_ID, state)!;
  const kids = roster(state);
  const marked = kids.filter((k) => k.status === "present" || k.status === "absent").length;

  return (
    <div className="rise flex flex-col gap-6">
      {heading}
      <section aria-labelledby="today" className="flex flex-col gap-3">
        <h2 id="today" className="font-display text-xl font-semibold">
          Today&apos;s classes
        </h2>
        <Link
          href={`/instructor/class/${classSlug(today)}`}
          className="pass pass-mint block p-6 text-ink"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-semibold tracking-tight">{today.level}</p>
              <p className="text-lg font-semibold">
                {today.time} · {today.expected} swimmers
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-full bg-white/60 [&_svg]:size-6">
              <ArrowRight aria-hidden />
            </span>
          </div>
          <p className="tabular mt-6 inline-flex rounded-full bg-white/60 px-3 py-1 text-sm font-semibold">
            {marked === 0 ? "Attendance not taken" : `${marked} of ${kids.length} marked`}
          </p>
        </Link>
      </section>
    </div>
  );
}
