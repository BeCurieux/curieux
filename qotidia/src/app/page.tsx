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
import { BRAND, TAGLINE } from "@/lib/brand";
import { MARKETING } from "@/lib/marketing/imagery";
import { NOTICING_CAPTION, whatItNoticed } from "@/lib/marketing/noticing";
import { SPREADS, SPREADS_DISCLOSURE, spreadSrc } from "@/lib/marketing/spreads";
import { questions } from "@/lib/marketing/questions";
import { PRICING, PRICING_LOWER } from "@/lib/nav";
import { aud } from "@/lib/billing/money";

const STEPS = [
  {
    title: "keep",
    body: "A photograph, something they said, one line about a Wednesday. Add them as you go — or empty a year of camera roll in an evening.",
  },
  {
    title: "notice",
    body: "We find the shape of the year: the swimming, the yellow boots, Thursdays at Grandpa's. And we ask the few things a photograph can't answer.",
  },
  {
    title: "print",
    body: "In December it becomes one hardcover book. You read every page first. Nothing goes to a printer until you say so.",
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
  // Computed here, on the server, by the product's own engine. See
  // lib/marketing/noticing.ts for why this is not three strings.
  const noticed = whatItNoticed();

  return (
    <div className="grain">
      {/* ------------------------------------------------------------ hero
          Asymmetric and overlapping: the type runs under the object rather
          than sitting politely beside it in a two-column grid. */}
      <section className="bleed relative overflow-hidden bg-paper">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-8">
            <div>
              {/* The one line a stranger needs before anything else.
                  "keep the everyday" is the brand and it is a good line, but
                  it is a feeling, not an explanation — and it was the first
                  and only thing this page said. Somebody who has never heard
                  of us could read the whole hero and still not know whether
                  this was an app, a photo book, or a diary. That is not a
                  design problem you can style your way out of, so the
                  sentence goes first. */}
              <p className="rise pill" style={{ ["--d" as string]: "0ms" }}>
                <span aria-hidden className="pill-dot" />
                A private archive, and one printed book a year
              </p>
              <h1
                className="rise mt-7 font-display lowercase leading-[0.92] tracking-tight"
                style={{ ["--d" as string]: "80ms", fontSize: "clamp(3rem, 8vw, 6.25rem)" }}
              >
                keep the
                <br />
                everyday
              </h1>
              <p
                className="rise mt-7 max-w-[42ch] text-xl leading-relaxed text-stone"
                style={{ ["--d" as string]: "160ms" }}
              >
                {BRAND} keeps your child&rsquo;s photographs, the funny things
                they say, and the days that felt like nothing at the time.
                Every year it becomes one hardcover book &mdash; the one still
                on the shelf when they&rsquo;re thirty.
              </p>
              <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "240ms" }}>
                <Link href="/signup?plan=monthly" className="btn !px-8 !py-4 !text-base">
                  start your year
                </Link>
                <Link href="#inside" className="btn-secondary !px-8 !py-4 !text-base">
                  see inside the book
                </Link>
              </div>
              {/* The price, once, small, where a person looks for it — rather
                  than made them hunt or hit a wall of cards later. */}
              <p className="rise mt-6 text-sm text-stone" style={{ ["--d" as string]: "300ms" }}>
                {aud(PLAN_PRICES.monthlyAud())} a month with the book included,
                or {aud(PRICES.bookAud())} for the book on its own.{" "}
                <Link href="/pricing" className="text-ochre underline underline-offset-4">
                  {PRICING_LOWER}
                </Link>
              </p>
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

      {/* --------------------------------------------------------- how
          Moved up from fourth. These three steps are the answer to "what is
          this", and they were sitting below two sections that only make
          sense once you already knew — the proof of what it notices, and a
          shelf of books for a product the reader had not yet understood
          produces books. A page can be beautifully paced and still put the
          explanation after the argument. */}
      <section className="bleed band-card py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display lowercase" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)" }}>
            how it works
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="panel-raised">
                <span className="block font-display text-5xl leading-none text-clay/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-display text-2xl lowercase">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- noticing
          The proof, immediately after the promise, before anything asks for
          money. Every other section on this page describes the product; this
          one runs it. The lines are generated at render time by the same
          function the weekly note calls — see lib/marketing/noticing.ts.

          The second dark band on the page. The privacy band used to be the
          only inversion and that was a good rule, but these two are the
          things worth inverting for: what it does, and what it promises. */}
      <section className="bleed band-ink py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs uppercase tracking-[0.32em] text-paper/50">
            one week, from one archive
          </p>
          <h2
            className="mt-6 font-display lowercase"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            nobody writes this down
          </h2>

          <ul className="mt-14 space-y-10">
            {noticed.map((o) => (
              <li key={o.entityId} className="border-t border-paper/15 pt-6">
                <p
                  className="font-display leading-[1.15]"
                  style={{ fontSize: "clamp(1.55rem, 3.6vw, 2.85rem)" }}
                >
                  {o.line}
                </p>
                {/* The provenance rule, on the marketing page. Every line
                    this product says can be traced to the memories it was
                    counted from, and saying so is more persuasive than any
                    adjective available here. */}
                <p className="mt-3 text-sm text-paper/45">
                  counted from {o.memoryIds.length} memories
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-14 max-w-[54ch] text-sm leading-relaxed text-paper/55">
            {NOTICING_CAPTION}
          </p>
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

      {/* --------------------------------------------------------- inside
          Every image on this page was a cover. A site selling a book that
          never shows a page is asking for a lot of trust, and the objection
          it leaves unanswered — is this a designed object or a photo dump
          with a hard cover — is the one that decides the sale.

          Spreads rather than single pages, because a book is read two pages
          at a time and the facing-page relationship is most of what the
          design does. Rendered by scripts/sample-spreads.mts through the
          production renderer, so these cannot drift from the printed
          article: change the book's typography and re-run, and the website
          is correct again. */}
      <section id="inside" className="bleed band-card scroll-mt-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display lowercase" style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>
            inside one of them
          </h2>
          <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">
            One idea to a page, room around it, and the things they said set
            large enough to stop you turning past.
          </p>

          <figure className="mt-14">
            <img
              src={spreadSrc(SPREADS[0].id)}
              alt={SPREADS[0].alt}
              className="block w-full rounded-sm shadow-[0_28px_60px_-24px_rgba(43,38,32,0.42)]"
            />
            <figcaption className="mt-5 max-w-[52ch] leading-relaxed text-stone">
              {SPREADS[0].caption}
            </figcaption>
          </figure>

          <div className="mt-14 grid gap-12 md:grid-cols-2">
            {SPREADS.slice(1).map((s) => (
              <figure key={s.id}>
                <img
                  src={spreadSrc(s.id)}
                  alt={s.alt}
                  className="block w-full rounded-sm shadow-[0_20px_44px_-20px_rgba(43,38,32,0.38)]"
                />
                <figcaption className="mt-5 max-w-[42ch] text-sm leading-relaxed text-stone">
                  {s.caption}
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Beside the images, not in a policy. See SPREADS_DISCLOSURE. */}
          <p className="mt-16 max-w-[54ch] text-sm leading-relaxed text-stone">
            {SPREADS_DISCLOSURE}
          </p>
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

      {/* ----------------------------------------------------- questions
          The objections, in the order they occur to somebody deciding. This
          page had none — it made its case and then stopped, leaving "what
          happens if I stop paying" and "does an AI write it" to be worried
          about privately, which is where a sale goes to die.

          Native <details>, so it works before hydration and is keyboard- and
          screen-reader-correct without anybody maintaining aria-expanded. */}
      <section className="bleed band-card py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <h2 className="font-display lowercase" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              questions
              <br />
              worth asking
            </h2>
            <p className="mt-5 max-w-[32ch] leading-relaxed text-stone">
              And if yours isn&rsquo;t here, a person answers the email.
            </p>
          </div>
          <div>
            {questions().map((item) => (
              <details key={item.q} className="qa">
                <summary>{item.q}</summary>
                <div>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- close */}
      {shelf.isPhoto && (
        <section className="bleed">
          <img src={shelf.src} alt={shelf.alt} className="h-[26rem] w-full object-cover md:h-[34rem]" />
        </section>
      )}

      {/* The last thing on the page used to be the tagline and a button —
          a beautiful full stop that asked somebody to commit having just
          been told nothing new. It now closes the way the page opened: what
          this is, what it costs, and the two things that stop people. */}
      <section className="bleed bg-paper py-24 text-center md:py-32">
        <p
          className="mx-auto max-w-[16ch] font-display lowercase leading-[1.05]"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
        >
          {TAGLINE}
        </p>
        <p className="mx-auto mt-6 max-w-[44ch] px-6 text-lg leading-relaxed text-stone">
          Start today and this year is already being kept. The book comes at
          the end of it, and you read every page before it prints.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 px-6">
          <Link href="/signup?plan=monthly" className="btn !px-8 !py-4 !text-base">
            start your year
          </Link>
          <Link href="/pricing" className="btn-secondary !px-8 !py-4 !text-base">
            {PRICING_LOWER}
          </Link>
        </div>
        <p className="mt-6 text-sm text-stone">
          {aud(PLAN_PRICES.monthlyAud())} a month, or {aud(PRICES.bookAud())} for
          the book on its own. Stop any time &mdash; what you&rsquo;ve kept stays
          yours.
        </p>
      </section>

      <footer className="bleed bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-rule px-6 py-10">
          <span className="font-display text-lg lowercase">qotidia</span>
          <nav className="flex gap-6 text-xs text-stone">
            <Link href="/pricing" className="hover:text-ink">{PRICING}</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
