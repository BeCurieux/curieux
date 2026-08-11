// Families who have asked us to look.
//
// Empty almost always, and that is the healthy state. A support queue with
// three families on it means three families are having a bad week; a support
// queue that is never empty means the grant has become routine, which is the
// failure mode this whole mechanism exists to avoid.
//
// The list itself is read as the staff member, not as the service — see
// lib/family/support-view.ts for why that distinction is the entire point.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { openGrants, hoursLeft } from "@/lib/family/support-view";
import { countOf, fullDate } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function SupportQueuePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Belt as well as braces. The database refuses a non-staff reader anyway;
  // this keeps a curious signed-in person off the page rather than showing
  // them an empty one and letting them wonder.
  const { data: profile } = await adminClient()
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const grants = await openGrants(await userClient());

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">Support</p>
      <h1 className="mt-3 text-title">Who has asked us to look</h1>
      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-stone">
        Only families with an open grant appear here, and only while it lasts.
        Opening one is written into that family&rsquo;s activity log, where
        they will read it.
      </p>

      {grants.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-card p-6 leading-relaxed">
          Nobody. This is the normal state &mdash; a queue that is never empty
          would mean the grant had become routine.
        </p>
      ) : (
        <ul className="mt-10 space-y-4">
          {grants.map((g) => (
            <li key={g.id}>
              <Link
                href={`/admin/support/${g.familyId}`}
                className="card block transition hover:border-clay"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="font-display text-lg">
                    {g.familyName ?? "A family"}
                  </span>
                  <span className="text-xs text-stone">
                    {countOf(hoursLeft(g.expiresAt), "hour")} left
                  </span>
                </div>
                {/* The family's own words. This is the only thing on the page
                    that tells a staff member what they are being asked for,
                    and it is worth more than any metadata beside it. */}
                <p className="reading mt-2 max-w-[52ch] leading-relaxed">{g.reason}</p>
                <p className="mt-2 text-xs text-stone">
                  Granted {fullDate(g.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-12 text-sm">
        <Link href="/admin" className="text-ochre">Back to admin</Link>
      </p>
    </div>
  );
}
