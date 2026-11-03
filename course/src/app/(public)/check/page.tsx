import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { LeadForm } from "@/components/site/lead-form";
import { loadPage } from "@/lib/pages/content";
import { joinFree } from "../lead-actions";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadPage("check");
  return { title: page.title, description: page.description };
}

// The free Product Check (SPEC.md → Pages and routes): email first, then a
// sign-in link to lessons 0.1–0.2 and the two free calculators. No sign-in
// needed to load this page, so reels can link straight here.
export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const [page, { utm_source }] = await Promise.all([loadPage("check"), searchParams]);
  return (
    <>
      <DraftNotice draft={page.draft} />
      <main id="main" className="mx-auto w-full max-w-md px-5 py-10">
        <h1 className="text-4xl">{String(page.data.headline ?? page.title)}</h1>
        <div className="mt-4 text-lg">
          <Markdown>{page.body}</Markdown>
        </div>
        <div className="mt-8">
          <LeadForm
            action={joinFree.bind(null, "product_check")}
            button="Send me the free check"
            utmSource={utm_source?.slice(0, 60)}
            sentText="We've sent you a link to the free lessons and calculators."
          />
        </div>
        <p className="text-mute mt-6">
          Already signed up? <Link href="/learn">Go to your course</Link>.
        </p>
      </main>
    </>
  );
}
