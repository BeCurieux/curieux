/**
 * Why this exists.
 *
 * An about page is where a launch site normally puts the things it cannot
 * prove: a founding story, a team wall, a mission, a number of people served.
 * popuup has none of those to show, and the rest of the site is built on not
 * claiming what it hasn't got — so this page is the argument instead.
 *
 * Three things worth a page, in the order somebody deciding whether to trust us
 * would want them:
 *
 *   1. What we think is wrong. A homepage is a bad landing page for a post,
 *      and every merchant already knows it — they just can't build one per
 *      campaign by hand.
 *   2. How the thing actually works, stated as the one architectural rule.
 *      "The AI fills a schema, it never writes markup" is the reason these
 *      shops look designed rather than generated, and it is the single most
 *      useful thing a sceptical reader can be told.
 *   3. What we refuse to build. This is the spine. A list of refusals is worth
 *      more than a list of features on a product this early, because features
 *      can be added next week and refusals are a description of judgement.
 *
 * **The gap, stated rather than filled.** There is no founder, location,
 * headcount or founding date on this page, because nobody has told me any of
 * them and inventing one would be the exact failure the page is arguing
 * against. The slot for it is marked below.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot, ASK } from "../chrome";
import "../landing.css";
import "./about.css";

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "About — popuup",
  description:
    "Why popuup exists, how it works, and the things it refuses to build. A homepage is the wrong place to land a post.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About — popuup", url: `${HOME}/about` },
};

/**
 * The refusals, and the reason for each.
 *
 * Every one of these is enforced somewhere in the codebase rather than being a
 * statement of intent — which is what makes them worth printing. The order is
 * hardest-to-give-up first: the page builder is the thing most competitors sell
 * and the thing we would be most tempted to add.
 */
const REFUSALS = [
  {
    title: "No page builder",
    body: "No blocks, no templates to pick, no theme editor. If you can describe who a shop is for, that is the whole interface. Adding a builder would make this a worse version of software you already own.",
  },
  {
    title: "No checkout of our own",
    body: "The cart is a Shopify permalink, pre-filled. The money never passes through us, which is also why we could not take a cut of it if we wanted to. Your customer stays yours.",
  },
  {
    title: "Nothing collected from your shoppers",
    body: "A generated shop has no form in it and cannot grow one. Somebody handing an address to a shop is consenting to something specific, and it needs a lawful basis, a double opt-in and an unsubscribe — none of which we have built, so we do not ask.",
  },
  {
    title: "No invented products, prices or reviews",
    body: "Everything on a shop comes from your catalogue. Where a fact is missing the page shows nothing rather than something plausible. If reviews cannot be read from your store, the reviews section does not appear.",
  },
  {
    title: "Nothing learned from your customers",
    body: "A shop is rebuilt against your catalogue — what is in stock, what is gone — and never against what anybody clicked. There is no model quietly trained on your shoppers, because there is no model quietly trained on anything.",
  },
];

/** What a shop is built from, and what it is not. */
const SOURCES = [
  { on: true, text: "Your public product feed — titles, prices, stock, imagery" },
  { on: true, text: "Your homepage, for colours, type and the way you write" },
  { on: true, text: "One sentence from you about who the shop is for" },
  { on: false, text: "Nothing from your orders, your customers or your admin" },
  { on: false, text: "Nothing syncs on its own — a shop changes when somebody asks it to" },
  { on: false, text: "No account, no install, no permissions to grant" },
];

