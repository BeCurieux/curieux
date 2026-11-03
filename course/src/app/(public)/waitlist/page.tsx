import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { LeadForm } from "@/components/site/lead-form";
import { loadPage } from "@/lib/pages/content";
import { joinWaitlist } from "../lead-actions";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadPage("waitlist");
  return { title: page.title, description: page.description };
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const [page, { utm_source }] = await Promise.all([loadPage("waitlist"), searchParams]);
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
            action={joinWaitlist}
            button="Join the waitlist"
            utmSource={utm_source?.slice(0, 60)}
            interests={[
              { value: "founding", label: "Founding cohort places" },
              { value: "future_modules", label: "New modules" },
            ]}
          />
        </div>
      </main>
    </>
  );
}
