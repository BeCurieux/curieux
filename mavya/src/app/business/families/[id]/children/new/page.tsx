import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChildForm } from "@/components/business/family-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getFamily } from "@/lib/domain/families";

export const metadata: Metadata = { title: "Add child" };

export default async function NewChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwner();
  const family = await getFamily(db, id);
  if (!family) notFound();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href={`/business/families/${id}`}>{family.displayName}</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Add a child</h1>
      <ChildForm familyId={id} />
    </div>
  );
}
