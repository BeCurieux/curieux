import type { Metadata } from "next";
import Link from "next/link";
import { ClassForm } from "@/components/business/class-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listInstructors, listLocations, listPrograms } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage() {
  const { db, organisationId } = await requireOwner();
  const [locations, programs, instructors] = await Promise.all([
    listLocations(db),
    listPrograms(db),
    listInstructors(db, organisationId),
  ]);
  const ready = locations.length > 0 && programs.some((p) => p.levels.length > 0);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/classes">Classes</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">New class</h1>
      {ready ? (
        <ClassForm locations={locations} programs={programs} instructors={instructors} />
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
          <p className="font-semibold">A class needs a location and a level first.</p>
          <p className="text-muted">
            Add them in{" "}
            <Link href="/business/settings/locations" className="font-semibold text-ink underline">
              Locations
            </Link>{" "}
            and{" "}
            <Link href="/business/settings/programs" className="font-semibold text-ink underline">
              Programs &amp; levels
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
