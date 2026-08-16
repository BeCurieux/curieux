/**
 * The front door.
 *
 * Everything on this page is a claim, so the constraint that shaped it is the
 * same one the renderer works under: nothing may say something the system does
 * not do. That rules out most of what a landing page normally leans on — no
 * logo wall, no counter, no testimonial, no pricing table for billing that is
 * not built, no "instantly", no "syncs". What is left is the thing itself,
 * which turns out to be enough.
 *
 * The redesign moved the page off a violet ground onto cream, and that is not a
 * colour preference. A site that is purple everywhere makes every shop on it
 * look like a popuup product; a cream page with purple *fields* lets the shops
 * be the colourful things on it, which is the argument the page is making. The
 * merchant's shop should never look like ours.
 *
 * The shops are real output. `pnpm press` screenshots them from the running
 * renderer into `public/press/`, so a change to the template shows up here
 * without anybody redrawing anything, and this page can never advertise a
 * design that no longer exists.
 *
 * The one thing it asks for is an email, and it asks by opening the visitor's
 * own mail client rather than by collecting an address. Email capture is
 * Sprint 3 and gated on the kill test; a form that posted nowhere would be the
 * exact dishonesty the rest of the page is written to avoid.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "./fonts";
import "./landing.css";

const ASK = `mailto:${INBOX}?subject=${encodeURIComponent("Make me a shop")}&body=${encodeURIComponent(
  "My store:\n\nWho the shop is for:\n\n",
)}`;

/**
 * The five demo shops, and the sentence each one came from.
 *
 * These prompts are the ones in the demo configs, not copy written to sit
 * under a screenshot. If they drift apart, the page is lying about what
 * produced the picture.
 *
 * `lift` staggers them into a collage rather than a row. Five phones at one
 * height is a specimen sheet; five at different heights is a page somebody
 * laid out, and the difference costs one number each.
 */
const SHOPS = [
  { mood: "utility", brand: "Bench & Bolt", prompt: "the starter kit for someone setting up their first workshop", lift: 0 },
  { mood: "clean", brand: "Sea Salt Skin", prompt: "a first routine for someone who has never used skincare", lift: 3 },
  { mood: "playful", brand: "Pip & Pockets", prompt: "a gift edit for a two-year-old who ruins everything", lift: 0 },
  { mood: "editorial", brand: "Folio Press", prompt: "a desk set for someone who has started writing by hand again", lift: 4 },
  { mood: "luxe", brand: "Maison Verre", prompt: "a wedding list for two people who already own everything", lift: 1 },
];

/**
 * The three links in the chain, which is the whole positioning.
 *
 * popuup is not the destination and not the till. It is the merchandising step
 * between the two, and saying so is more useful than any adjective: it tells a
 * merchant what it replaces (one link, one page, everybody) and what it leaves
 * alone (their checkout, their customer, their money).
 */
const CHAIN = [
  {
    name: "Attention",
    body: "A post, a story, a reply, a creator sending their people your way. Each one is a different room full of different people.",
  },
  {
    name: "popuup",
    body: "Your catalogue, selected and ordered and written for that audience. A shop per click, not a shop per brand.",
  },
  {
    name: "Your checkout",
    body: "A Shopify cart, pre-filled, on your own domain. We never touch the money and never own the customer.",
  },
];

/**
 * What a rebuild does about stock, in the words the rules actually use.
 *
 * Each of these is a real branch in `lib/smart`, which is why the wording is
 * careful about the sold-out one: the rule demotes, it does not hide, and a
 * pill saying "removes sold-out products" would be advertising the opposite of
 * what the code does.
 */
const RULES = [
  { mark: "↑", body: "What you can still sell comes first" },
  { mark: "×", body: "Anything delisted leaves the page" },
  { mark: "◦", body: "Sold out stays, and says so" },
  { mark: "→", body: "Too much moved? It asks to be remade" },
];

/**
 * The sentence the opening types out, as words.
 *
 * It is one of the five demo prompts verbatim — the one that produced the shop
 * shown next to it. Writing a punchier sentence here would mean the page shows
 * a prompt and a shop that never met.
 */
const PROMPT = "a gift edit for a two-year-old who ruins everything".split(" ");

const STEPS = [
  {
    n: "01",
    title: "Say who is coming",
    body: "Not what page to build. One sentence about the person you are making it for — a first-time buyer, a gift-hunter, somebody who already owns everything.",
  },
  {
    n: "02",
    title: "We read your catalogue",
    body: "Your public product feed: what you sell, what it costs, what is in stock, what it looks like. Nothing is invented and nothing is edited.",
  },
  {
    n: "03",
    title: "You get a shop",
    body: "Merchandised around that one sentence. A link for a bio, a story, or a creator you work with — as many as the moments you have.",
  },
];

