/**
 * The front door.
 *
 * Everything on this page is a claim, so the constraint that shaped it is the
 * same one the renderer works under: nothing may say something the system does
 * not do. That rules out most of what a landing page normally leans on — no
 * logo wall, no counter, no testimonial, no pricing table for billing that is
 * not built, no "instantly", no "syncs".
 *
 * The page runs on cream with purple fields cut into it, and that is a decision
 * about the product rather than about taste: a site that is purple everywhere
 * makes every shop on it look like a popuup product, and the argument here is
 * that a generated shop looks like the *merchant*.
 *
 * Order is the conversion hierarchy, not a tour of the feature list. What is
 * this → why does the click deserve better → what does it produce → how little
 * work is it → where does it sit → what keeps it true → who else is it for →
 * how does it go → where is it really.
 *
 * The shops are real output. `pnpm press` screenshots them from the running
 * renderer into `public/press/`, so a change to the template shows up here
 * without anybody redrawing anything, and this page can never advertise a
 * design that no longer exists.
 *
 * It asks for an email by opening the visitor's own mail client rather than by
 * collecting an address. Email capture is Sprint 3 and gated on the kill test;
 * a form that posted nowhere would be the exact dishonesty the rest of the page
 * is written to avoid.
 */

import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
import { displayWonk } from "./fonts";
import { SiteBar, SiteFoot, ASK } from "./chrome";
import "./landing.css";

/**
 * The shop in the opening, and the sentence that produced it.
 *
 * Maison Verre rather than the children's shop that was here before. Both are
 * real output; this one is the one a merchant looks at and wants. The prompt is
 * the demo config's own, because a punchier sentence written for the page would
 * mean showing a prompt and a shop that never met.
 */
const LEAD = {
  /*
   * `hero.jpg` rather than `shop-luxe.jpg`.
   *
   * The old shot was framed on the top of the page, and for a luxe mood that
   * is a full-bleed tagline — so the advert for "we build you a shop" was a
   * dark slab with one line of type on it, and the products were below the
   * fold of the capture. `scripts/press/capture-edits.mjs` now frames the hero
   * on a product grid instead.
   *
   * It is `edit-wedding`, which came from the identical sentence to the one
   * printed in the box beside it. So the phone really is what that sentence
   * produced — which is what the paragraph above it claims, and was already
   * true of the old shot for the same reason.
   */
  shot: "/press/hero.jpg",
  mood: "luxe",
  prompt: "a wedding list for two people who already own everything",
  // What the merchandiser is actually working from. Chips rather than a
  // product count: a number on screen has to be true, and this catalogue's
  // size is not the point being made.
  reads: ["Wedding list", "Owns everything", "In stock"],
};

/**
 * Five edits, one catalogue.
 *
 * These are five real generations from a single ingest — same brand, same eight
 * products underneath, five sentences. Not five demo brands standing in for the
 * idea, which is what was here before and which proved something weaker: that
 * the template flexes across merchants, rather than that the merchandising
 * flexes across audiences.
 *
 * `lift` staggers them into a collage. Five phones at one height is a specimen
 * sheet; five at different heights is a page somebody laid out.
 */
const EDITS = [
  { slug: "edit-wedding", title: "The wedding list", prompt: "for two people who already own everything", n: 5, lift: 0 },
  { slug: "edit-first", title: "The first glass", prompt: "for someone moving into their own place, nothing over 60", n: 3, lift: 3 },
  { slug: "edit-bar", title: "The negroni kit", prompt: "for someone who has started making cocktails at home", n: 4, lift: 1 },
  { slug: "edit-gift", title: "The host gift", prompt: "for a host who has everything, under 80", n: 4, lift: 4 },
  { slug: "edit-sale", title: "End of season", prompt: "what is left, cheapest first", n: 5, lift: 2 },
];

/**
 * Counts for the prose, taken from the labels rather than typed again.
 *
 * The paragraph above the rail argues from these numbers — three pieces for a
 * first flat against five for a clearout is the comparison the section exists
 * to make — and they were typed by hand. A regeneration moved the clearout
 * from seven to five and the sentence went on saying seven, beside a label
 * that said five, above a screenshot that showed five.
 *
 * `tests/marketing.test.tsx` checks every label against its fixture, so
 * reading the prose off the same array means one check now covers both.
 */
const pieces = (slug: string): number => EDITS.find((edit) => edit.slug === slug)!.n;

const CHAIN = [
  { name: "The post", body: "A reel, a creator, a campaign. Somebody clicked for a specific reason." },
  { name: "The shop", body: "Your products, picked and ordered and written for that reason." },
  { name: "Your checkout", body: "Shopify takes the money. The customer is yours, exactly as before." },
];

