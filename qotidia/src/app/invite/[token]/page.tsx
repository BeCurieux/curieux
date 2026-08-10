// Accepting an invitation.
//
// The person arriving here is usually a grandparent who was sent a link. The
// page has one job and should not read like a permissions dialog: say whose
// archive this is, say plainly what they will be able to do, and let them in.

import { redirect } from "next/navigation";
import { currentUser, adminClient } from "@/lib/supabase/server";
import { acceptInvitation } from "@/app/actions";
import { ROLE_BLURB, ROLE_LABEL, type FamilyRole } from "@/lib/family/roles";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Read with the service role: the invitee is by definition not yet a member,
  // so RLS would hide the invitation from the very person it is addressed to.
  const admin = adminClient();
  const { data: invite } = await admin
    .from("family_invitations")
    .select("id, role, expires_at, accepted_at, family_id")
    .eq("token", params.token)
    .maybeSingle();

  const user = await currentUser();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="mx-auto !max-w-md py-20 text-center">
        <h1 className="text-3xl">This link has expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Invitations last thirty days and can only be used once. Ask whoever
          sent it to make you a new one.
        </p>
      </div>
    );
  }

  // Which child, so the page is about a person rather than an account.
  const { data: subjects } = await admin
    .from("subjects")
    .select("display_name")
    .eq("family_id", invite.family_id)
    .limit(3);

  const names = (subjects ?? []).map((s) => s.display_name).filter(Boolean);
  const who =
    names.length === 0 ? "a child" :
    names.length === 1 ? names[0] :
    `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  const role = invite.role as FamilyRole;

  return (
    <div className="mx-auto !max-w-md py-20">
      <p className="text-xs uppercase tracking-[0.2em] text-stone">{BRAND}</p>
      <h1 className="mt-3 text-title">You&rsquo;ve been asked to help keep {who}&rsquo;s year.</h1>
      <p className="mt-4 text-sm leading-relaxed text-stone">
        A private archive of one childhood, kept by the family and printed once
        a year as a book. Nothing in it is public, and nothing is ever used to
        train anything.
      </p>

      <div className="card mt-8">
        <div className="text-sm">{ROLE_LABEL[role]}</div>
        <p className="mt-1 text-sm leading-relaxed text-stone">{ROLE_BLURB[role]}</p>
      </div>

      {user ? (
        <form action={acceptInvitation} className="mt-8">
          <input type="hidden" name="token" value={params.token} />
          <button className="btn w-full">Join {who}&rsquo;s archive</button>
        </form>
      ) : (
        <div className="mt-8 space-y-3">
          <a href={`/signup?invite=${params.token}`} className="btn block w-full text-center">
            Create an account to join
          </a>
          <a href={`/login?invite=${params.token}`} className="btn-secondary block w-full text-center">
            I already have one
          </a>
          <p className="text-center text-xs text-stone">
            Free. You&rsquo;re not being asked to pay for anything.
          </p>
        </div>
      )}
    </div>
  );
}
