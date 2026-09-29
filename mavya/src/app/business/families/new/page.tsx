import type { Metadata } from "next";
import { FamilyForm } from "@/components/business/family-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";

export const metadata: Metadata = { title: "Add family" };

export default async function NewFamilyPage() {
  await requireOwner();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/families">Families</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Add a family</h1>
      <FamilyForm />
    </div>
  );
}
