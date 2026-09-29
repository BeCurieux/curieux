import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FamilySearch } from "@/components/business/family-search";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import { listFamilies } from "@/lib/domain/families";

export const metadata: Metadata = { title: "Families" };

export default async function FamiliesPage() {
  const { db, organisationId } = await requireOwner();
  const families = await listFamilies(db, organisationId);
  return (
    <div className="rise flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Families</h1>
        <Button asChild>
          <Link href="/business/families/new">
            <Plus aria-hidden />
            Add family
          </Link>
        </Button>
      </div>
      {families.length === 0 ? (
        <EmptyState icon={<Users />} title="No families yet">
          Add a family, then their children, then enrol them in a class.
        </EmptyState>
      ) : (
        <FamilySearch
          families={families.map((f) => ({
            id: f.id,
            name: f.displayName,
            guardian: f.contactName ?? "",
            children: f.children.map((c) => ({
              name: c.firstName,
              level: c.enrolments.map((e) => e.className).join(", "),
            })),
          }))}
        />
      )}
    </div>
  );
}
