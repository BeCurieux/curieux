import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/shell/wordmark";
import { SchoolWaitlistForm } from "@/components/site/school-waitlist-form";
import { waitlistPage } from "@/lib/domain/waitlist-page";
import { createClient } from "@/lib/supabase/server";

// One school's waiting-list page for new families (docs/M8_NETWORK.md,
// M8d), linked from the school's own website. Not listed or indexed
// anywhere: there's no directory of schools (CLAUDE.md rule 13).
export const metadata: Metadata = {
  title: "Join the waiting list",
  robots: { index: false, follow: false },
};

export default async function SchoolWaitlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = /^[a-z0-9-]{1,80}$/.test(slug)
    ? await waitlistPage(await createClient(), slug)
    : null;
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
        {page ? (
          <>
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-[#b54a33]">{page.school}</p>
              <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                Join the waiting list
              </h1>
              <p className="text-lg text-muted">
                Tell {page.school} about your child and the times that suit. They&apos;ll be in
                touch when a place comes up.
              </p>
            </div>
            <SchoolWaitlistForm slug={slug} page={page} />
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              This waiting list isn&apos;t open
            </h1>
            <p className="text-lg text-muted">
              Check the link with the school, or contact them directly.
            </p>
          </div>
        )}
        <p className="flex items-center gap-2 text-sm text-muted">
          Runs on
          <Link href="/" aria-label="Ovyko">
            <Wordmark />
          </Link>
          · Your details go only to this school.
        </p>
      </main>
    </div>
  );
}
