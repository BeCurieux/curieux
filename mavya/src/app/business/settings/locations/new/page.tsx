import type { Metadata } from "next";
import { LocationForm } from "@/components/business/location-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";

export const metadata: Metadata = { title: "Add location" };

export default async function NewLocationPage() {
  await requireOwner();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings/locations">Locations</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Add a location</h1>
      <LocationForm />
    </div>
  );
}
