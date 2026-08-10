// The journal.
//
// An index rather than a feed of everything ever written: each entry is
// listed under the question it answers, because the question is what makes
// somebody click and is the honest description of what the piece is for. A
// list of titles is a list of headlines; a list of questions is a table of
// contents for somebody's actual problem.
//
// No categories, no tags, no pagination, no "related posts". Those are the
// furniture of a content operation and this is a handful of pieces by one
// person. They can be added when there is something to paginate.

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { NOT_ABOUT, published } from "@/lib/journal/entries";
import { fullDate } from "@/lib/words";

export const metadata = {
  title: `Journal — ${BRAND}`,
  description:
    "Writing about keeping a record of a childhood: what disappears, what to write down, and how little is enough.",
  alternates: { types: { "application/atom+xml": "/journal/feed.xml" } },
};

export default function JournalPage() {
  const entries = published();

  return (
    <div className="mx-auto !max-w-2xl py-16">
      <h1 className="text-display font-display lowercase">journal</h1>
      <p className="mt-7 max-w-[46ch] text-lede text-stone">
        Questions people actually ask us, answered properly. Useful whether or
        not you ever use the thing we make.
      </p>

      <ul className="mt-16 space-y-12">
        {entries.map((e) => (
          <li key={e.slug}>
            {/* The question above the title, because it is what a reader is
                looking for and the title is only how we refer to it. */}
            <p className="text-sm text-clay">{e.question}</p>
            <h2 className="mt-2 font-display text-2xl leading-snug">
              <Link href={`/journal/${e.slug}`} className="underline decoration-transparent underline-offset-4 transition hover:decoration-ink">
                {e.title}
              </Link>
            </h2>
            <p className="reading mt-2.5 max-w-[54ch] leading-relaxed text-stone">
              {e.description}
            </p>
            <p className="mt-2.5 text-xs text-stone">
              {fullDate(e.published)}
              {e.updated && <> &middot; rewritten {fullDate(e.updated)}</>}
            </p>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-stone">Nothing published yet.</li>
        )}
      </ul>

      {/* Said out loud, in the same place the writing is, rather than left as
          a policy in a file. A memory archive sits next to two kinds of
          writing it must never produce. */}
      <section className="mt-20 border-t border-rule pt-10">
        <h2 className="font-display text-xl">What we don&rsquo;t write about</h2>
        <ul className="mt-4 space-y-2 text-sm text-stone">
          {NOT_ABOUT.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-[54ch] text-xs leading-relaxed text-stone">
          Every piece here is written by a person and nothing on this page is
          generated. That is the same rule the product applies to your
          family&rsquo;s memories, applied to our own words for the same
          reason.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/tools" className="text-ochre">Free tools</Link>
        {" · "}
        <Link href="/journal/feed.xml" className="text-ochre">Feed</Link>
        {" · "}
        <Link href="/about" className="text-ochre">Who writes this</Link>
      </p>
    </div>
  );
}
