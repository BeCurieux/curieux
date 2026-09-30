import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Wordmark } from "@/components/shell/wordmark";
import { getViewer } from "@/lib/auth/viewer";
import { inviteDetails } from "@/lib/domain/invites";
import { createClient } from "@/lib/supabase/server";
import { JoinButton, NewAccountForm } from "./join-forms";

export const metadata: Metadata = { title: "Join your family" };

const CLOSED: Record<string, string> = {
  accepted: "This invite has already been used. Sign in to see your family.",
  revoked: "This invite was cancelled. Ask the school for a new one.",
  expired: "This invite has expired. Ask the school for a new one.",
};

// Where an invite link lands. Signed out: create an account (or sign in, for
// someone already on Ovyko). Signed in: join with the account you have.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [invite, viewer] = await Promise.all([
    inviteDetails(await createClient(), code),
    getViewer(),
  ]);

  let body: React.ReactNode;
  if (!invite) {
    body = <p className="text-lg">This link doesn&apos;t work. Ask the school for a new one.</p>;
  } else if (invite.status !== "pending") {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-lg">{CLOSED[invite.status]}</p>
        <Link href="/sign-in" className="font-semibold underline">
          Sign in
        </Link>
      </div>
    );
  } else if (viewer && viewer.email.toLowerCase() !== invite.email) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-lg">
          This invite is for <strong className="break-all">{invite.email}</strong>, but you&apos;re
          signed in as <strong className="break-all">{viewer.email}</strong>. Sign out, then open
          the link again.
        </p>
        <SignOutButton />
      </div>
    );
  } else if (viewer) {
    body = <JoinButton code={code} />;
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <NewAccountForm code={code} email={invite.email} />
        <p className="text-muted">
          Already on Ovyko with this email, at another school?{" "}
          <Link href={`/sign-in?next=/join/${code}`} className="font-semibold text-ink underline">
            Sign in to join
          </Link>
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-6 py-12">
      <div className="flex flex-col gap-4">
        <Wordmark />
        {invite && invite.status === "pending" ? (
          <>
            <p className="font-semibold text-muted">{invite.school} invited you</p>
            <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
              Join the {invite.family.replace(/ family$/i, "")} family on Ovyko
            </h1>
            <p className="text-lg text-muted">
              See your children&apos;s classes, tell {invite.school} when they can&apos;t make it,
              and book make-ups, all in one place.
            </p>
          </>
        ) : (
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
            Join your family
          </h1>
        )}
      </div>
      {body}
    </main>
  );
}