/**
 * What a rebuild does about stock, in the words the rules actually use.
 *
 * The sold-out line is the one to guard. The rule demotes; it does not hide,
 * and it does not substitute — a chip promising a replacement product would
 * advertise the opposite of what `lib/smart/repair.ts` does.
 */
const RULES = [
  "What you can still sell comes first",
  "Products you’ve deleted drop off the page",
  "Sold-out ones stay, and say so",
  "If too much has changed, we ask before rebuilding",
];

const STEPS = [
  { n: "01", title: "Write a sentence", body: "Say what the link is for. “A wedding list for two people who already own everything.”" },
  { n: "02", title: "We build the shop", body: "We read your catalogue and pick the products that fit, then order and write them." },
  { n: "03", title: "Put the link in the post", body: "In a bio, an email, an ad, a creator’s story. Wherever the click starts." },
];

/**
 * The graphic family, drawn rather than imported. Two marks, used sparingly —
 * the same shape three times reads as a brand, eight different ones read as a
 * sticker sheet.
 */
function Burst({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 0l9 32 24-23-14 30 33-8-29 19 29 19-33-8 14 30-24-23-9 32-9-32-24 23 14-30-33 8 29-19-29-19 33 8-14-30 24 23z"
        fill="currentColor"
      />
    </svg>
  );
}

function Squiggle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 24" aria-hidden="true">
      <path d="M2 18c14-18 26 12 40-4S72 2 84 12s22 2 34-6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "popuup — every click deserves its own shop",
  description:
    "Write one sentence about the post you're linking from, and get a small shop built from your Shopify catalogue with just the products that match it. No page builder.",
  openGraph: {
    title: "popuup",
    description: "Every click deserves its own shop.",
    url: HOME,
    images: [{ url: "/press/og.jpg", width: 1200, height: 630 }],
  },
};

