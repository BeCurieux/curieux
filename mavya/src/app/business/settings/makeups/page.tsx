import type { Metadata } from "next";
import { MakeupPolicyForm } from "@/components/business/makeup-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getPolicy } from "@/lib/domain/makeups";

export const metadata: Metadata = { title: "Make-up rules" };

export default async function MakeupRulesPage() {
  const { db, organisationId } = await requireOwner();
  const policy = await getPolicy(db, organisationId);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Make-up rules</h1>
        <p className="mt-2 text-muted">
          Families see these in plain words when they tell you they can&apos;t make it. Changes
          apply to the next absence; credits already issued keep their expiry.
        </p>
      </div>
      <MakeupPolicyForm policy={policy} />
    </div>
  );
}
