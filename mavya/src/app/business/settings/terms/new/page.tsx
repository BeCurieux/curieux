import type { Metadata } from "next";
import { TermForm } from "@/components/business/term-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";

export const metadata: Metadata = { title: "Add term" };

export default async function NewTermPage() {
  await requireOwner();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings/terms">Terms</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Add a term</h1>
      <TermForm />
    </div>
  );
}
