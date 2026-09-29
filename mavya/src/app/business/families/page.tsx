import { Users } from "lucide-react";
import type { Metadata } from "next";
import { FamilySearch } from "@/components/business/family-search";
import { EmptyState } from "@/components/demo/empty-state";
import { businessContext } from "@/lib/demo/context";
import { FAMILIES } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Families" };

export default async function FamiliesPage() {
  const { demo } = await businessContext();
  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Families</h1>
      {demo ? (
        <FamilySearch families={FAMILIES} />
      ) : (
        <EmptyState icon={<Users />} title="No families yet">
          Families appear here when their children enrol in your classes.
        </EmptyState>
      )}
    </div>
  );
}
