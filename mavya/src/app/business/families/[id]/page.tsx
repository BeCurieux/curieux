import { Download, Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteParentForm, RevokeInviteButton } from "@/components/business/invite-parent";
import { BackLink } from "@/components/demo/back-link";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import { classSlug } from "@/lib/demo/service";
import { getFamily } from "@/lib/domain/families";
import { familyAccess } from "@/lib/domain/invites";
import { safetyFlags } from "@/lib/domain/safety";
import { SafetyFlags } from "@/components/safety/safety-notes";
import { ageOn, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwner();
  const family = await getFamily(db, id);
  if (!family) notFound();
  const [{ parents, pending }, flags] = await Promise.all([
    familyAccess(db, id),
    safetyFlags(
      db,
      family.children.map((c) => c.id),
    ),
  ]);

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/families">Families</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{family.displayName}</h1>
        <Button asChild variant="soft">
          <Link href={`/business/families/${id}/edit`}>
            <Pencil aria-hidden />
            Edit family
          </Link>
        </Button>
      </div>

      <section
        aria-labelledby="contact"
        className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="contact" className="font-semibold text-muted">
          Main contact
        </h2>
        {family.contactName || family.contactEmail || family.contactPhone ? (
          <ul className="flex flex-col gap-1.5">
            {family.contactName ? (
              <li className="inline-flex items-center gap-2 font-semibold">
                <UserRound aria-hidden className="size-4 text-muted" />
                {family.contactName}
              </li>
            ) : null}
            {family.contactEmail ? (
              <li className="inline-flex items-center gap-2 break-all">
                <Mail aria-hidden className="size-4 shrink-0 text-muted" />
                {family.contactEmail}
              </li>
            ) : null}
            {family.contactPhone ? (
              <li className="inline-flex items-center gap-2">
                <Phone aria-hidden className="size-4 text-muted" />
                {family.contactPhone}
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-muted">No contact details yet.</p>
        )}
      </section>

      <section
        aria-labelledby="parents"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 id="parents" className="font-display text-2xl font-semibold tracking-tight">
            Parents on Ovyko
          </h2>
          <p className="text-muted">
            Parents who join see their children&apos;s classes, report absences and book make-ups
            themselves.
          </p>
        </div>
        {parents.length ? (
          <ul className="flex flex-col gap-2">
            {parents.map((p) => (
              <li key={p.userId} className="rounded-md bg-surface-soft px-4 py-3">
                <span className="font-semibold">{p.name || p.email}</span>{" "}
                <span className="text-muted">· {p.email} · joined</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-semibold">Nobody from this family has joined yet.</p>
        )}
        {pending.length ? (
          <ul aria-label="Invites waiting" className="flex flex-col gap-2">
            {pending.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line px-4 py-3"
              >
                <span>
                  <span className="font-semibold">{i.email}</span>{" "}
                  <span className="text-muted">
                    · invited {formatDateTime(i.createdAt)}, not joined yet
                  </span>
                </span>
                <RevokeInviteButton inviteId={i.id} familyId={id} />
              </li>
            ))}
          </ul>
        ) : null}
        <InviteParentForm
          familyId={id}
          defaultEmail={
            family.contactEmail &&
            !parents.some((p) => p.email.toLowerCase() === family.contactEmail!.toLowerCase())
              ? family.contactEmail
              : null
          }
        />
      </section>

      <section aria-labelledby="children" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="children" className="font-display text-2xl font-semibold tracking-tight">
            Children
          </h2>
          <Button asChild>
            <Link href={`/business/families/${id}/children/new`}>
              <Plus aria-hidden />
              Add child
            </Link>
          </Button>
        </div>
        {family.children.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface p-5 text-muted">
            No children added yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {family.children.map((child) => (
              <li
                key={child.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold">
                      {child.firstName} {child.lastName}
                    </p>
                    <p className="text-sm text-muted">Age {ageOn(child.dateOfBirth)}</p>
                    <SafetyFlags flag={flags.get(child.id)} className="mt-1" />
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/business/families/${id}/children/${child.id}`}
                      aria-label={`Edit ${child.firstName}`}
                    >
                      Edit
                    </Link>
                  </Button>
                </div>
                {child.enrolments.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {child.enrolments.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/business/classes/${classSlug(e.classId)}`}
                          className="inline-flex h-9 items-center rounded-full bg-surface-soft px-3 text-sm font-semibold hover:bg-lilac/40"
                        >
                          {e.className} · {e.when}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">
                    Not enrolled. Enrol from a class&apos;s page.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="privacy"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 id="privacy" className="font-display text-2xl font-semibold tracking-tight">
            Their data
          </h2>
          <p className="text-muted">
            When a family asks for a copy of what you hold about them, or for it to be deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={`/business/families/${id}/export`} method="post">
            <Button type="submit" variant="soft">
              <Download aria-hidden />
              Download their data
            </Button>
          </form>
          <Button asChild variant="ghost">
            <Link href={`/business/families/${id}/delete`}>
              <Trash2 aria-hidden />
              Delete this family
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
