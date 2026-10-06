import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { FollowUpForm } from "@/components/business/follow-up-form";
import { requireOwner } from "@/lib/business/owner";
import { familiesAtRisk, reasonText } from "@/lib/domain/retention";

export const metadata: Metadata = { title: "Families who might leave" };

// Families showing warning signs, counted from the school's own records
// (docs/M8_NETWORK.md, M8e), so the owner can call before they quietly go.
export default async function RetentionPage() {
  const { db, organisationId } = await requireOwner();
  const families = await familiesAtRisk(db, organisationId);
  return (
    <div className="rise flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Families who might leave
        </h1>
        <p className="mt-1 text-muted">
          Counted from what happened in Ovyko: missed lessons, make-up credits left to run out,
          answers about next term, overdue fees and paused places. A quick call often keeps a
          family. Only you see this list.
        </p>
      </div>

      {families.length === 0 ? (
        <p className="rounded-lg bg-[#dcf1e7] p-5 font-semibold text-[#1d5a41]">
          No warning signs right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {families.map((f) => (
            <li key={f.familyId}>
              <section
                aria-label={f.familyName}
                className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-xl font-semibold">{f.familyName}</h2>
                  <ul className="flex list-inside list-disc flex-col gap-1">
                    {f.reasons.map((r, i) => (
                      <li key={i}>{reasonText(r)}</li>
                    ))}
                  </ul>
                </div>
                {f.phone || f.email ? (
                  <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {f.contactName ? <span className="font-semibold">{f.contactName}</span> : null}
                    {f.phone ? (
                      <a
                        href={`tel:${f.phone}`}
                        className="inline-flex items-center gap-1 underline"
                      >
                        <Phone aria-hidden className="size-4" />
                        {f.phone}
                      </a>
                    ) : null}
                    {f.email ? (
                      <a
                        href={`mailto:${f.email}`}
                        className="inline-flex items-center gap-1 underline"
                      >
                        <Mail aria-hidden className="size-4" />
                        {f.email}
                      </a>
                    ) : null}
                  </p>
                ) : null}
                <FollowUpForm familyId={f.familyId} familyName={f.familyName} />
              </section>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
