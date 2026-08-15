/**
 * The front door.
 *
 * Everything on this page is a claim, so the constraint that shaped it is the
 * same one the renderer works under: nothing may say something the system does
 * not do. That rules out most of what a landing page normally leans on — no
 * logo wall, no counter, no testimonial, no pricing table for billing that is
 * not built, no "instantly", no "syncs". What is left is the thing itself,
 * which turns out to be enough: a sentence, and five shops that came out of
 * five sentences.
 *
 * The shops on it are real output. `pnpm press` screenshots them from the
 * running renderer and writes them into `public/press/`, so a change to the
 * template shows up here without anybody redrawing anything, and this page can
 * never advertise a design that no longer exists.
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



/*
 * The home and the inbox both come from `lib/origin`, where the badge reads
 * them too, so the landing page and every published shop cannot end up
 * pointing at different domains.
 *
 * The inbox has to exist before this page is pointed at a domain — an
 * unreachable mailto is worse than no button, because it fails silently and
 * looks like indifference.
 */

const ASK = `mailto:${INBOX}?subject=${encodeURIComponent("Make me a shop")}&body=${encodeURIComponent(
  "My store:\n\nWho the shop is for:\n\n",
)}`;

/**
 * The five demo shops, and the sentence each one came from.
 *
 * These prompts are the ones in the demo configs, not copy written to sit
 * under a screenshot. If they drift apart, the page is lying about what
 * produced the picture.
 */
const SHOPS = [
  { mood: "utility", brand: "Bench & Bolt", prompt: "the starter kit for someone setting up their first workshop" },
  { mood: "clean", brand: "Sea Salt Skin", prompt: "a first routine for someone who has never used skincare" },
  { mood: "playful", brand: "Pip & Pockets", prompt: "a gift edit for a two-year-old who ruins everything" },
  { mood: "editorial", brand: "Folio Press", prompt: "a desk set for someone who has started writing by hand again" },
  { mood: "luxe", brand: "Maison Verre", prompt: "a wedding list for two people who already own everything" },
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
    body: "Merchandised around that one sentence. A link for a bio, a story, or a creator you work with — as many as the moments you have. Checkout is still yours.",
  },
];

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
      <header className="landing-bar">
        <img className="landing-mark" src="/brand/popuup-light.svg" alt="popuup" width={180} height={62} />
      </header>

      <section className="hero">
        {/* The copy is wrapped rather than laid out as grid children directly:
            with the device spanning every row, the browser distributed its
            height across those rows and opened a hole between the headline and
            the sentence under it. */}
        <div className="hero-copy">
          <h1 className="shout">
            every click
            <br />
            deserves its
            <br />
            own shop.
          </h1>

          <p className="hero-lede">
            One link in a bio sends every audience to the same page. popuup reads what you already sell and
            merchandises it for whoever that click was — then hands them to your checkout.
          </p>

        {/*
          The prompt field, shown rather than described. It is not an input:
          there is nothing behind it yet, and a box that swallows a sentence
          and does nothing is a worse first impression than an honest picture
          of one.
        */}
          <figure className="typed" aria-label="An example prompt">
            <span className="typed-label">Make me a shop for</span>
            <p className="typed-line">
              a gift edit for a two-year-old who ruins everything
              <span className="caret" aria-hidden="true" />
            </p>
          </figure>

          <a className="cta" href={ASK}>
            Get your shop made
            <span aria-hidden="true">→</span>
          </a>
          <p className="cta-note">
            Made by hand, one at a time, while we find out whether it is any good. No account, no card.
          </p>
        </div>

        {/*
          The shop that sentence produced, beside the sentence. It only appears
          where there is room for it — on a phone the rail below is two
          scrolls away and showing the same device twice is just weight.
        */}
        <span className="hero-device" aria-hidden="true">
          <span className="device">
            <img src="/press/shop-playful.jpg" alt="" width={780} height={1690} />
          </span>
        </span>
      </section>

      {/*
        The positioning, stated as a place rather than as an adjective.
        "Merchandising layer" means nothing on its own; a layer is only
        meaningful with something on each side of it, so both sides are named
        — including the one we do not want, which is the checkout.
      */}
      <section className="layer" aria-labelledby="layer-heading">
        <h2 id="layer-heading" className="section-lead">
          Between the tap and the checkout
        </h2>
        <p className="layer-lede">
          Attention was never the hard part. It arrives somewhere specific — off one post, one creator, one
          conversation — and lands on a link that treats all of it as the same person. That gap is the whole job.
        </p>
        <ol className="chain">
          {CHAIN.map((link) => (
            <li key={link.name}>
              <span className="chain-name">{link.name}</span>
              <p>{link.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="proof" aria-labelledby="proof-heading">
        <h2 id="proof-heading" className="section-lead">
          Five sentences. Five shops.
        </h2>

        {/* Horizontal on a phone rather than a five-high stack: the comparison
            is the content, and it does not survive being read one at a time. */}
        <ul className="rail">
          {SHOPS.map((shop) => (
            <li key={shop.mood}>
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

      <section className="negations" aria-labelledby="negations-heading">
        <h2 id="negations-heading" className="shout negations-heading">
          there is no
          <br />
          page builder.
        </h2>
        <ul>
          <li>No blocks to drag.</li>
          <li>No template to pick.</li>
          <li>No theme to configure.</li>
        </ul>
        <p>
          Every one of those asks you to be a designer for an afternoon. The prompt is the builder: you know who is
          coming, and that is the only thing you should have to say.
        </p>
      </section>

      <section className="steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="section-lead">
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
      </section>

      <section className="badge-note" aria-labelledby="badge-heading">
        <div>
          <h2 id="badge-heading" className="section-lead">
            Free shops carry this
          </h2>
          <p>
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
      <section className="status" aria-labelledby="status-heading">
        <h2 id="status-heading">Where this is</h2>
        <p>
          Early. The shops are real and the renderer is real; there is no sign-up, no dashboard and no billing.
          Nothing here syncs with your store on its own — we re-read your catalogue when we rebuild a shop, and every
          page prints the date it was read.
        </p>
        <p>
          We are making them by hand for a small number of merchants and the creators they work with, to find out
          whether anybody wants theirs live. If that is you, write to us.
        </p>
      </section>

      <footer className="landing-foot">
        <img className="landing-mark" src="/brand/popuup-light.svg" alt="popuup" width={132} height={45} />
        <a href={`mailto:${INBOX}`}>{INBOX}</a>
      </footer>
    </main>
  );
}
