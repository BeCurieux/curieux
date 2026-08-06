// Landing page.
//
// Follows the Qotidia design direction: warm ground, lowercase serif, one
// terracotta accent, and privacy stated as a product feature rather than
// buried in a policy — which is the point the brief made, and the thing the
// machinery behind it now actually supports.
//
// Two deliberate omissions. Nothing here claims cloth binding or cream
// stock: the books are made on whatever the printer actually offers, and a
// website is not the place to promise a material nobody has confirmed. And
// there is still no photograph of a real printed copy — the one asset that
// would do more than any of this copy.

import Link from "next/link";
import { Shelf } from "./shelf";
import { colourForAge } from "@/lib/book/colours";
import { PRICES } from "@/lib/stripe";
import { PLAN_PRICES } from "@/lib/billing/plans";

const aud = (cents: number) => `A$${Math.round(cents / 100)}`;

const STEPS = [
  {
    title: "save",
    body: "Photos, the things they say, a line about a Tuesday. Add them as you go, or empty a year of camera roll in one afternoon.",
  },
  {
    title: "notice",
    body: "We find the shape of the year — the swimming, the yellow boots, Thursdays at Grandpa's — and ask you the few things a photograph can't answer.",
  },
  {
    title: "print",
    body: "At the end of the year it becomes one hardcover book. You read it first. Nothing prints until you say so.",
  },
];

const PILLARS = [
  ["private by default", "Nothing is public, ever. Only people you invite."],
  ["no ads", "You pay for a book. Your family isn't the product."],
  ["no AI training", "Your photographs never leave for a model."],
  ["export anytime", "Everything, at full quality, in one file."],
];

const PROMPTS = [
  "What's something they say often right now?",
  "What's the most used thing in the house this week?",
  "What made you both laugh today?",
];

