import type { Metadata } from "next";
import { CancelLessonsForm } from "@/components/business/makeup-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listLocations } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Cancel lessons" };

export default async function CancelLessonsPage() {
  const { db } = await requireOwner();
  const locations = await listLocations(db);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: locations[0]?.timezone ?? "Australia/Sydney",
  }).format(new Date());
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Cancel lessons</h1>
        <p className="mt-2 text-muted">
          Pool closed or bad weather? Cancel every lesson at a location on one day. Each child gets
          a make-up credit, make-ups booked into those lessons are refunded, and families are told
          in the app.
        </p>
      </div>
      {locations.length ? (
        <CancelLessonsForm locations={locations} today={today} />
      ) : (
        <p className="rounded-lg border border-line bg-surface p-5 text-muted">
          Add a location first.
        </p>
      )}
    </div>
  );
}
