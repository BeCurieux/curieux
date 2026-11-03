import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { REFUND_DAYS } from "@/lib/commerce/plan";
import { fillTokens, loadPage } from "@/lib/pages/content";

const PAGES = ["terms", "privacy", "refunds"] as const;

export function generateStaticParams() {
  return PAGES.map((page) => ({ page }));
}
export const dynamicParams = false;

type Params = Promise<{ page: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { page } = await params;
  if (!PAGES.includes(page as (typeof PAGES)[number])) return {};
  const copy = await loadPage(`legal/${page}`);
  return { title: copy.title, description: copy.description };
}

// Plain-English legal pages from content/pages/legal (SPEC.md → Pages).
export default async function LegalPage({ params }: { params: Params }) {
  const { page } = await params;
  if (!PAGES.includes(page as (typeof PAGES)[number])) notFound();
  const copy = await loadPage(`legal/${page}`);
  return (
    <>
      <DraftNotice draft={copy.draft} />
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 className="text-4xl">{copy.title}</h1>
        <div className="mt-6 text-lg">
          <Markdown>{fillTokens(copy.body, { refund_days: String(REFUND_DAYS) })}</Markdown>
        </div>
      </main>
    </>
  );
}
