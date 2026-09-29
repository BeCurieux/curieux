import { MapPin, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import { listLocations } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const { db } = await requireOwner();
  const locations = await listLocations(db);
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Locations</h1>
        <Button asChild>
          <Link href="/business/settings/locations/new">
            <Plus aria-hidden />
            Add location
          </Link>
        </Button>
      </div>
      {locations.length === 0 ? (
        <EmptyState icon={<MapPin />} title="No locations yet">
          Add the pool, gym or studio where your classes happen.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {locations.map((l) => (
            <li key={l.id}>
              <Link
                href={`/business/settings/locations/${l.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#faf9fc]"
              >
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-sm text-muted">
                    {[l.addressLine1, l.suburb, l.state, l.postcode].filter(Boolean).join(", ") ||
                      "No address"}
                  </p>
                </div>
                <span className="text-sm text-muted">{l.timezone}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