/**
 * The graphic family, drawn rather than imported.
 *
 * Four marks, reused. Kept sparse on purpose: the same shape three times reads
 * as a brand, and eight different ones read as a sticker sheet.
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
      <path
        d="M2 18c14-18 26 12 40-4S72 2 84 12s22 2 34-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "popuup — every click deserves its own shop",
  description:
    "The merchandising layer between social attention and your checkout. Describe who is coming; popuup selects from your catalogue, merchandises it and designs the page. No page builder.",
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
      <header className="bar">
        <img className="bar-mark" src="/brand/popuup.svg" alt="popuup" width={180} height={62} />
        {/* One link, and it is the same one the opening uses. A nav bar with
            Product / Pricing / Log in would be four promises we cannot keep. */}
        <a className="btn btn-sm" href={ASK}>
          Make me a shop <span aria-hidden="true">→</span>
        </a>
      </header>

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

          <p className="lede">
            One link in a bio sends every audience to the same page. popuup reads what you already sell and
            merchandises it for whoever that click was — then hands them to your checkout.
          </p>

          <a className="btn btn-lg" href={ASK}>
            Get your shop made <span aria-hidden="true">→</span>
          </a>
          <p className="note">Made by hand, one at a time, while we find out whether it is any good. No account, no card.</p>
        </div>

        {/*
          The demonstration, as one object: the sentence somebody typed, and
          the shop it produced, overlapping.

          The field is a figure and not an input. There is nothing behind it
          yet, and a box that swallows a sentence and does nothing is a worse
          first impression than an honest picture of one.

          It plays once on load and holds. The whole markup is meaningful with
          no animation at all — the words are words, the phone holds the same
          screenshot it always did — so `prefers-reduced-motion` is served by
          switching the timeline off rather than by building a second version.
        */}
        <div className="stage" aria-label="An example prompt, and the shop it produced">
          <Burst className="stage-burst" />

          <span className="device device-lg" aria-hidden="true">
            {/*
              One capture, three times, each clipped to a band and arriving a
              beat apart. Products appear to land row by row and every pixel of
              it is the real renderer's output — which a hand-drawn shop
              animating into place would not be, and this page has no business
              showing a shop that nothing produced.
            */}
            <span className="screen">
              {[0, 1, 2].map((band) => (
                <img
                  key={band}
                  className="screen-band"
                  src="/press/shop-playful.jpg"
                  alt=""
                  width={780}
                  height={1690}
                />
              ))}

              {/* The beat between asking and having, on the screen that is
                  doing the thinking. Inside the phone rather than beside it so
                  it lands in the same place at every width — beside it, it sat
                  on top of the button at desktop. */}
              <span className="think">
                reading your catalogue
                <i />
                <i />
                <i />
              </span>
            </span>
          </span>

          <figure className="prompt">
            <figcaption>What is this shop for?</figcaption>
            <p>
              {/*
                Word by word rather than character by character. A character
                reveal needs the line's exact width to animate against, which
                is a number that changes with the viewport and breaks quietly
                when the text rewraps; a word is its own box at any width.
              */}
              {PROMPT.map((word, index) => (
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

      {/*
        Second, and it is the one claim on this page that the two products a
        merchant will compare us against structurally cannot make.
      */}
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
        </ul>
        <p className="negations-note">
          Every one of those asks you to be a designer for an afternoon. The prompt is the builder: you know who is
          coming, and that is the only thing you should have to say.
        </p>
      </section>

      {/*
        The positioning, stated as a place rather than as an adjective.
        "Merchandising layer" means nothing on its own; a layer is only
        meaningful with something on each side of it, so both sides are named
        — including the one we do not want, which is the checkout.
      */}
      <section className="band chain-band" aria-labelledby="chain-heading">
        <h2 id="chain-heading" className="lead">
          Between the tap
          <br />
          and the checkout
          <Squiggle className="lead-squiggle" />
        </h2>
        <p className="lead-note">
          Attention was never the hard part. It arrives somewhere specific — off one post, one creator, one
          conversation — and lands on a link that treats all of it as the same person. That gap is the whole job.
        </p>
        <ol className="chain">
          {CHAIN.map((link, index) => (
            <li key={link.name} data-ours={index === 1 ? "" : undefined}>
              <span className="chain-name">{link.name}</span>
              <p>{link.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="band band-ink proof" aria-labelledby="proof-heading">
        <h2 id="proof-heading" className="lead">
          Five sentences.
          <br />
          Five shops.
        </h2>

        {/* Horizontal on a phone rather than a five-high stack: the comparison
            is the content, and it does not survive being read one at a time. */}
        <ul className="rail">
          {SHOPS.map((shop) => (
            <li key={shop.mood} style={{ "--lift": shop.lift } as React.CSSProperties}>
              <figure>
                <span className="device">
                  <img
                    src={`/press/shop-${shop.mood}.jpg`}
                    alt={`${shop.brand}, a shop generated by popuup`}
                    width={780}
                    height={1690}
                    loading="lazy"
                  />
                </span>
                <figcaption>
                  <span className="rail-brand">{shop.brand}</span>
                  <q>{shop.prompt}</q>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <p className="rail-note">
          Demo stores, so nobody&rsquo;s products are borrowed to sell something. The pages are the real renderer.
        </p>
      </section>

      {/*
        Refresh, described in the tense it actually happens in.

        The tempting line here is "set it once and it stays true", and it is
        one word away from claiming a connection that does not exist. A shop
        re-orders itself when the catalogue is read again, and reading it again
        is something a person starts. So the copy says that.
      */}
      <section className="band band-purple keep" aria-labelledby="keep-heading">
        <h2 id="keep-heading" className="shout keep-heading">
          not pages.
          <br />
          shops that keep up.
        </h2>
        <p className="keep-note">
          A page you built in March is still selling March. When we read your catalogue again, the shop re-orders
          itself around what you can still sell — by rules you can read, not a model&rsquo;s opinion on the day.
        </p>
        <ul className="rules">
          {RULES.map((rule) => (
            <li key={rule.body}>
              <span aria-hidden="true">{rule.mark}</span>
              {rule.body}
            </li>
          ))}
        </ul>
      </section>

      {/*
        Creator shops. The credit is shown the way the badge already is: the
        real markup, in the page, rather than a screenshot of it — so it cannot
        drift from what a shop actually renders.
      */}
      <section className="band creators" aria-labelledby="creators-heading">
        <div>
          <h2 id="creators-heading" className="lead">
            Give every creator
            <br />
            their <span className="lead-coral">own shop.</span>
          </h2>
          <p className="lead-note">
            Same catalogue, same checkout, their audience. It carries their name at the top and lives at its own
            address, so what it sells is theirs and not guesswork.
          </p>
          <ul className="ticks">
            <li>Their people</li>
            <li>Your products</li>
            <li>Their own link</li>
          </ul>
        </div>
        <figure className="credit-sample">
          <span className="credit-brand">Kelp &amp; Cotton</span>
          <p className="credit-line">Chosen by Ana Ruiz</p>
          <figcaption>
            What a creator&rsquo;s shop carries, under the brand. It says who picked these and nothing else — not
            &ldquo;partner&rdquo;, not &ldquo;exclusive&rdquo;. We know a name was given to us; we do not know the deal
            behind it.
          </figcaption>
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

      <section className="band band-lilac badge-note" aria-labelledby="badge-heading">
        <div>
          <h2 id="badge-heading" className="lead">
            Free shops carry this
          </h2>
          <p className="lead-note">
            One line at the foot of the page, set in your own colours. It is how the next merchant finds us, and it is
            the whole reason this can be free.
          </p>
        </div>
        <p className="badge-sample">
          <span>Made with</span>
          <img src="/brand/popuup.svg" alt="popuup" width={126} height={44} />
        </p>
      </section>

      {/*
        The part a launch page usually leaves out. Saying where this actually
        is costs nothing with the people worth having early, and saves the
        conversation where somebody signs up expecting a product.
      */}
      <section className="band band-purple closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="shout closing-heading">
          your next post
          <br />
          deserves its own shop.
        </h2>
        <a className="btn btn-lg btn-coral" href={ASK}>
          Get yours made <span aria-hidden="true">→</span>
        </a>

        <div className="status">
          <h3>Where this is</h3>
          <p>
            Early. The shops are real and the renderer is real; there is no sign-up, no dashboard and no billing.
            Nothing here syncs with your store on its own — we re-read your catalogue when we rebuild a shop, and every
            page prints the date it was read.
          </p>
          <p>
            We are making them by hand for a small number of merchants and the creators they work with, to find out
            whether anybody wants theirs live. If that is you, write to us.
          </p>
        </div>

        <footer className="foot">
          <img className="bar-mark" src="/brand/popuup-light.svg" alt="popuup" width={132} height={45} />
          <span className="foot-line">Make a shop in a sentence.</span>
          <a href={`mailto:${INBOX}`}>{INBOX}</a>
        </footer>
      </section>
    </main>
  );
}
