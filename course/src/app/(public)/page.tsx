import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { DraftNotice } from "@/components/site/header";
import { fillTokens, loadPage } from "@/lib/pages/content";
import { catalogue, priceTokens, visitorCurrency } from "@/lib/pages/prices";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadPage("home");
  return { title: { absolute: `Her Little Empire: ${page.title}` }, description: page.description };
}

// The sales page (SPEC.md → Pages and routes). Words from
// content/pages/home.md; prices from the database in her currency.
export default async function Home() {
  const [page, products, currency] = await Promise.all([
    loadPage("home"),
    catalogue(),
    visitorCurrency(),
  ]);
  const tokens = priceTokens(products, currency);
  const data = page.data as {
    headline?: string;
    subhead?: string;
    cta_free?: string;
    cta_buy?: string;
  };

  const ctas = (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link
        href="/check"
        className="bg-accent text-on-accent rounded-full px-6 py-4 text-center text-lg font-semibold no-underline"
      >
        {data.cta_free ?? "Start the free Product Check"}
      </Link>
      <Link
        href="/pricing"
        className="border-accent text-accent rounded-full border px-6 py-4 text-center text-lg font-semibold no-underline"
      >
        {data.cta_buy ?? "See the prices"}
      </Link>
    </div>
  );

  return (
    <>
      <DraftNotice draft={page.draft} />
      <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10">
        <h1 className="text-4xl sm:text-5xl">{fillTokens(data.headline ?? page.title, tokens)}</h1>
        {data.subhead ? <p className="mt-4 text-xl">{fillTokens(data.subhead, tokens)}</p> : null}
        {ctas}
        <div className="mt-12" data-testid="page-body">
          <Markdown>{fillTokens(page.body, tokens)}</Markdown>
        </div>
        {ctas}
      </main>
    </>
  );
}
