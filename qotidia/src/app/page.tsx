// The homepage.
//
// Rebuilt to an editorial direction: one continuous story in eleven
// movements rather than fifteen SaaS blocks. The reference points are an
// independent publishing house and a well-art-directed interiors magazine —
// large type, a grid whose rhythm changes, generous air, and imagery treated
// as content rather than decoration.
//
// The three thoughts it is built to produce, in order: *this is beautiful*,
// then *it does the work for me*, then *I want that book*. Which is why the
// product interface does not appear until section six. Everything before it
// is the problem, the mechanism as a customer experiences it, and the
// object.
//
// Three rules that shaped the markup as much as the look.
//
// **No feature cards.** A page built out of little bordered boxes reads as
// software. Sections change ground and change width instead — full bleed,
// then a 7/5 split, then a narrow centred column — so the rhythm moves while
// the system stays the same.
//
// **AI is not in the visual identity.** It is named once, in an answer to a
// direct question, and never as a feature. What the customer buys is a book
// that knows what a year was like; how that is assembled is infrastructure.
//
// **Nothing here invents a family.** Every specific detail on this page
// belongs to Florence, the fictional family in the seed, and the page says
// so where a reader could reasonably think otherwise. There are no
// testimonials, because there are no real ones yet — see lib/marketing/story.
//
// The gap this page still has is photographic. Every image below is either
// cover artwork we rendered or a book spread we rendered, and a rendered
// object communicates "here is our product design" where a photograph of the
// same book on somebody's shelf communicates "I can imagine that in my
// house". The slots are wired and briefed in lib/marketing/imagery.ts; the
// page changes the moment files land in public/sample.

import Link from "next/link";
import { PRICES } from "@/lib/stripe";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { BRAND, TAGLINE } from "@/lib/brand";
import { MARKETING } from "@/lib/marketing/imagery";
import { NOTICING_CAPTION, whatItNoticed } from "@/lib/marketing/noticing";
import { SPREADS, SPREADS_DISCLOSURE, spreadSrc } from "@/lib/marketing/spreads";
import { questions } from "@/lib/marketing/questions";
import {
  A_PHOTOBOOK_KEEPS,
  DEMONSTRATION,
  FORGOTTEN,
  PARENT_STORIES,
  QOTIDIA_ALSO_KEEPS,
} from "@/lib/marketing/story";
import { photo } from "@/lib/book/sample-volume";
import { PRICING_LOWER } from "@/lib/nav";
import { aud } from "@/lib/billing/money";

const STEPS = [
  {
    n: "01",
    title: "live",
    body: "Take the photographs you were going to take anyway.",
  },
  {
    n: "02",
    title: "qotidia notices",
    body: "The patterns, the people, the sayings and the small repeated things begin to surface.",
  },
  {
    n: "03",
    title: "you fill in what the camera missed",
    body: "A question every now and then. Usually answerable in a sentence.",
  },
  {
    n: "04",
    title: "your year becomes a book",
    body: "At the end of it, one hardcover volume — a portrait of who they were that year.",
  },
];

const PILLARS = [
  ["Private by default", "Only the people you invite belong here. Nothing is public, ever."],
  ["Your memories aren’t the product", "No advertising. Nothing sold. Never used to train a model."],
  ["Leave whenever you want", "Export everything at full quality. Delete it all, for real."],
];

/** The shelf: the first seven years, with a gap where a year is missing. */
const SHELF_YEARS = [
  { age: 0, word: "one" },
  { age: 1, word: "two" },
  { age: 2, word: "three" },
  { age: 3, word: "four" },
  { age: 4, word: "five", gapAfter: true },
  { age: 6, word: "seven" },
];

