// One family, for as long as they said.
//
// The page is deliberately dull: counts, statuses and book titles. The
// policies added in 0026 would permit rendering the photographs, and that is
// not a reason to. The grant was given to answer "why is her book stuck",
// and a capability nobody builds is a capability nobody misuses.
//
// Three properties, each of which a later change could quietly remove:
//
//   Every read is the staff member's own client, so the database decides.
//   The visit is written into the family's log before anything is shown.
//   There is no control on this page that changes anything.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { grantFor, hoursLeft, noteSupportLook, shapeOf } from "@/lib/family/support-view";
import { countOf, fullDate } from "@/lib/words";
import { SUPPORT_ACCESS_HOURS } from "@/lib/family/support";
import { SUPPORT_ACTOR } from "@/lib/privacy/activity";

export const dynamic = "force-dynamic";

export default async function SupportFamilyPage({
  params,
}: {
  params: { familyId: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const db = userClient();
  const grant = await grantFor(db, params.familyId);

  // No grant, an expired one, or one that has been pulled back. All three
  // are the same answer, and it is not an error page — a family withdrawing
  // permission is the mechanism working.
  if (!grant) {
    return (
      <div className="mx-auto !max-w-lg py-20">
        <h1 className="font-display text-2xl">Nothing is open for this family.</h1>
        <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">
          Either they never granted access, it has run out, or they have taken
          it back. Any of those is theirs to decide, and asking again means
          asking them &mdash; a grant lasts {SUPPORT_ACCESS_HOURS} hours and
          nothing here renews it.
        </p>
        <p className="mt-8 text-sm">
          <Link href="/admin/support" className="text-ochre">Back to the queue</Link>
        </p>
      </div>
    );
  }

  // Written before anything is rendered. A family's record of who looked
  // must not depend on the page finishing, and it goes through the admin
  // client so that the person looking cannot be the one who decides whether
  // it is recorded.
  await noteSupportLook(admin, {
    familyId: grant.familyId,
    staffId: user.id,
    // Not the staff member's username. The family's log says support
    // looked; who exactly is an internal question, and actor_id answers it.
    staffLabel: SUPPORT_ACTOR,
    reason: grant.reason,
  });

  // No special case for an empty archive. An earlier draft raised a 404,
  // which is exactly backwards: "she says she uploaded two hundred photos
  // and there are none" is the most useful thing this page can say, and a
  // 404 reads as a wrong URL and hides it. Zeros are a finding.
  const shape = await shapeOf(db, grant.familyId);

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">
        {countOf(hoursLeft(grant.expiresAt), "hour")} left
      </p>
      <h1 className="mt-3 text-title">{grant.familyName ?? "A family"}</h1>

      {/* What they asked for, and the fact that they will see this visit.
          Both belong at the top: one is the scope of what a staff member
          should be doing here, and the other is why they should stay
          inside it. */}
      <div className="mt-6 rounded-2xl bg-card p-5">
        <p className="reading max-w-[52ch] leading-relaxed">{grant.reason}</p>
        <p className="mt-3 max-w-[52ch] text-xs leading-relaxed text-stone">
          Granted {fullDate(grant.createdAt)}, expires on its own. This visit
          is in their activity log. Nothing on this page can change anything,
          and private memories are not shown &mdash; the database refuses both,
          not just this page.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-lg">What&rsquo;s in it</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Memories", shape.memories],
            ["Photographs", shape.photos],
            ["Being checked", shape.awaitingCheck],
          ].map(([label, n]) => (
            <div key={String(label)} className="card">
              <div className="font-display text-3xl">{n as number}</div>
              <div className="text-xs uppercase tracking-wider text-stone">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-[52ch] text-xs leading-relaxed text-stone">
          Counts only. The memories themselves are not on this page, and a
          private one would not be reachable from it in any case.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg">Who it&rsquo;s about</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {shape.subjects.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span className="text-clay">&mdash;</span>
              <span>
                {s.name}
                {s.bornOn && <span className="text-stone"> · born {fullDate(s.bornOn)}</span>}
              </span>
            </li>
          ))}
          {shape.subjects.length === 0 && <li className="text-stone">Nobody yet.</li>}
        </ul>
      </section>

      {/* The reason the grant usually exists. */}
      <section className="mt-10">
        <h2 className="text-lg">Books</h2>
        <div className="mt-3 space-y-2">
          {shape.books.map((b) => (
            <div key={b.id} className="card !p-4 text-sm">
              <span className="font-mono text-xs text-stone">{b.id.slice(0, 8)}</span>
              <span className="ml-2">{b.title ?? "Untitled"}</span>
              {b.year !== null && <span className="ml-2 text-stone">year {b.year}</span>}
              <span className="ml-2 rounded bg-rule px-2 py-0.5 text-xs">{b.status}</span>
              <span className="ml-2 text-xs text-stone">{countOf(b.pages, "page")}</span>
            </div>
          ))}
          {shape.books.length === 0 && <p className="text-sm text-stone">None yet.</p>}
        </div>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/admin/support" className="text-ochre">Back to the queue</Link>
      </p>
    </div>
  );
}
