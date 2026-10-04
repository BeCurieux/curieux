import type { Metadata } from "next";
import Link from "next/link";
import { ClassForm, type ClassPreset } from "@/components/business/class-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listInstructors, listLocations, listPrograms } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, organisationId } = await requireOwner();
  const q = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/;
  // Details carried from a new class opportunity (M8b); checked, never trusted.
  const preset: ClassPreset = {
    name: q.name?.slice(0, 60),
    levelId: q.level && uuid.test(q.level) ? q.level : undefined,
    locationId: q.location && uuid.test(q.location) ? q.location : undefined,
    weekday: q.weekday && /^[1-7]$/.test(q.weekday) ? Number(q.weekday) : undefined,
    startTime: q.time && /^\d{2}:\d{2}$/.test(q.time) ? q.time : undefined,
  };
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
        <ClassForm
          preset={preset}
          locations={locations}
          programs={programs}
          instructors={instructors}
        />
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
