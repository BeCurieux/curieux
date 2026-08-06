// Who can see this archive.
//
// A shared archive with a hidden guest list would be worse than no sharing
// at all, so everyone can see who else is here. Only the owner can change it.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { inviteToFamily, updateMembership } from "@/app/actions";
import { membersOfFamily, memberLabel, roleInFamily } from "@/lib/family/membership";
import {
  INVITABLE_ROLES, ROLE_BLURB, ROLE_LABEL, canManageAccess,
} from "@/lib/family/roles";
import { friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function FamilyAccessPage({
  params,
  searchParams,
}: {
  params: { familyId: string };
  searchParams: { invited?: string; error?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const role = await roleInFamily(db, params.familyId, user.id);
  if (!role) redirect("/home");

  const members = await membersOfFamily(db, params.familyId);
  const canManage = canManageAccess(role);

  const { data: invitations } = await db
    .from("family_invitations")
    .select("id, email, role, expires_at, accepted_at")
    .eq("family_id", params.familyId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Link href="/home" className="text-sm text-ochre">&larr; Home</Link>
      <h1 className="mt-2 text-3xl">Who can see this</h1>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-stone">
        An archive of a childhood is better when the people who were there
        help build it. Grandparents remember things you don&rsquo;t, and have
        photographs you&rsquo;ve never seen.
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      {searchParams.invited && (
        <div className="card mt-6 border-clay">
          <p className="text-sm">
            Invitation ready. Send them this link &mdash; it works once, and
            only for them.
          </p>
          <p className="mt-2 break-all rounded bg-paper/70 p-3 font-mono text-xs">
            {appUrl}/invite/{searchParams.invited}
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl">Here now</h2>
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
              <div>
                <div className="text-sm">
                  {memberLabel(m)}
                  {m.userId === user.id && <span className="text-stone"> — you</span>}
                </div>
                <div className="text-xs text-stone">{ROLE_LABEL[m.role]}</div>
              </div>
              {canManage && m.role !== "owner" && (
                <form action={updateMembership} className="flex items-center gap-2">
                  <input type="hidden" name="membership_id" value={m.id} />
                  <input type="hidden" name="family_id" value={params.familyId} />
                  <button
                    name="action"
                    value={m.role === "editor" ? "contributor" : "editor"}
                    className="text-xs text-ochre hover:underline"
                  >
                    {m.role === "editor" ? "Ask me first" : "Let them add directly"}
                  </button>
                  <button name="action" value="remove" className="text-xs text-stone hover:text-ink">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {invitations && invitations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">Invited, not yet joined</h2>
          <ul className="mt-4 space-y-2">
            {invitations.map((i) => (
              <li key={i.id} className="card !p-4 text-sm">
                {i.email}
                <span className="ml-2 text-xs text-stone">
                  {ROLE_LABEL[i.role as keyof typeof ROLE_LABEL]} · expires{" "}
                  {friendlyDate(i.expires_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <section className="mt-10 border-t border-rule pt-10">
          <h2 className="text-xl">Invite someone</h2>
          <form action={inviteToFamily} className="card mt-4 space-y-4">
            <input type="hidden" name="family_id" value={params.familyId} />
            <div>
              <label className="label" htmlFor="display_name">
                What does the child call them?
              </label>
              <input className="input" id="display_name" name="display_name" placeholder="Grandpa" />
            </div>
            <div>
              <label className="label" htmlFor="email">Their email</label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <fieldset>
              <legend className="label">What they can do</legend>
              <div className="space-y-2">
                {INVITABLE_ROLES.map((r, i) => (
                  <label key={r} className="flex gap-3 rounded border border-rule bg-white p-3 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      defaultChecked={i === INVITABLE_ROLES.length - 1}
                      className="mt-1"
                    />
                    <span>
                      <span className="block">{ROLE_LABEL[r]}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-stone">
                        {ROLE_BLURB[r]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="btn w-full">Create the invitation</button>
          </form>
        </section>
      )}
    </div>
  );
}
