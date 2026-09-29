import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import { RemoveAccess, RestoreAccess } from "@/components/business/staff-access";
import { requireOwner } from "@/lib/business/owner";
import { listStaff } from "@/lib/domain/staff";

export const metadata: Metadata = { title: "Staff" };

const ROLE = { owner: "Owner", instructor: "Instructor" } as const;

export default async function StaffPage() {
  const { db, organisationId, viewer } = await requireOwner();
  const staff = await listStaff(db, organisationId);
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Staff</h1>
        <p className="max-w-prose text-muted">
          When someone leaves, remove their access. It stops at once, even on a phone or tablet
          they&rsquo;re still signed in on.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {staff.map((s) => {
          const first = s.name.split(" ")[0] ?? s.name;
          const isYou = s.userId === viewer.userId;
          return (
            <li
              key={s.membershipId}
              aria-label={s.name}
              className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">
                    {s.name}
                    {isYou ? <span className="font-sans text-base text-muted"> (you)</span> : null}
                  </p>
                  <p className="text-muted">{s.email}</p>
                </div>
                <span
                  className={
                    s.active
                      ? "rounded-full bg-surface-soft px-3 py-1 text-sm font-semibold"
                      : "rounded-full bg-[#fff0ec] px-3 py-1 text-sm font-semibold text-[#9c3b29]"
                  }
                >
                  {s.active ? ROLE[s.role] : "No access"}
                </span>
              </div>
              {s.active && s.role === "instructor" ? (
                <p className="text-sm text-muted">
                  {s.classCount === 0
                    ? "No classes"
                    : `Teaches ${s.classCount} ${s.classCount === 1 ? "class" : "classes"}`}
                </p>
              ) : null}
              {isYou ? null : s.active ? (
                <RemoveAccess
                  membershipId={s.membershipId}
                  name={first}
                  classCount={s.classCount}
                />
              ) : (
                <RestoreAccess membershipId={s.membershipId} name={first} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
