import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationForm } from "@/components/business/location-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listLocations } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Edit location" };

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwner();
  const location = (await listLocations(db)).find((l) => l.id === id);
  if (!location) notFound();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings/locations">Locations</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">{location.name}</h1>
      <LocationForm location={location} />
    </div>
  );
}
