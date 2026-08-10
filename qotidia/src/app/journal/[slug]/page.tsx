// One journal entry.
//
// Three things this page has to get right, and only one of them is visible.
//
//   **The prose has to be readable.** The same editorial serif the book uses,
//   a measure that stops at a comfortable line length, and enough space
//   between paragraphs that a long piece does not look like work. Everything
//   in `.journal` below is that and nothing else.
//
//   **The metadata has to be true.** A canonical URL, a real published date
//   and a modified date that only moves when somebody actually rewrote
//   something. A page that claims to have been updated today because it was
//   deployed today is lying to a search engine and to a reader in the same
//   breath.
//
//   **The structured data has to match the page.** JSON-LD that disagrees
//   with what a person sees is the machine-readable version of a lie, and it
//   is the one that gets a site penalised. Every field here is read from the
//   same entry the page renders.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { entryBySlug, published } from "@/lib/journal/entries";
import { BASE } from "@/app/robots";
import { fullDate } from "@/lib/words";
import { signedBy } from "@/lib/trust/founder";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return published().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const entry = entryBySlug(params.slug);
  if (!entry) return { title: BRAND };
  return {
    title: `${entry.title} — ${BRAND}`,
    description: entry.description,
    // One address for this piece, so a query string or a trailing slash does
    // not become a second page competing with the first.
    alternates: { canonical: `${BASE}/journal/${entry.slug}` },
    openGraph: {
      type: "article",
      title: entry.title,
      description: entry.description,
      url: `${BASE}/journal/${entry.slug}`,
      publishedTime: entry.published,
      modifiedTime: entry.updated ?? entry.published,
    },
  };
}

export default async function JournalEntryPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const entry = entryBySlug(params.slug);
  if (!entry) notFound();

  const Body = entry.body;

  return (
    <article className="mx-auto !max-w-2xl py-16">
      {/* Read from the same entry the page renders, so the machine-readable
          version cannot drift from the human one. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: entry.title,
            description: entry.description,
            datePublished: entry.published,
            dateModified: entry.updated ?? entry.published,
            mainEntityOfPage: `${BASE}/journal/${entry.slug}`,
            author: { "@type": "Organization", name: BRAND },
            publisher: { "@type": "Organization", name: BRAND },
          }),
        }}
      />

      <p className="text-sm text-clay">{entry.question}</p>
      <h1 className="mt-3 max-w-[18ch] font-display leading-[1.05]" style={{ fontSize: "clamp(2.2rem, 6vw, 3.2rem)" }}>
        {entry.title}
      </h1>
      <p className="mt-6 text-xs text-stone">
        {fullDate(entry.published)}
        {entry.updated && <> &middot; rewritten {fullDate(entry.updated)}</>}
        {" · "}written by {signedBy()}
      </p>

      {/* The reading column. Set once here rather than on every paragraph of
          every entry, so writing one is writing prose and nothing else. */}
      <div className="journal reading mt-12">
        <Body />
      </div>

      <footer className="mt-20 border-t border-rule pt-8 text-sm text-stone">
        <p>
          <Link href="/journal" className="text-ochre">More like this</Link>
          {" · "}
          <Link href="/" className="text-ochre">What {BRAND} is</Link>
        </p>
      </footer>
    </article>
  );
}