export default function Landing() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      {/* ------------------------------------------------------------ opening */}
      <section className="opening">
        <div className="opening-say">
          <p className="tag">
            <Burst className="tag-burst" />
            Merchandising for Shopify
          </p>

          <h1 className="shout">
            every click
            <br />
            deserves its
            <br />
            own <span className="shout-mark">shop.</span>
          </h1>

          {/*
            The example is the copy. It is not decoration around an
            explanation.

            This paragraph used to read "Tell popuup who is arriving", and the
            owner's reaction to it is the reason for this rewrite: *what does
            that actually mean?* It is a metaphor about guests at a house, and
            it has to be unpacked before it means anything. Worse, it is
            abstract in the one place that can least afford it — nobody types
            a *person* into the box. They type a sentence about a post they
            are linking from.

            So the mechanic is spelled out with a real one: the post, the
            sentence, the shop. A merchant should be able to substitute their
            own reel into it without being told how.
          */}
          <p className="lede">
            You post a reel about linen shirts. The link in your bio goes to a homepage with four hundred products on
            it.
          </p>
          {/*
            The last line points at the demo on purpose.

            An earlier draft put its own example here — a linen reel, nothing
            over 150 — while the box alongside showed a wedding list. Two
            different worked examples touching each other is its own kind of
            confusing, and it wasted the strongest thing on the page: that
            sentence is real, and the shop behind it is what the merchandiser
            actually returned for it.
          */}
          <p className="lede-sub">
            Write one sentence instead, and we&rsquo;ll build a small shop from your Shopify catalogue with just the
            products that fit — in an order that makes sense, with words that match the post. The sentence in the box
            is a real one, and the shop behind it is what came back.
          </p>

          <a className="btn btn-lg" href={ASK}>
            Get my shop made <span aria-hidden="true">→</span>
          </a>
          <p className="note">
            Works for a post, a creator, an email, an ad — anything you put a link in. Free while we&rsquo;re building
            these with a small group of Shopify brands.
          </p>
        </div>

        {/*
          The mechanic, as one object: the sentence, what it was read as, and
          the shop that came out. Overlapping rather than side by side, because
          side by side is three pictures and overlapping is a claim about cause.

          The field is a figure and not an input. There is nothing behind it
          yet, and a box that swallows a sentence and does nothing is a worse
          first impression than an honest picture of one.
        */}
        <div className="stage" aria-label="A sentence, and the shop it produced">
          <Burst className="stage-burst" />

          <span className="device device-lg" aria-hidden="true">
            {/*
              One capture, three times, each clipped to a band and arriving a
              beat apart, so products appear row by row and every pixel stays
              the real renderer's output. A hand-drawn shop animating into
              place would be a picture of something nothing produced.
            */}
            <span className="screen">
              {[0, 1, 2].map((band) => (
                <img key={band} className="screen-band" src={LEAD.shot} alt="" width={780} height={1690} />
              ))}

              {/* The middle of the mechanic, and the part a finished mockup
                  hides: the sentence being turned into constraints. */}
              <span className="think">
                <span className="think-lead">Reading your catalogue</span>
                <span className="think-chips">
                  {LEAD.reads.map((chip) => (
                    <i key={chip}>{chip}</i>
                  ))}
                </span>
              </span>
            </span>
          </span>

          <figure className="prompt">
            <figcaption>Make a shop in a sentence</figcaption>
            <p>
              {LEAD.prompt.split(" ").map((word, index) => (
                // The space is a text node between the spans, not inside them:
                // a trailing space inside an inline-block is collapsed away,
                // and the sentence renders as onelongword.
                <span key={word + index}>
                  <span className="typed" style={{ "--w": index } as React.CSSProperties}>
                    {word}
                  </span>{" "}
                </span>
              ))}
              <span className="caret" aria-hidden="true" />
            </p>
            <span className="prompt-go" aria-hidden="true">
              Make it pop <Burst className="prompt-burst" />
            </span>
          </figure>
        </div>
      </section>

      {/* Why the click deserved better. Deliberately three lines — the visitor
          already felt this, and explaining it at length insults them. */}
      <section className="band why">
        <p className="why-line">
          Someone who just watched your linen reel and someone hunting for a Christmas gift aren&rsquo;t the same
          shopper. Right now they both land on the same page.
          <Squiggle className="why-squiggle" />
        </p>
      </section>

      {/* -------------------------------------------------------------- proof */}
      {/*
        The claim the whole product rests on, and the reason the shops on it
        share a colourway.

        A version of this section with five differently-coloured phones would be
        a better poster and a worse promise: five accents off one catalogue means
        popuup rewriting a merchant's brand per audience, which is the exact
        failure the colour rule exists to prevent. What changes here is what is
        in the shops and how they are built. What does not change is whose shop
        it looks like.
      */}
      <section className="band band-ink proof" aria-labelledby="proof-heading">
        <div className="proof-say">
          <h2 id="proof-heading" className="lead">
            One catalogue.
            <br />
            Five shops.
          </h2>
          <p className="lead-note">
            All five of these shops sell the same eight products. One sentence each, and they come out completely
            different: {pieces("edit-first")} pieces for someone furnishing a first flat,{" "}
            {pieces("edit-sale")} for an end-of-season clearout, and a wedding list that opens with the thing nobody
            buys for themselves.
          </p>
          <p className="rail-note">
            The colours and lettering never change, because it&rsquo;s still one brand and it isn&rsquo;t ours to
            repaint. This is a made-up shop rather than a real merchant&rsquo;s, so we&rsquo;re not borrowing anyone&rsquo;s
            products to sell you something — but the shops themselves are real, built by the same code yours would be.
          </p>
        </div>

        {/*
          Five across, staggered.

          An earlier cut pulled one out as a large lead beside the copy, and it
          cost more than it bought: the lead overlapped the row, clipping the
          fifth shop mid-caption, and it showed the same shop twice. The
          comparison *is* the content here — five at once is the argument, and
          one big one with four thumbnails is a different, weaker claim.

          On a phone it scrolls, one shop at a time.
        */}
        <ul className="rail">
          {EDITS.map((edit) => (
            <li key={edit.slug} style={{ "--lift": edit.lift } as React.CSSProperties}>
              <figure>
                <span className="device">
                  <img src={`/press/${edit.slug}.jpg`} alt={`${edit.title}, generated by popuup`} width={780} height={1690} loading="lazy" />
                </span>
                <figcaption>
                  <span className="rail-brand">
                    {edit.title} <em>{edit.n} pieces</em>
                  </span>
                  <q>{edit.prompt}</q>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {/* The one claim the two products a merchant will compare us against
          structurally cannot make. */}
      <section className="band band-purple negations" aria-labelledby="negations-heading">
        <h2 id="negations-heading" className="shout negations-heading">
          there is no
          <br />
          page builder.
        </h2>
        <ul className="pills">
          <li>No blocks to drag</li>
          <li>No template to pick</li>
          <li>No theme to configure</li>
          <li>No afternoon lost</li>
        </ul>
        <p className="negations-note">
          A campaign shouldn&rsquo;t cost you an afternoon of dragging blocks around. Write the sentence, get the
          shop. That&rsquo;s the whole job.
        </p>
      </section>

      {/* Positioning as a place rather than an adjective. A layer means nothing
          without something named on each side — including the side we do not
          want, which is the checkout. */}
      <section className="band chain-band" aria-labelledby="chain-heading">
        <h2 id="chain-heading" className="lead">
          Between the tap
          <br />
          and the checkout
        </h2>
        <p className="lead-note">Everything popuup does happens in that gap.</p>
        <ol className="chain">
          {CHAIN.map((link, index) => (
            <li key={link.name} data-ours={index === 1 ? "" : undefined}>
              <span className="chain-name">{link.name}</span>
              <p>{link.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/*
        Refresh, described in the tense it actually happens in.

        The tempting line is "set it once and it stays true", and it is one word
        away from claiming a connection that does not exist. A shop re-orders
        itself when the catalogue is read again, and reading it again is
        something a person starts. So the copy says that, and the demonstration
        below shows demotion rather than substitution — because the rules never
        add a product, and a picture of one being swapped in would advertise the
        opposite of what the code does.
      */}
      <section className="band band-purple keep" aria-labelledby="keep-heading">
        <div className="keep-say">
          <h2 id="keep-heading" className="shout keep-heading">
            not pages.
            <br />
            shops that keep up.
          </h2>
          <p className="keep-note">
            A page you built in March is still selling March. Read your catalogue again and the shop reorders itself
            around what you can actually still sell. The rules are fixed and written down — it&rsquo;s not a model&rsquo;s
            opinion on the day.
          </p>
        </div>

        <div className="swap" aria-label="What a rebuild does when a product sells out">
          {/* No prices on these cards. The contrast being drawn is
              availability, and a number here would be a price on a page that
              sells nothing — which the honesty tests refuse, correctly. */}
          <div className="swap-row">
            <span className="swap-when">Before</span>
            <span className="swap-card is-out">
              Wrap Coat <em>Sold out</em>
            </span>
            <span className="swap-card">
              Linen Dress <em>In stock</em>
            </span>
          </div>
          <div className="swap-row">
            <span className="swap-when">Rebuilt</span>
            <span className="swap-card">
              Linen Dress <em>In stock</em>
            </span>
            <span className="swap-card is-out">
              Wrap Coat <em>Sold out</em>
            </span>
            {/*
              The one acid mark on the site, and it is doing work rather than
              decorating: this row is the whole claim of the section and the
              easiest thing on the page to skim past.

              "Demoted, still there" rather than the "Removed ✓" a mockup would
              put here. `lib/smart/repair.ts` has exactly two moves — drop what
              is gone, demote what is sold out — and the product rule is that a
              sold-out item is shown and marked, never hidden. A sticker
              claiming removal would advertise the opposite of the code.
            */}
            <span className="swap-mark">Moved down, not hidden</span>
          </div>
          <ul className="rules">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------- creators and steps */}
      <section className="band creators" aria-labelledby="creators-heading">
        <div>
          <h2 id="creators-heading" className="lead">
            Give every creator
            <br />
            their <span className="lead-coral">own shop.</span>
          </h2>
          <p className="lead-note">
            Their picks and their name, on their own link — running on your catalogue and your checkout.
          </p>
          <ul className="ticks">
            <li>Their audience</li>
            <li>Your products</li>
            <li>Their own link</li>
          </ul>
        </div>
        {/* The credit reproduced as markup rather than screenshotted, so it
            cannot drift from what a shop actually renders. */}
        <figure className="credit-sample">
          <span className="credit-brand">Maison Verre</span>
          <p className="credit-line">Chosen by Ana Ruiz</p>
          <figcaption>The credit a creator&rsquo;s shop carries, under the brand.</figcaption>
        </figure>
      </section>

      <section className="band steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="lead">
          How it goes
        </h2>
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="steps-end">
          That is it.
          <Squiggle className="steps-squiggle" />
        </p>
      </section>

      {/*
        The part a launch page usually leaves out, kept candid rather than
        apologetic. Saying the stage out loud costs nothing with the people
        worth having early, and saves the conversation where somebody arrives
        expecting a product.
      */}
      <section className="band band-lilac early" aria-labelledby="early-heading">
        <div>
          <h2 id="early-heading" className="lead">
            Where this is
          </h2>
          <p className="lead-note">
            Early, on purpose. We&rsquo;re building shops with a handful of Shopify brands to find out whether they&rsquo;re
            genuinely useful before we build the rest.
          </p>
        </div>
        <ul className="ledger">
          <li data-on="">Real shops, from your real catalogue</li>
          <li data-on="">Your Shopify checkout, untouched</li>
          <li data-on="">Creator credit and rebuilds</li>
          <li>Onboarding is by hand, one at a time</li>
          <li>No accounts and no billing yet</li>
          <li>Nothing syncs with your store on its own</li>
        </ul>
        <p className="ledger-note">
          Free shops carry a small &ldquo;Made with popuup&rdquo; credit at the foot, in your own colours. Paid plans
          will remove it.
        </p>
      </section>

      <section className="band band-purple closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="shout closing-heading">
          your next post
          <br />
          deserves its own shop.
        </h2>
        <a className="btn btn-lg btn-coral" href={ASK}>
          Get my shop made <span aria-hidden="true">→</span>
        </a>

        <SiteFoot />
      </section>
    </main>
  );
}
