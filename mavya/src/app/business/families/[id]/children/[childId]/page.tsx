import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AddRestrictionForm,
  OwnerHealthForm,
  RemoveRestrictionButton,
} from "@/components/business/child-safety";
import { ChildForm } from "@/components/business/family-forms";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { getFamily } from "@/lib/domain/families";
import { childSafety, RESTRICTION_LABELS, safetyViews } from "@/lib/domain/safety";
import { formatDateTime } from "@/lib/format";

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
  // Opening the details is recorded, so the list below includes this look.
  const safety = await childSafety(db, childId);
  const views = await safetyViews(db, childId);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <BackLink href={`/business/families/${id}`}>{family.displayName}</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        {child.firstName} {child.lastName}
      </h1>
      <ChildForm familyId={id} child={child} />

      <section
        aria-labelledby="health"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 id="health" className="font-display text-2xl font-semibold tracking-tight">
            Health notes
          </h2>
          <p className="text-muted">
            Seen by {child.firstName}&apos;s parents, you, and the instructors who teach{" "}
            {child.firstName}. Parents can change them too.
          </p>
        </div>
        <OwnerHealthForm
          familyId={id}
          childId={childId}
          allergies={safety.health?.allergies ?? null}
          medicalNotes={safety.health?.medicalNotes ?? null}
        />
      </section>

      <section
        aria-labelledby="restrictions"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 id="restrictions" className="font-display text-2xl font-semibold tracking-tight">
            Pickup and contact
          </h2>
          <p className="text-muted">
            Someone who may not collect or contact {child.firstName}. Instructors see a warning with
            the name; parents don&apos;t see this.
          </p>
        </div>
        {safety.restrictions.length ? (
          <ul aria-label="Restrictions" className="flex flex-col gap-2">
            {safety.restrictions.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border-2 border-[#9c3b29] bg-[#fff0ec] px-4 py-3 text-[#7a2c1f]"
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {RESTRICTION_LABELS[r.kind]}: {r.personName}
                    </p>
                    {r.details ? <p className="text-sm whitespace-pre-line">{r.details}</p> : null}
                    <p className="text-sm">Added {formatDateTime(r.addedAt)}</p>
                  </div>
                </div>
                <RemoveRestrictionButton restrictionId={r.id} familyId={id} name={r.personName} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-semibold">None.</p>
        )}
        <AddRestrictionForm familyId={id} childId={childId} />
      </section>

      <section aria-labelledby="looked" className="flex flex-col gap-3">
        <div>
          <h2 id="looked" className="font-display text-2xl font-semibold tracking-tight">
            Who looked
          </h2>
          <p className="text-muted">
            Each time staff open {child.firstName}&apos;s health notes or restrictions.
          </p>
        </div>
        <ul aria-label="Looks" className="flex flex-col gap-1.5">
          {views.map((v, i) => (
            <li key={i} className="rounded-md bg-surface-soft px-4 py-2">
              <span className="font-semibold">{v.name}</span>{" "}
              <span className="text-muted">
                · {v.role === "owner" ? "owner" : "instructor"} · {formatDateTime(v.viewedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