export default function LandingPage() {
  const hero = MARKETING.hero();
  const dark = MARKETING.dark();
  const shelf = MARKETING.shelf();
  const texture = MARKETING.texture();
  const hands = MARKETING.hands();
  // Generated at render time by the product's own engine — see
  // lib/marketing/noticing.ts for why this is not three strings.
  const noticed = whatItNoticed();

  return (
    <div className="grain">
      {/* ═══════════════════════════════════════════════════════ 01 · hero
          Roughly a full viewport, 42/58, with the type on the left and the
          object on the right. No pill, no badge, no coloured header box:
          the first thing on the page is a sentence, at a size that says the
          company is confident about it. */}
      <section className="bleed bg-paper">
        <div className="mx-auto max-w-page px-[5vw] pb-24 pt-10 md:pb-32 md:pt-16">
          <div className="grid items-center gap-14 md:grid-cols-[42fr_58fr] md:gap-12">
            <div>
              <h1 className="rise text-hero font-display lowercase" style={{ ["--d" as string]: "0ms" }}>
                the little things
                <br />
                disappear first.
              </h1>
              <p
                className="rise mt-9 max-w-[44ch] text-subhead text-stone"
                style={{ ["--d" as string]: "120ms" }}
              >
                {BRAND} notices the everyday details of family life, keeps the
                stories around your photographs, and turns each year into a
                book you&rsquo;ll keep for good.
              </p>
              <div className="rise mt-10 flex flex-wrap items-center gap-6" style={{ ["--d" as string]: "220ms" }}>
                <Link href="/signup?plan=monthly" className="btn !px-9 !py-4 !text-base">
                  Start keeping your year
                </Link>
                <Link href="#how" className="text-ochre underline underline-offset-4">
                  See how it works &rarr;
                </Link>
              </div>
            </div>

            {/* The object. A photograph carries its own light and shadow, so
                the CSS book treatment is applied only to flat cover artwork —
                doing both puts a fake shadow under a real one. */}
            <div className="rise" style={{ ["--d" as string]: "320ms" }}>
              {hero.isPhoto ? (
                <img
                  src={hero.src}
                  alt={hero.alt}
                  className="w-full rounded-sm object-cover shadow-[0_40px_80px_-32px_rgba(37,35,31,0.4)]"
                />
              ) : (
                <div className="flex justify-center md:justify-end">
                  <div className="volume w-[17rem] rounded-sm md:w-[23rem]">
                    <img src={hero.src} alt={hero.alt} className="block w-full rounded-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ 02 · the problem
          Almost nothing on the screen. This is the section that separates
          this from a photo book, and it works by leaving room. */}
      <section className="bleed bg-paper py-28 md:py-44">
        <div className="mx-auto max-w-page px-[5vw]">
          <p className="mx-auto max-w-[20ch] text-center text-display font-display lowercase">
            you photograph what happened.
          </p>
          <p className="mx-auto mt-8 max-w-[22ch] text-center text-display font-display lowercase text-stone">
            but not everything around it.
          </p>

          {/* The measure is in rem, not ch. A `ch` on the list resolves
              against the list's own font size — 16px — so max-w-[38ch] came
              out around 300px and broke every line of 48px type into four.
              Character units only work where the size is set. */}
          <ul className="mx-auto mt-24 max-w-[44rem] space-y-8 md:mt-32">
            {FORGOTTEN.map((line) => (
              <li key={line} className="text-title font-display leading-[1.15]">
                {line}
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-24 max-w-[24ch] text-center text-title font-display lowercase md:mt-32">
            qotidia keeps that part too.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ 03 · the demonstration
          The signature section. photograph → noticed → asked → answered →
          printed. Four beats, in the order a customer experiences them,
          none of them named after the machinery underneath.

          The camera roll is generated cover artwork standing in for candid
          photographs, which is the weakest thing on this page and the first
          thing a real shoot fixes. */}
      <section className="bleed band-card py-24 md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <div className="grid gap-16 md:grid-cols-[46fr_54fr] md:gap-20">
            {/* The evidence: a camera roll where the same thing keeps
                turning up. Generated stand-ins from the book's own renderer
                — the first version used flat blocks of the annual colours
                and read as a paint chart, which made the strongest section
                on the page look like a design system rather than somebody's
                photographs. Small on purpose: nine inline SVGs at page size
                would be most of the document. */}
            <div className="grid grid-cols-3 gap-2.5 self-start">
              {[3, 1, 5, 0, 3, 2, 4, 3, 1].map((seed, i) => (
                <img
                  key={i}
                  src={photo(seed, 520, 520)}
                  alt=""
                  className="aspect-square w-full rounded-sm object-cover"
                />
              ))}
            </div>

            {/* The story. */}
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-ochre">
                {DEMONSTRATION.eyebrow}
              </p>
              <h2 className="mt-6 text-display font-display lowercase">
                {DEMONSTRATION.heading[0]}
                <br />
                {DEMONSTRATION.heading[1]}
              </h2>

              <div className="mt-12 border-l-2 border-clay pl-6">
                <p className="text-lede">{DEMONSTRATION.question}</p>
              </div>

              <p className="mt-8 max-w-[46ch] text-lede text-stone">
                {DEMONSTRATION.answer}
              </p>

              <p aria-hidden className="mt-10 text-2xl text-clay">
                &darr;
              </p>

              <p className="mt-10 text-title font-display lowercase">
                {DEMONSTRATION.becomes}
              </p>
              <p className="mt-4 max-w-[44ch] text-stone">
                A chapter in this year&rsquo;s book — the photographs, and the
                sentence only you could have written.
              </p>
              <p className="mt-8 max-w-[44ch] text-sm text-stone">
                {DEMONSTRATION.disclosure}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════ 04 · how it works
          One horizontal sequence on desktop, an alternating vertical
          narrative on mobile. Not four identical cards. */}
      <section id="how" className="bleed bg-paper py-24 scroll-mt-2 md:py-32">
        <div className="mx-auto max-w-page px-[5vw]">
          <div className="grid gap-x-10 gap-y-14 md:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t border-rule pt-6">
                <span className="block text-sm tracking-[0.2em] text-clay">{step.n}</span>
                <h3 className="mt-5 font-display text-2xl lowercase leading-tight">
                  {step.title}
                </h3>
                <p className="mt-4 leading-relaxed text-stone">{step.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-20 text-title font-display lowercase">
            you live it. qotidia keeps it.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ 05 · the book */}
      <section className="bleed band-card py-24 md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <h2 className="max-w-[14ch] text-display font-display lowercase">
            a book for every year.
          </h2>
          <p className="mt-8 max-w-[46ch] text-lede text-stone">
            Each age has its own colour, fixed for good. Over time they become
            a visible record of growing up.
          </p>
        </div>

        {/* The shelf. Horizontal and allowed to run past the viewport on a
            phone, so the years are swiped through rather than shrunk. */}
        <div className="mt-20 overflow-x-auto pb-4">
          <div className="mx-auto flex w-max items-end gap-4 px-[5vw]">
            {shelf.isPhoto ? (
              <img src={shelf.src} alt={shelf.alt} className="h-[22rem] rounded-sm object-cover md:h-[30rem]" />
            ) : (
              ["01", "02", "03", "04", "05", "06", "07"].map((age, i) => (
                <img
                  key={age}
                  src={`/sample/age-${age}.png`}
                  alt=""
                  className="block w-[9rem] flex-none rounded-sm shadow-[0_18px_36px_-16px_rgba(37,35,31,0.45)] md:w-[13rem]"
                  style={{ transform: `translateY(${(i % 2) * 10}px)` }}
                />
              ))
            )}
          </div>
        </div>

        {/* Details, alternating. */}
        <div className="mx-auto mt-24 grid max-w-page gap-12 px-[5vw] md:grid-cols-2 md:gap-16">
          <figure>
            <img
              src={texture.src}
              alt={texture.alt}
              className="w-full rounded-sm object-cover shadow-[0_24px_50px_-24px_rgba(37,35,31,0.4)]"
            />
            <figcaption className="mt-5 text-stone">
              Designed to sit together for decades.
            </figcaption>
          </figure>
          <figure>
            <img
              src={spreadSrc(SPREADS[0].id)}
              alt={SPREADS[0].alt}
              className="w-full rounded-sm shadow-[0_24px_50px_-24px_rgba(37,35,31,0.4)]"
            />
            <figcaption className="mt-5 text-stone">{SPREADS[0].caption}</figcaption>
          </figure>
        </div>

        <div className="mx-auto mt-16 max-w-page px-[5vw]">
          <figure>
            <img
              src={spreadSrc(SPREADS[1].id)}
              alt={SPREADS[1].alt}
              className="w-full rounded-sm shadow-[0_30px_60px_-28px_rgba(37,35,31,0.42)]"
            />
            <figcaption className="mt-5 max-w-[52ch] text-stone">{SPREADS[1].caption}</figcaption>
          </figure>
          <p className="mt-10 max-w-[56ch] text-sm leading-relaxed text-stone">
            {SPREADS_DISCLOSURE}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════ 06 · the year builds itself
          The first appearance of the interface, deliberately late and
          deliberately calm. No charts, no dashboard — it should look like an
          archive, because that is what it is.

          The observations are real output from the product's own engine. */}
      <section className="bleed bg-paper py-24 md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <div className="grid gap-16 md:grid-cols-[44fr_56fr] md:gap-20">
            <div>
              <h2 className="max-w-[16ch] text-display font-display lowercase">
                no journal to keep up with.
              </h2>
              <p className="mt-8 max-w-[40ch] text-lede text-stone">
                Qotidia builds the story quietly through the year. Some weeks
                you add something every day. Some weeks you forget it exists.
                Both make a book.
              </p>
            </div>

            <div className="rounded-2xl border border-rule bg-white p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.28em] text-stone">
                One week, from one archive
              </p>
              <ul className="mt-8 space-y-7">
                {noticed.map((o) => (
                  <li key={o.entityId} className="border-t border-rule pt-5 first:border-0 first:pt-0">
                    <p className="font-display text-xl leading-snug md:text-2xl">{o.line}</p>
                    <p className="mt-2 text-sm text-stone">
                      counted from {o.memoryIds.length} memories
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-10 text-sm leading-relaxed text-stone">{NOTICING_CAPTION}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ 07 · not a photobook
          The most quotable section on the site, and the one that says what
          this is by saying what it is not. Clay ground, cream type. */}
      <section className="bleed bg-ochre py-24 text-paper md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <h2 className="max-w-[16ch] text-display font-display lowercase">
            not a photobook.
            <br />
            a portrait of a year.
          </h2>

          <div className="mt-20 grid gap-14 md:grid-cols-2 md:gap-20">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-paper/85">
                A photobook remembers
              </p>
              <ul className="mt-8 space-y-4 text-2xl">
                {A_PHOTOBOOK_KEEPS.map((line) => (
                  <li key={line} className="font-display text-paper/85">{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-paper/85">
                Qotidia also remembers
              </p>
              <ul className="mt-8 space-y-4 text-2xl">
                {QOTIDIA_ALSO_KEEPS.map((line) => (
                  <li key={line} className="font-display">{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-24 max-w-[34ch] text-title font-display lowercase">
            your camera roll remembers what they looked like. qotidia remembers
            the life around them.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ 08 · privacy
          Part of the emotional promise, not compliance content. */}
      <section className="bleed band-ink py-24 md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <div className="grid items-end gap-16 md:grid-cols-[54fr_46fr]">
            <div>
              <h2 className="max-w-[12ch] text-display font-display lowercase">
                their childhood
                <br />
                isn&rsquo;t content.
              </h2>
              <p className="mt-8 max-w-[44ch] text-lede text-paper/70">
                Qotidia is built as a private family archive — not a social
                network, not an advertising platform, and not a training set.
              </p>
            </div>
            {dark.isPhoto && (
              <img src={dark.src} alt={dark.alt} className="w-full rounded-sm object-cover" />
            )}
          </div>

          <div className="mt-20 grid gap-10 md:grid-cols-3 md:gap-14">
            {PILLARS.map(([title, body]) => (
              <div key={title} className="border-t border-paper/25 pt-6">
                <h3 className="font-display text-xl">{title}</h3>
                <p className="mt-3 leading-relaxed text-paper/60">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-16">
            <Link href="/privacy" className="text-paper/80 underline underline-offset-4 hover:text-white">
              Read our approach to privacy &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ 09 · the shelf
          The retention argument, made visually rather than explained. A row
          of years with a gap in it does the work of a paragraph about annual
          subscriptions. */}
      <section className="bleed bg-paper py-24 md:py-36">
        <div className="mx-auto max-w-page px-[5vw]">
          <div className="overflow-x-auto pb-6">
            <div className="flex w-max items-end gap-5">
              {SHELF_YEARS.map((year) => (
                <div key={year.word} className="flex items-end gap-5">
                  <figure className="flex-none">
                    <img
                      src={`/sample/age-0${year.age + 1}.png`}
                      alt=""
                      className="block w-[8rem] rounded-sm shadow-[0_16px_32px_-14px_rgba(37,35,31,0.45)] md:w-[11rem]"
                    />
                    <figcaption className="mt-4 text-sm lowercase text-stone">
                      florence &mdash; {year.word}
                    </figcaption>
                  </figure>
                  {/* The gap. Deliberately empty, and the whole argument. */}
                  {year.gapAfter && <div aria-hidden className="w-[8rem] flex-none md:w-[11rem]" />}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-16 max-w-[26ch] text-title font-display lowercase">
            one year becomes two. then somehow, a childhood.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ 10 · parent stories
          Renders nothing until real ones exist. Inventing a customer on a
          page that takes payment is a fabricated review, and this is the one
          company that cannot afford to make things up about families. */}
      {PARENT_STORIES.length > 0 && (
        <section className="bleed band-card py-24 md:py-36">
          <div className="mx-auto grid max-w-page gap-16 px-[5vw] md:grid-cols-2">
            {PARENT_STORIES.map((story) => (
              <figure key={story.attribution}>
                <img src={story.image} alt="" className="w-full rounded-sm object-cover" />
                <blockquote className="mt-8 text-title font-display leading-tight">
                  &ldquo;{story.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 text-stone">&mdash; {story.attribution}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════ 11 · questions */}
      <section className="bleed band-card py-24 md:py-32">
        <div className="mx-auto grid max-w-page gap-12 px-[5vw] md:grid-cols-[34fr_66fr] md:gap-20">
          <h2 className="max-w-[10ch] text-title font-display lowercase">
            questions worth asking
          </h2>
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

      {/* ══════════════════════════════════════════════════════ 12 · the close
          Almost no content. One book, one sentence, one button. */}
      <section className="bleed bg-paper py-28 text-center md:py-40">
        <div className="mx-auto max-w-page px-[5vw]">
          {hands.isPhoto && (
            <img
              src={hands.src}
              alt={hands.alt}
              className="mx-auto mb-20 w-full max-w-3xl rounded-sm object-cover shadow-[0_40px_80px_-32px_rgba(37,35,31,0.4)]"
            />
          )}
          <h2 className="mx-auto max-w-[12ch] text-display font-display lowercase">
            keep this year.
          </h2>
          <p className="mx-auto mt-8 max-w-[40ch] text-lede text-stone">
            Start now, add what you already have, and we&rsquo;ll take it from
            there.
          </p>
          <Link href="/signup?plan=monthly" className="btn mt-12 !px-9 !py-4 !text-base">
            Start keeping your year &rarr;
          </Link>
          <p className="mt-7 text-sm text-stone">
            {aud(PLAN_PRICES.monthlyAud())} a month, or {aud(PRICES.bookAud())} for
            the book on its own &middot; Private by default &middot; Cancel any
            time &middot; Your memories remain yours
          </p>
        </div>
      </section>

      <footer className="bleed bg-paper">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 border-t border-rule px-[5vw] py-12">
          <span className="font-display text-lg lowercase">{TAGLINE}</span>
          <nav className="flex gap-8 text-sm text-stone">
            <Link href="/tools" className="hover:text-ink">Free tools</Link>
            <Link href="/journal" className="hover:text-ink">Journal</Link>
            <Link href="/about" className="hover:text-ink">Who makes this</Link>
            <Link href="/pricing" className="hover:text-ink">{PRICING_LOWER}</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/promise" className="hover:text-ink">Promise</Link>
            <Link href="/help" className="hover:text-ink">Help</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