export default function LandingPage() {
  const two = colourForAge(2);

  return (
    <div className="-mx-6">
      {/* Hero */}
      <section className="px-6 pb-16 pt-6 md:pb-24">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1fr_0.85fr]">
          <div>
            <h1 className="max-w-[11ch] text-display lowercase">keep the everyday</h1>
            <p className="mt-7 max-w-[40ch] text-lg leading-relaxed text-stone">
              Qotidia keeps your photographs, notes, sayings and voice
              recordings &mdash; then turns each year into one book you&rsquo;ll
              still have when they&rsquo;re thirty.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn">start your year</Link>
              <a href="#books" className="btn-secondary">see the books</a>
            </div>
            <p className="mt-7 text-sm text-stone">
              <Link href="/privacy" className="hover:text-ink">
                Private by default &mdash; here&rsquo;s exactly how &rarr;
              </Link>
            </p>
          </div>

          {/* The book, in the real colour of two. Standing in until there is
              a photograph of a printed copy on somebody's actual table. */}
          <div
            className="mx-auto flex aspect-[1/1.3] w-full max-w-sm flex-col items-center justify-center rounded-r-md p-10 text-center shadow-2xl"
            style={{ backgroundColor: two.hex, color: two.inkHex }}
          >
            <div className="font-display text-4xl lowercase">florence</div>
            <div className="my-5 h-px w-16 bg-current opacity-50" />
            <div className="font-display text-xl lowercase">two</div>
            <div className="my-5 h-px w-16 bg-current opacity-50" />
            <div className="text-xs tracking-[0.2em] opacity-75">2028</div>
            <div className="mt-auto text-[0.65rem] tracking-[0.26em] opacity-70">qotidia</div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* how it works */}
        <section className="border-t border-rule py-16 md:py-20">
          <h2 className="text-center text-title lowercase">how it works</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title}>
                <div className="font-display text-sm text-ochre">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-2 font-display text-2xl lowercase">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* the shelf */}
        <section id="books" className="border-t border-rule py-16 md:py-20">
          <h2 className="max-w-[18ch] text-title lowercase">a book for every year</h2>
          <p className="mt-4 max-w-[48ch] text-stone">
            Every age has its own colour, fixed for good. A row of them is
            recognisable across a room &mdash; and so is the gap where a year
            is missing.
          </p>
          <Shelf from={1} count={8} owned={[1, 2, 3, 4, 5]} className="mt-10" />
          <p className="mt-6 max-w-[52ch] text-sm leading-relaxed text-stone">
            A4 hardcover, printed on uncoated stock and bound to be opened for
            years rather than looked at once. Where you&rsquo;ve recorded their
            voice, the page carries a small mark &mdash; scan it and you hear
            them say it again, at two, at four, at twenty.
          </p>
        </section>

        {/* privacy, as a feature */}
        <section className="border-t border-rule py-16 md:py-20">
          <h2 className="text-title lowercase">private. personal. yours.</h2>
          <p className="mt-4 max-w-[52ch] text-stone">
            Their childhood isn&rsquo;t content. Some memories are meant to be
            shared &mdash; not with everyone.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map(([title, blurb]) => (
              <li key={title} className="card">
                <div className="font-display text-lg lowercase">{title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-stone">{blurb}</p>
              </li>
            ))}
          </ul>
          <Link href="/privacy" className="mt-6 inline-block text-sm text-ochre">
            How we keep your family private &rarr;
          </Link>
        </section>

        {/* prompts */}
        <section className="border-t border-rule py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="max-w-[16ch] text-title lowercase">a little nudge goes a long way</h2>
              <p className="mt-4 max-w-[40ch] text-stone">
                Every so often we ask one small question &mdash; the kind you
                can answer in a sentence and would never have thought to write
                down.
              </p>
            </div>
            <ul className="grid gap-3">
              {PROMPTS.map((p, i) => (
                <li
                  key={p}
                  className={`card font-display text-lg leading-snug ${i === 1 ? "border-clay" : ""}`}
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* price */}
        <section className="border-t border-rule py-16 md:py-20">
          <h2 className="text-title lowercase">what it costs</h2>
          <p className="mt-4 max-w-[52ch] text-stone">
            Two ways, and they&rsquo;re different things. Buy the book once, or
            keep the year and the book comes with it.
          </p>

          <div className="card mt-8 max-w-lg border-clay">
            <div className="font-display text-5xl leading-none">
              {aud(PRICES.bookAud())}
              <span className="ml-2 align-middle font-body text-sm text-stone">
                one book, delivered
              </span>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm text-stone">
              {[
                "The printed hardcover, to your door",
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
            <Link href="/signup?plan=one_off" className="btn mt-6">just the book</Link>
          </div>

          {/* The second plan, stated rather than hidden behind a link. The
              page said "no subscription, nothing to cancel" while a monthly
              plan existed — the same landing-page-contradicts-the-checkout
              failure this project started by fixing. */}
          <div className="card mt-4 max-w-lg">
            <div className="font-display text-5xl leading-none">
              {aud(PLAN_PRICES.monthlyAud())}
              <span className="ml-2 align-middle font-body text-sm text-stone">
                a month, book included
              </span>
            </div>
            <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-stone">
              The archive stays open all year and each year&rsquo;s book is
              included. Stop whenever you like &mdash; everything you&rsquo;ve
              kept stays yours to read and download, always.
            </p>
            <Link href="/signup?plan=monthly" className="btn-secondary mt-6">keep the year</Link>
          </div>

          <p className="mt-6 text-sm">
            <Link href="/pricing" className="text-ochre">
              The two side by side
            </Link>
          </p>

          <p className="mt-6 max-w-[48ch] text-sm leading-relaxed text-stone">
            Extra copies for grandparents are {aud(PRICES.extraCopyAud())} each when ordered
            together, and come to you to pass on. Free to build &mdash; you pay once you&rsquo;ve read it
            through and you&rsquo;re happy to print.
          </p>
        </section>

        <section className="border-t border-rule py-16 text-center md:py-20">
          <p className="mx-auto max-w-[22ch] font-display text-title lowercase">
            you live it. we help you keep it.
          </p>
          <Link href="/signup" className="btn mt-8">start your year</Link>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-8">
          <span className="font-display text-lg lowercase">qotidia</span>
          <nav className="flex gap-5 text-xs text-stone">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
