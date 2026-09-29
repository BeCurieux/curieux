import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChildForm } from "@/components/business/family-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getFamily } from "@/lib/domain/families";

export const metadata: Metadata = { title: "Edit child" };

export default async function EditChildPage({
  params,
}: {
  params: Promise<{ id: string; childId: string }>;
}) {
  const { id, childId } = await params;
  const { db } = await requireOwner();
  const family = await getFamily(db, id);
  const child = family?.children.find((c) => c.id === childId);
  if (!family || !child) notFound();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href={`/business/families/${id}`}>{family.displayName}</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        {child.firstName} {child.lastName}
      </h1>
      <ChildForm familyId={id} child={child} />
    </div>
  );
}
