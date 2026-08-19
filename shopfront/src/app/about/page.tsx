/**
 * Why this exists.
 *
 * An about page is where a launch site normally puts the things it cannot
 * prove: a founding story, a team wall, a mission, a number of people served.
 * popuup has none of those to show, and the rest of the site is built on not
 * claiming what it hasn't got — so this page is the argument instead.
 *
 * **Two sections, and it used to be five.** The owner's verdict on the longer
 * version was "too much", and they were right for a reason worth recording:
 * three of those five said again what the front page already says. An opening
 * about homepages being bad landing pages, a list of what a shop is built
 * from, and a ledger of what is and is not built — the front page carries all
 * three, closer to where somebody decides. A second page repeating them is not
 * a longer argument, it is the same argument read twice by somebody who is
 * now less inclined to believe it.
 *
 * What survived is what only this page says:
 *
 *   1. The one architectural rule. "The AI fills a schema, it never writes
 *      markup" answers in nine words the question anybody who has seen an
 *      AI-built page is actually asking — why don't these look generated? —
 *      and it appears nowhere else on the site.
 *   2. What we refuse to build. On a product this early a list of refusals is
 *      worth more than a list of features: features arrive next week, refusals
 *      describe judgement. Every one is held by a test rather than an
 *      intention, which is what makes them worth printing.
 *
 * **The gap, stated rather than filled.** There is no founder, location,
 * headcount or founding date on this page, because nobody has told me any of
 * them and inventing one would be the exact failure the page is arguing
 * against. The slot for it is marked below.
 */

import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
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

        <div className="about-prose about-rule-prose">
          <p>
            The model reads your catalogue and your sentence and makes the decisions a merchandiser would make — which
            products, in what order, grouped how, described with which words, in which of your own brand&rsquo;s
            colours. It returns those decisions as structured data, and nothing else. The page comes from one
            hand-built template that was designed properly, once, by people looking at it.
          </p>
          <p>
            So the design quality of your shop does not depend on what the model felt like producing that day. It
            cannot invent a layout, write its own CSS, or decide your brand is purple now. It chooses{" "}
            <em>what goes in the shop</em>. It does not choose what a shop looks like.
          </p>
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
