import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { loadPage } from "@/lib/pages/content";
import { HypeForm } from "./hype-form";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadPage("hype");
  return { title: page.title, description: page.description };
}

// Hype Check (SPEC.md → Pages and routes): paste a post, get a score and
// what it leaves out; copy to share; optional email. No sign-in.
export default async function HypePage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const [page, { utm_source }] = await Promise.all([loadPage("hype"), searchParams]);
  return (
    <>
      <DraftNotice draft={page.draft} />
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 className="text-4xl">{String(page.data.headline ?? page.title)}</h1>
        <div className="mt-4 text-lg">
          <Markdown>{page.body}</Markdown>
        </div>
        <div className="mt-8">
          <HypeForm utmSource={utm_source?.slice(0, 60)} />
        </div>
      </main>
    </>
  );
}
