// Your archive, and what you can do with it.
//
// Everything on this page exists to make privacy checkable rather than
// claimed: who has looked, take a copy, grant support access on purpose,
// and delete the lot. The delete button is deliberately not hidden at the
// bottom behind a warning triangle — a company confident in its deletion
// does not make it hard to find.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import {
  deleteEverything, grantSupportAccess, requestExport, revokeSupportAccess,
} from "@/app/actions";
import { membersOfFamily, memberLabel, roleInFamily } from "@/lib/family/membership";
import { canEdit, canManageAccess } from "@/lib/family/roles";
import { ACTIVITY_PHRASE, type ActivityKind } from "@/lib/privacy/activity";
import { DELETION_TERMS } from "@/lib/privacy/erase";
import { friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

const mb = (bytes: number | null) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : "";

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: { export?: string; deleted?: string; error?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: membership } = await db
    .from("family_memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/home");
  const familyId = membership.family_id;

  const role = await roleInFamily(db, familyId, user.id);
  const members = await membersOfFamily(db, familyId);
  const nameOf = (id: string | null) => {
    const m = members.find((x) => x.userId === id);
    return m ? memberLabel(m) : "Someone";
  };

  const { data: subjects } = await db
    .from("subjects").select("display_name").eq("family_id", familyId).limit(1);
  const childName = subjects?.[0]?.display_name ?? "";

  const [{ data: activity }, { data: exports_ }, { data: grants }] = await Promise.all([
    db.from("activity_log").select("*").eq("family_id", familyId)
      .order("created_at", { ascending: false }).limit(30),
    db.from("archive_exports").select("*").eq("family_id", familyId)
      .order("created_at", { ascending: false }).limit(3),
    db.from("support_grants").select("*").eq("family_id", familyId)
      .is("revoked_at", null).order("created_at", { ascending: false }),
  ]);

  const activeGrant = (grants ?? []).find((g) => new Date(g.expires_at) > new Date());

  if (searchParams.deleted) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <h1 className="text-3xl">It&rsquo;s being deleted.</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">{DELETION_TERMS}</p>
        <p className="mt-6 text-sm text-stone">
          You&rsquo;ll get one final email confirming it&rsquo;s done. Thank you
          for having trusted us with it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-title">Your archive</h1>
      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-stone">
        What you keep here belongs to your family. This page is how you check
        that &mdash; who has looked, what we hold, and how to take it back or
        destroy it.{" "}
        <Link href="/privacy" className="text-ochre">How we keep your family private</Link>
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      {/* ------------------------------------------------------- activity */}
      <section className="mt-12">
        <h2 className="text-xl">What&rsquo;s happened</h2>
        <p className="mt-1 max-w-[48ch] text-sm leading-relaxed text-stone">
          Everyone in the family can see this. It records who did something,
          never what was in it.
        </p>
        {activity && activity.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 border-b border-rule py-2">
                <span>
                  {a.actor_id === user.id ? "You" : a.actor_label}{" "}
                  <span className="text-stone">
                    {ACTIVITY_PHRASE[a.kind as ActivityKind] ?? a.kind}
                  </span>
                  {a.detail && <span className="text-stone"> &mdash; {a.detail}</span>}
                </span>
                <span className="ml-auto text-xs text-stone">{friendlyDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone">Nothing yet.</p>
        )}
      </section>

      {/* --------------------------------------------------------- export */}
      {canEdit(role) && (
        <section className="mt-12 border-t border-rule pt-10">
          <h2 className="text-xl">Take a copy</h2>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-stone">
            Every photograph and recording at its original quality, every note
            and quote as you wrote it, and all the books &mdash; in one file,
            in folders you can browse on any computer without us.
          </p>

          {searchParams.export === "preparing" && (
            <p className="mt-4 rounded-lg bg-card p-3 text-sm text-stone">
              We&rsquo;re putting it together. It can take a few minutes for a
              big archive &mdash; come back to this page.
            </p>
          )}

          {(exports_ ?? []).map((e) => (
            <div key={e.id} className="card mt-4 flex flex-wrap items-center justify-between gap-3 !p-4 text-sm">
              <div>
                <div>{friendlyDate(e.created_at)}</div>
                <div className="text-xs text-stone">
                  {e.status === "ready"
                    ? `${e.item_count ?? 0} files · ${mb(e.size_bytes)} · link expires ${friendlyDate(e.expires_at)}`
                    : e.status === "failed"
                      ? "Something went wrong — try again"
                      : "Preparing…"}
                </div>
              </div>
              {e.status === "ready" && (
                <Link href={`/api/export/${e.id}`} className="btn-secondary !px-5 !py-2 text-xs">
                  Download
                </Link>
              )}
            </div>
          ))}

          <form action={requestExport} className="mt-4">
            <input type="hidden" name="family_id" value={familyId} />
            <button className="btn-secondary">Prepare a copy of everything</button>
          </form>
        </section>
      )}

      {/* -------------------------------------------------- support access */}
      {canManageAccess(role) && (
        <section className="mt-12 border-t border-rule pt-10">
          <h2 className="text-xl">Support access</h2>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-stone">
            Nobody here looks at your archive as a matter of course. If you ask
            us for help with something we can&rsquo;t solve blind, you can let
            us in for two days. It expires on its own and appears above.
          </p>

          {activeGrant ? (
            <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 border-boot !p-4 text-sm">
              <div>
                <div>Access granted until {friendlyDate(activeGrant.expires_at)}</div>
                <div className="text-xs text-stone">{activeGrant.reason}</div>
              </div>
              <form action={revokeSupportAccess}>
                <input type="hidden" name="grant_id" value={activeGrant.id} />
                <button className="text-xs text-stone hover:text-ink">Revoke now</button>
              </form>
            </div>
          ) : (
            <form action={grantSupportAccess} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="family_id" value={familyId} />
              <input className="input flex-1" name="reason" placeholder="What do you need help with?" />
              <button className="btn-secondary !px-5">Allow for 48 hours</button>
            </form>
          )}
        </section>
      )}

      {/* --------------------------------------------------------- delete */}
      {canManageAccess(role) && (
        <section className="mt-12 border-t border-rule pt-10">
          <h2 className="text-xl">Delete everything</h2>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-stone">
            {DELETION_TERMS}
          </p>
          <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-stone">
            If you might want any of it later, take a copy first &mdash; once
            this is done we cannot get it back for you.
          </p>

          <form action={deleteEverything} className="card mt-4 space-y-3">
            <input type="hidden" name="family_id" value={familyId} />
            <label className="label" htmlFor="confirmation">
              Type {childName ? <strong>{childName}</strong> : "the child's name"} to confirm
            </label>
            <input className="input" id="confirmation" name="confirmation" required autoComplete="off" />
            <button className="btn-secondary w-full !border-red-300 !text-red-700 hover:!border-red-500">
              Permanently delete our archive
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
