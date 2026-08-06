// Landing page.
//
// Follows the Qotidia design direction: warm ground, lowercase serif, one
// terracotta accent, and privacy stated as a product feature rather than
// buried in a policy — which is the point the brief made, and the thing the
// machinery behind it now actually supports.
//
// Rebuilt after looking at a screenshot of it. The first version was seven
// sections of identical width on identical ground, separated by hairline
// rules — every block the same visual weight, nothing for the eye to land
// on, and not one image in a product about photographs. It was a
// well-set document, and it read like one.
//
// Three changes carry the fix. Sections now sit on full-bleed grounds that
// change — paper, ink, card — so the page has a horizon instead of a stack
// of ruled boxes. The book is rendered as an object with perspective, a
// spine and a shadow, because a printed thing is what is being sold and the
// page previously showed a coloured rectangle. And the covers are real: the
// nineteen renders in sample/covers come out of the same code that makes
// the printed article, so the imagery is the product rather than a stand-in.
//
// Still no photograph of a real printed copy in a real house. That remains
// the one asset that would do more than any of this, and it needs a sample
// to exist first.

import Link from "next/link";
import { PRICES } from "@/lib/stripe";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { TAGLINE } from "@/lib/brand";
import { MARKETING } from "@/lib/marketing/imagery";

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
  const hero = MARKETING.hero();
  const dark = MARKETING.dark();
  const shelf = MARKETING.shelf();

  return (
    <div className="grain">
      {/* ------------------------------------------------------------ hero
          Asymmetric and overlapping: the type runs under the object rather
          than sitting politely beside it in a two-column grid. */}
      <section className="bleed relative overflow-hidden bg-paper">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-8">
            <div>
              <p className="rise text-xs uppercase tracking-[0.32em] text-clay" style={{ ["--d" as string]: "0ms" }}>
                {TAGLINE}
              </p>
              <h1
                className="rise mt-6 font-display lowercase leading-[0.92] tracking-tight"
                style={{ ["--d" as string]: "80ms", fontSize: "clamp(3.25rem, 9vw, 7rem)" }}
              >
                keep the
                <br />
                everyday
              </h1>
              <p
                className="rise mt-8 max-w-[38ch] text-lg leading-relaxed text-stone"
                style={{ ["--d" as string]: "160ms" }}
              >
                Qotidia keeps your photographs, notes, sayings and voice
                recordings &mdash; then turns each year into one book
                you&rsquo;ll still have when they&rsquo;re thirty.
              </p>
              <div className="rise mt-10 flex flex-wrap items-center gap-4" style={{ ["--d" as string]: "240ms" }}>
                <Link href="/signup?plan=monthly" className="btn !px-8 !py-4 !text-base">
                  start your year
                </Link>
                <Link href="/pricing" className="text-sm text-ink/70 underline underline-offset-4 hover:text-clay">
                  what it costs
                </Link>
              </div>
            </div>

            {/* The object. A photograph already has its own light, shadow and
                perspective, so the CSS book treatment is applied only to the
                flat cover render — doing both would be a fake shadow under a
                real one. */}
            <div className="rise flex justify-center md:justify-end" style={{ ["--d" as string]: "320ms" }}>
              {hero.isPhoto ? (
                <img
                  src={hero.src}
                  alt={hero.alt}
                  className="w-[19rem] rounded-sm object-cover shadow-[0_30px_60px_-24px_rgba(43,38,32,0.35)] md:w-[26rem]"
                />
              ) : (
                <div className="volume w-[16rem] rounded-sm md:w-[21rem]">
                  <img src={hero.src} alt={hero.alt} className="block w-full rounded-sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- the set
          Real covers, overlapping, receding. The strongest thing the brand
          owns, shown at a size where it actually registers. */}
      <section className="bleed band-card overflow-hidden py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display lowercase" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
            a book for every year
          </h2>
          <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">
            Every age has its own colour, fixed for good. A row of them is
            recognisable across a room &mdash; and so is the gap where a year
            is missing.
          </p>
        </div>
        {/* Overlapped, but only just. The first version used -2.25rem against
            a 10rem cover, which hid five sevenths of every book and read as
            one solid bar of colour rather than as a set of things. A shelf is
            legible because you can see where each spine ends. */}
        <div className="mt-16 flex items-end justify-center px-6">
          {["01", "02", "03", "04", "05", "06", "07"].map((age, i) => (
            <div
              key={age}
              className="group relative flex-none transition-transform duration-500 hover:z-20 hover:-translate-y-4"
              style={{
                marginLeft: i === 0 ? 0 : "-0.9rem",
                zIndex: 10 - i,
                // A little rise and fall, so the row reads as objects
                // standing rather than as a chart.
                transform: `rotate(${(i % 3) - 1}deg) translateY(${(i % 2) * 6}px)`,
              }}
            >
              <img
                src={`/sample/age-${age}.png`}
                alt=""
                className="block w-[6.5rem] rounded-sm shadow-[0_16px_30px_-12px_rgba(43,38,32,0.45),-1px_0_0_rgba(43,38,32,0.10)] md:w-[9rem]"
              />
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- how
          Numbers set large enough to be a graphic element rather than a
          caption above a paragraph. */}
      <section className="bleed bg-paper py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <span className="block font-display text-6xl leading-none text-clay/25">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-display text-2xl lowercase">{step.title}</h3>
                <p className="mt-3 max-w-[34ch] leading-relaxed text-stone">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- privacy
          The dark band. One inversion in the whole page, spent on the thing
          the brand is actually built around. */}
      <section className="bleed band-ink py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="font-display lowercase" style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}>
                private. personal. yours.
              </h2>
              <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-paper/70">
                Their childhood isn&rsquo;t content. Some memories are meant to
                be shared &mdash; not with everyone.
              </p>
            </div>
            {/* Only shown when there is an actual dark-ground photograph. The
                cover render is bright and would punch a hole in this band. */}
            {dark.isPhoto && (
              <img src={dark.src} alt={dark.alt} className="w-full rounded-sm object-cover" />
            )}
          </div>
          <div className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map(([title, body]) => (
              <div key={title} className="border-t border-paper/25 pt-5">
                <h3 className="font-display text-xl lowercase text-paper">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-14">
            <Link href="/privacy" className="text-sm text-paper/80 underline underline-offset-4 hover:text-white">
              How we keep your family private
            </Link>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- nudge */}
      <section className="bleed bg-paper py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div>
            <h2 className="font-display lowercase" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              a little nudge
              <br />
              goes a long way
            </h2>
            <p className="mt-5 max-w-[36ch] leading-relaxed text-stone">
              Every so often we ask one small question &mdash; the kind you can
              answer in a sentence and would never have thought to write down.
            </p>
          </div>
          <div className="space-y-3 self-center">
            {PROMPTS.map((q, i) => (
              <p
                key={q}
                className="rounded-lg bg-card px-6 py-5 font-display text-lg leading-snug shadow-[0_2px_0_rgba(43,38,32,0.06)]"
                style={{ marginLeft: `${i * 1.75}rem` }}
              >
                {q}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- price */}
      <section className="bleed band-card py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display lowercase" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
            what it costs
          </h2>
          <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">
            Two ways, and they&rsquo;re different things. Buy the book once, or
            keep the year and the book comes with it.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-clay bg-white p-8">
              <div className="font-display text-5xl leading-none">{aud(PRICES.bookAud())}</div>
              <p className="mt-2 text-sm text-stone">one book, delivered</p>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  "The printed hardcover, to your door",
                  "The digital copy, to keep and to share",
                  "Your private archive — unlimited photos, quotes and voices",
                  "Unlimited family contributors, free",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="text-clay">&mdash;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=one_off" className="btn mt-8">just the book</Link>
            </div>

            <div className="rounded-lg border border-rule bg-white p-8">
              <div className="font-display text-5xl leading-none">{aud(PLAN_PRICES.monthlyAud())}</div>
              <p className="mt-2 text-sm text-stone">a month, book included</p>
              <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-stone">
                The archive stays open all year and each year&rsquo;s book is
                included. Stop whenever you like &mdash; everything you&rsquo;ve
                kept stays yours to read and download, always.
              </p>
              <Link href="/signup?plan=monthly" className="btn-secondary mt-8">keep the year</Link>
            </div>
          </div>

          <p className="mt-8 max-w-[52ch] text-sm leading-relaxed text-stone">
            Extra copies for grandparents are {aud(PRICES.extraCopyAud())} each when
            ordered together, and come to you to pass on. Free to build &mdash;
            you pay once you&rsquo;ve read it through and you&rsquo;re happy to
            print.{" "}
            <Link href="/pricing" className="text-ochre">The two side by side</Link>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- close */}
      {shelf.isPhoto && (
        <section className="bleed">
          <img src={shelf.src} alt={shelf.alt} className="h-[26rem] w-full object-cover md:h-[34rem]" />
        </section>
      )}

      <section className="bleed bg-paper py-28 text-center md:py-36">
        <p className="mx-auto max-w-[16ch] font-display lowercase leading-[1.05]" style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}>
          {TAGLINE}
        </p>
        <Link href="/signup" className="btn mt-10 !px-8 !py-4 !text-base">start your year</Link>
      </section>

      <footer className="bleed bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-rule px-6 py-10">
          <span className="font-display text-lg lowercase">qotidia</span>
          <nav className="flex gap-6 text-xs text-stone">
            <Link href="/pricing" className="hover:text-ink">What it costs</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
