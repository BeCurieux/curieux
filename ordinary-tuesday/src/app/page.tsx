// Landing page (brief §28).
//
// Print-first: the object is the product, the archive supports it. Leads with
// the family, never with the technology — no clustering, no provenance, no
// mention of AI. A parent should be able to read this in forty seconds.

import Link from "next/link";
import { Shelf } from "./shelf";
import { colourForAge } from "@/lib/book/colours";

export default function LandingPage() {
  const two = colourForAge(2);
  return (
    <div className="-mx-6">
      {/* Hero — opens on the dark of forgetting, resolves onto paper below. */}
      <section className="bg-ink px-6 py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="max-w-[13ch] text-display">
              They won&rsquo;t remember <span className="text-paper/40">being two.</span>
            </h1>
            <p className="mt-8 max-w-[38ch] text-lg leading-relaxed text-paper/75">
              The year is already in your camera roll. We turn it into one
              beautiful hardcover book — on your shelf in about two weeks.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn !bg-paper !text-ink hover:!bg-boot">
                Make their year
              </Link>
              <a href="#inside" className="btn-secondary !border-paper/30 !text-paper hover:!border-paper">
                Look inside
              </a>
            </div>
            <p className="mt-6 text-sm text-paper/50">
              About half an hour of your time. Nothing prints until you approve it.
            </p>
          </div>

          {/* The book itself, in the actual colour of two — faded butter, the
              same value that prints on the cover. A grey gradient here was
              standing in for the one thing the page is selling. */}
          <div
            className="mx-auto flex aspect-[1/1.26] w-full max-w-sm flex-col justify-between rounded-r-md p-8 shadow-2xl"
            style={{ backgroundColor: two.hex, color: two.inkHex }}
          >
            <span className="text-[0.6rem] uppercase tracking-[0.3em] opacity-60">
              Ordinary Tuesday
            </span>
            <div>
              <div className="font-display text-3xl leading-tight">
                The Year
                <br />
                You Were Two
              </div>
              <div className="mt-2 opacity-70">Florence</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* The shelf — the row is the real product. */}
        <section className="py-16 md:py-20">
          <h2 className="max-w-[17ch] text-3xl md:text-4xl">
            Start with the year that&rsquo;s just gone.
          </h2>
          <p className="mt-4 max-w-[48ch] text-stone">
            Then do it again next year, and the year after. Not an app full of
            photographs nobody opens — a row of books on a shelf, each one a
            year, that your child will one day take down and read about
            themselves.
          </p>

          {/* The real spectrum from colours.ts — every age has had its own
              permanent colour since the beginning, and the site had never
              shown one. Three of them are drawn as still to come, because the
              gap in the sequence is the point. */}
          <Shelf from={1} count={8} owned={[1, 2, 3, 4, 5]} className="mt-10" />
          <p className="mt-4 max-w-[46ch] text-sm text-stone">
            Every age has its own colour, fixed for good. You can see across a
            room which years a family has kept &mdash; and which one is missing.
          </p>
        </section>

        {/* Three beats, measured in time — the real argument. */}
        <section className="border-t border-rule py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl">What you actually do.</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              {
                when: "Twenty minutes",
                title: "Empty your camera roll into it",
                body: "Drag in the year and walk away. Add the things they say and the details you'd swear you'll remember and won't — the rabbit's name, the three songs at bedtime. Grandparents can add theirs too.",
              },
              {
                when: "Same day",
                title: "We make the book",
                body: "We find the shape of their year — the swimming, the yellow boots, Saturdays at Grandpa's — ask a few small questions only you can answer, and design every page.",
              },
              {
                when: "About two weeks",
                title: "You approve it, then it arrives",
                body: "Read it through, change anything, take out what doesn't belong. Nothing is printed until you say so. Then it turns up at your door, and the year is kept.",
              },
            ].map((beat) => (
              <div key={beat.when}>
                <div className="text-xs uppercase tracking-[0.18em] text-ochre">{beat.when}</div>
                <h3 className="mt-2 text-xl leading-snug">{beat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone">{beat.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* One spread — shows the restraint rather than claiming it. */}
        <section id="inside" className="border-t border-rule py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl">A page from inside.</h2>
          <p className="mt-4 max-w-[48ch] text-stone">
            No captions announcing that childhood is precious. Just what
            actually happened, in the fewest words that will hold it.
          </p>

          <div className="mt-8 grid grid-cols-2 overflow-hidden rounded border border-rule bg-card shadow-sm">
            <div className="border-r border-rule p-5 md:p-8">
              <div className="aspect-[3/4] rounded-sm bg-gradient-to-br from-stone/40 to-slate/40" />
              <p className="mt-3 text-xs leading-relaxed text-stone">
                March — the third week of refusing to take them off
              </p>
              <p className="mt-5 text-[0.6rem] tracking-[0.16em] text-stone">18</p>
            </div>
            <div className="p-5 md:p-8">
              <div className="mb-3 text-[0.62rem] uppercase tracking-[0.2em] text-ochre">
                Chapter four
              </div>
              <p className="max-w-[26ch] font-display text-xl leading-snug md:text-2xl">
                For three months, you refused to leave the house without the
                yellow boots.
              </p>
              <div className="mt-4 aspect-[4/3] rounded-sm bg-gradient-to-br from-stone/40 to-slate/40" />
              <p className="mt-3 text-xs text-stone">Not raining. Not once.</p>
              <p className="mt-5 text-[0.6rem] tracking-[0.16em] text-stone">19</p>
            </div>
          </div>

          <p className="mt-6 max-w-[54ch] text-sm text-stone">
            Where you&rsquo;ve recorded their voice, the printed page carries a
            small mark. Scan it and you hear them say it — at two, at four, at
            twenty.
          </p>
        </section>

        {/* Price — a transaction, not a commitment. */}
        <section className="border-t border-rule py-16 md:py-20">
          <h2 className="text-3xl md:text-4xl">What it costs.</h2>
          <p className="mt-4 text-stone">
            You pay for a book. You get a book. No subscription, nothing to cancel.
          </p>

          <div className="card mt-8 max-w-lg border-boot">
            <div className="font-display text-5xl leading-none">
              A$199
              <span className="ml-2 align-middle font-body text-sm text-stone">
                one book, delivered
              </span>
            </div>
            <p className="mt-4 max-w-[30ch] font-display text-lg leading-snug">
              Their whole year, printed and bound, on your shelf in about two weeks.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-stone">
              {[
                "The printed hardcover, delivered to your door",
                "The digital copy, to keep and to share",
                "Your private archive — unlimited photos, quotes and voices",
                "Unlimited family contributors, free",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-ochre">&mdash;</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn mt-6">Make their year</Link>
          </div>

          <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-stone">
            Extra copies for grandparents are A$79 each when ordered together.
            Free to build — you pay when you&rsquo;ve read it through and
            you&rsquo;re happy to print. Next year, do it again.
          </p>
        </section>

        <section className="border-t border-rule py-16 text-center md:py-20">
          <p className="mx-auto max-w-[20ch] font-display text-3xl leading-tight md:text-4xl">
            You live it. <em className="text-slate">We help you keep it.</em>
          </p>
          <Link href="/signup" className="btn mt-8">Make their year</Link>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-8">
          <span className="text-xs uppercase tracking-[0.3em]">Ordinary Tuesday</span>
          <p className="max-w-[50ch] text-xs leading-relaxed text-stone">
            Everything you add stays private. Your photographs are never made
            public, never sold, and never used to train anything.
          </p>
        </footer>
      </div>
    </div>
  );
}
