import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteFamilyForm } from "@/components/business/delete-family";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getFamily } from "@/lib/domain/families";

export const metadata: Metadata = { title: "Delete family" };

export default async function DeleteFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwner();
  const family = await getFamily(db, id);
  if (!family) notFound();
  const names = family.children.map((c) => c.firstName);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href={`/business/families/${id}`}>{family.displayName}</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Delete {family.displayName}?
      </h1>
      <div className="flex flex-col gap-3 rounded-lg border-2 border-[#9c3b29] bg-[#fff0ec] p-5 text-[#7a2c1f]">
        <p className="font-semibold">This can&apos;t be undone. It deletes, straight away:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>the family and its contact details</li>
          <li>
            {names.length
              ? `${names.join(", ")}, and their classes, attendance, progress, absences, make-ups, health notes and restrictions`
              : "any children, and everything about them"}
          </li>
          <li>
            parents&apos; Ovyko accounts, unless they&apos;re in another family or work at a school
          </li>
        </ul>
        <p>
          Do this when the family asks. Download their data first if they&apos;d like a copy. The
          audit trail will show that you deleted a family, and when, without their details.
        </p>
      </div>
      <DeleteFamilyForm familyId={id} name={family.displayName} />
    </div>
  );
}
