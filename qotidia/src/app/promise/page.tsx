// The Qotidia Privacy Promise.
//
// A different document from /privacy, and the difference is deliberate.
// That page explains how the product works and answers the six questions
// people ask. This one is nine numbered undertakings with dates on them —
// the short thing a family can come back to in three years and check us
// against, which is not something an FAQ can be used for.
//
// Set like a document rather than a landing page: no cards, no icons, no
// call to action in the middle of it. It is meant to look like something
// signed, because that is what it is.
//
// The change history at the foot is the load-bearing part. Any company can
// write nine promises; the thing worth the page is that these cannot be
// edited afterwards without it showing. lib/trust/promise.ts argues the
// design, and tests/promise.test.ts fingerprints every published wording so
// that a silent edit fails the build.

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AS_AT, HISTORY, STATUTORY, UNDERTAKINGS } from "@/lib/trust/promise";
import { fullDate } from "@/lib/words";
import { FROM } from "@/lib/email/provider";

export const metadata = {
  title: `The ${BRAND} Privacy Promise`,
  description:
    "Nine numbered promises about your family's archive, each dated. We never edit or delete one — if we stop keeping a promise it stays here, struck through, with the reason.",
};

export default function PromisePage() {
  return (
    <div className="mx-auto !max-w-2xl py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">As at {fullDate(AS_AT)}</p>
      <h1 className="mt-4 max-w-[14ch] font-display leading-[1.05]" style={{ fontSize: "clamp(2.2rem, 6vw, 3.4rem)" }}>
        The {BRAND} Privacy Promise
      </h1>

      <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-stone">
        Nine things, numbered so you can hold us to one of them. We don&rsquo;t
        edit this page. If we ever stop keeping a promise it stays here with the
        date we withdrew it and why &mdash; struck through, where you can see
        it.
      </p>

      {/* ------------------------------------------------------ the promises
          Numbered in the margin, wide-leaded, one to a block. The number is
          the point of the layout: an undertaking you can cite is a different
          object from a paragraph of reassurance. */}
      <ol className="mt-14 space-y-12">
        {UNDERTAKINGS.map((u) => (
          <li key={u.n} className="grid grid-cols-[2.5rem_1fr] gap-x-4">
            <span
              className={`font-display text-2xl leading-none ${u.withdrawn ? "text-stone/50" : "text-clay"}`}
              aria-hidden
            >
              {u.n}
            </span>

            <div>
              <h2 className={`font-display text-xl leading-snug ${u.withdrawn ? "text-stone line-through" : ""}`}>
                {u.heading}
              </h2>
              <p
                className={`reading mt-2.5 max-w-[54ch] leading-relaxed ${
                  u.withdrawn ? "text-stone line-through" : ""
                }`}
              >
                {u.text}
              </p>

              {/* Where it is actually done. A promise with nothing behind it
                  is the thing this page is trying not to be, and naming the
                  mechanism is cheap when the mechanism exists. */}
              <p className="mt-2.5 max-w-[54ch] text-xs leading-relaxed text-stone">
                <span className="whitespace-nowrap">Promised {fullDate(u.since)}</span>
                {" \u00b7 "}
                {u.kept}
              </p>

              {u.withdrawn && (
                <p className="mt-3 max-w-[54ch] border-l-2 border-clay pl-4 text-sm leading-relaxed">
                  <strong className="font-normal">
                    Withdrawn {fullDate(u.withdrawn.on)}.
                  </strong>{" "}
                  {u.withdrawn.why}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* ---------------------------------------------------- the honest limit
          Immediately after the promises rather than buried, because a list of
          nine undertakings with no stated limit reads as a tenth, unstated,
          much larger one. */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-xl">What this doesn&rsquo;t promise</h2>
        <p className="reading mt-3 max-w-[54ch] leading-relaxed text-stone">
          That nothing will ever go wrong. No honest company can promise that,
          and one that does is telling you something about itself rather than
          about its security. Promise 8 is what we do when it does.{" "}
          <Link href="/privacy" className="text-ochre">
            How the whole thing works
          </Link>
          , if you want the long version.
        </p>
        <p className="reading mt-4 max-w-[54ch] text-sm leading-relaxed text-stone">
          {STATUTORY}
        </p>
      </section>

      {/* ------------------------------------------------------ the history
          The load-bearing part. Nine promises are easy to write; a public,
          append-only record of every time they changed is the bit that costs
          something, and therefore the bit worth reading. */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-xl">Every change to this page</h2>
        <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-stone">
          Newest first. Nothing is removed from this list either.
        </p>

        <ol className="mt-8 space-y-6">
          {HISTORY.map((c) => (
            <li key={c.on} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-x-6">
              <span className="text-sm text-stone">{fullDate(c.on)}</span>
              <span>
                <span className="block text-sm">{c.what}</span>
                <span className="mt-1 block max-w-[48ch] text-xs leading-relaxed text-stone">
                  {c.why}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* The address is the one we actually send from, not a second one
          invented for this page. A promise signed with a mailbox nobody
          reads is the cheapest kind of promise there is. */}
      <p className="mt-16 border-t border-rule pt-8 text-sm text-stone">
        Written by the person who built this, and answerable for it.{" "}
        <a href={`mailto:${FROM.address}`} className="text-ochre">
          {FROM.address}
        </a>
      </p>
    </div>
  );
}