export default function About() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening about-top">
        <p className="tag">About popuup</p>
        <h1 className="shout about-heading">
          A homepage is the <span className="shout-mark">wrong place to land.</span>
        </h1>
        <p className="lede">
          Everybody who has ever put a link in a bio knows this. Almost nobody can do anything about it.
        </p>
      </section>

      {/* ------------------------------------------------------ the argument */}
      <section className="band" aria-labelledby="why-heading">
        <div className="about-two">
          <h2 id="why-heading" className="lead">
            What&rsquo;s actually wrong
          </h2>
          <div className="about-prose">
            <p>
              You post a reel about linen shirts. Somebody watches all of it, taps the link, and arrives at four hundred
              products and a cookie banner. They came for one thing and they have to go and find it. Most of them
              don&rsquo;t.
            </p>
            <p>
              The fix has been known for twenty years: send the click to a page built for the click. Every serious
              advertiser does it. What they have that a small brand doesn&rsquo;t is somebody whose job it is to build
              those pages — and even they build one per campaign, not one per post, because it costs an afternoon each.
            </p>
            <p>
              So the interesting problem was never &ldquo;how do we make a landing page&rdquo;. It was: what would have
              to be true for a brand to have one per post, per creator, per week, without anybody sitting down to build
              them?
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- the method */}
      <section className="band band-paper" aria-labelledby="rule-heading">
        <div className="band-top">
          <h2 id="rule-heading" className="lead">
            How it works, in one rule
          </h2>
        </div>

        <figure className="creed">
          <blockquote>
            The AI fills a schema.
            <br />
            It <em>never</em> writes markup.
          </blockquote>
        </figure>

        <div className="about-two about-two-tight">
          <div className="about-prose">
            <p>
              This is the whole architecture and it is the reason these shops don&rsquo;t look like they came out of a
              machine. The model reads your catalogue and your sentence and makes the decisions a merchandiser would
              make — which products, in what order, grouped how, described with which words, in which of your own
              brand&rsquo;s colours. It returns those decisions as structured data, and nothing else.
            </p>
            <p>
              The page itself comes from one hand-built template that has been designed properly, once, by people
              looking at it. Every response is checked against the schema before anything is rendered; if it comes back
              wrong it is rejected and asked again, never shown.
            </p>
          </div>
          <div className="about-prose">
            <p>
              The practical consequence is the bit worth caring about: the design quality of your shop does not depend
              on what the model felt like producing that day. It cannot invent a layout, cannot write its own CSS,
              cannot decide your brand is purple now. It gets to choose <em>what goes in the shop</em>. It does not get
              to choose what a shop looks like.
            </p>
            <p>
              It also means the template gets better for everybody at once. A change to how a product card handles a
              badly-lit photograph improves every shop already published, without regenerating any of them.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ the refusals */}
      <section className="band band-purple" aria-labelledby="refuse-heading">
        <div className="band-top">
          <h2 id="refuse-heading" className="shout about-refuse-heading">
            Things we won&rsquo;t build.
          </h2>
          <p className="lead-note">
            Not yet-to-do items. Each of these is a decision, held in the codebase by a test that fails if somebody
            changes their mind quietly.
          </p>
        </div>

        <ol className="refusals">
          {REFUSALS.map((refusal) => (
            <li key={refusal.title}>
              <h3>{refusal.title}</h3>
              <p>{refusal.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------- what it reads */}
      <section className="band" aria-labelledby="sources-heading">
        <div className="about-two">
          <div>
            <h2 id="sources-heading" className="lead">
              What a shop is made from
            </h2>
            <p className="lead-note lead-note-dark about-sources-note">
              All of it public, or given to us in a sentence. A shop can be built for a merchant who has agreed to
              nothing and installed nothing — which is deliberate, because it is the only way to show somebody the thing
              rather than describe it.
            </p>
          </div>
          <ul className="ledger">
            {SOURCES.map((source) => (
              <li key={source.text} data-on={source.on ? "" : undefined}>
                {source.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- the stage */}
      {/*
        The honest bit, and the place a founder story would go if there were
        one on file. Left out rather than invented: a page arguing against
        claiming what you haven't got cannot open with a fabricated origin.
      */}
      <section className="band band-paper" aria-labelledby="stage-heading">
        <div className="about-two">
          <h2 id="stage-heading" className="lead">
            Where this is
          </h2>
          <div className="about-prose">
            <p>
              Early, and small. Shops are made by hand, one at a time, for a first group of Shopify brands — there is no
              sign-up, no billing and no queue to be in. Onboarding being a person rather than a funnel is not a
              temporary embarrassment; at this stage it is the point, because the thing being collected is whether a
              merchant actually wants the shop once they can see it.
            </p>
            <p>
              That is a real question with a real answer, and we have committed to it: if enough of the first merchants
              look at what we built them and say no, we stop rather than iterate. Publishing that intention costs
              nothing with the people worth having early, and it is the only honest reason to ask for your time now.
            </p>
            <p className="about-write">
              If you want to argue with any of the above, <a href={`mailto:${INBOX}`}>{INBOX}</a> reaches a person.
            </p>
          </div>
        </div>
      </section>

      <section className="band band-lilac closing" aria-labelledby="closing-heading">
        <div className="closing-say">
          <h2 id="closing-heading" className="shout closing-heading">
            Easier to <span className="shout-mark">look at one.</span>
          </h2>
          <p className="lead-note lead-note-dark">
            Send your store and a sentence about who the shop is for. If your storefront is public we can read its
            product feed without you installing anything.
          </p>
          <div className="closing-do">
            <a className="btn btn-lg" href={ASK}>
              Get my shop made <span aria-hidden="true">→</span>
            </a>
            <a className="btn btn-lg btn-ghost" href="/examples">
              See real ones
            </a>
          </div>
        </div>

        <SiteFoot />
      </section>
    </main>
  );
}
