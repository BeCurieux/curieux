/**
 * What it will cost.
 *
 * A pricing page for a product with no billing is a trap, and the trap is worth
 * naming rather than tiptoeing around: every convention of the form — the three
 * cards, the highlighted middle tier, the per-month figure, the button that
 * says Start — is the visual language of *something you can buy right now*. Use
 * that language for something nobody can buy and the page lies without a single
 * false sentence in it.
 *
 * The alternative is not to have no page. "What will this cost me" is the
 * second question a merchant asks, and refusing to answer it reads as either
 * evasive or unfinished. So the answer is given, and the tense is fixed: these
 * are the prices we intend, nothing is chargeable, and the one thing you can
 * do today is ask for a shop. Stated once, at the top, before any number.
 *
 * Every tier says which of its lines is built and which is not, because a
 * feature list is where a page like this does its lying — the reader assumes
 * everything above the fold exists, and three of these do not.
 *
 * `/pricing` was reserved in `lib/publish/slug.ts` long before this file, so no
 * merchant's shop can have taken the path.
 */

import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot, ASK } from "../chrome";
import "../landing.css";
import "./pricing.css";

/**
 * `built` is not decoration. It is the difference between describing a product
 * and describing a plan, and a reader is entitled to know which line is which
 * before they decide what this is worth.
 */
interface Line {
  text: string;
  built: boolean;
}

const TIERS: {
  name: string;
  price: string;
  per?: string;
  who: string;
  lines: Line[];
}[] = [
  {
    name: "Free",
    price: "$0",
    who: "One shop, with our credit at the foot of it.",
    lines: [
      { text: "One published shop", built: false },
      { text: "Built from your live product feed", built: true },
      { text: "Rebuilds against current stock", built: true },
      { text: "Views, clicks and checkout clicks", built: true },
      { text: "Carries “Made with popuup”", built: true },
    ],
  },
  {
    name: "Launch",
    price: "$49",
    per: "per month",
    who: "For a brand making a shop per campaign.",
    lines: [
      { text: "More shops", built: false },
      { text: "The credit comes off", built: true },
      { text: "Creator-attributed shops", built: true },
      { text: "Rebuild rules per shop", built: true },
      { text: "Everything in Free", built: true },
    ],
  },
  {
    name: "Growth",
    price: "$129",
    per: "per month",
    who: "For a brand where every post gets its own.",
    lines: [
      { text: "Shops without a practical limit", built: false },
      { text: "Per-creator numbers", built: false },
      { text: "Priority on new merchandising", built: false },
      { text: "Everything in Launch", built: true },
    ],
  },
];

const ANSWERS = [
  {
    q: "Does this replace my store?",
    a: "No, and it is not built to. popuup reads your catalogue and makes a shop from it; the sale happens in your Shopify checkout, on your domain. We never touch payments and never own the customer.",
  },
  {
    q: "Do you take a cut of sales?",
    a: "No. There is no commission and no plan to add one — the money never passes through us, which is the same reason we could not take a cut if we wanted to.",
  },
  {
    q: "What happens to my shops if I stop paying?",
    a: "They keep working and the credit goes back on. A link in somebody’s bio should not break because a card expired, and a shop that dies with a subscription is a shop nobody would risk putting there.",
  },
  {
    q: "What counts as one of the first ten?",
    a: "A merchant we make a shop for who tells us they want it live. We are counting, and when the ten are gone the offer is gone — it is not a rolling banner. Ask now and you will know quickly whether you are inside it.",
  },
  {
    q: "Why is there a credit on the free tier?",
    a: "It is how the next merchant finds us, and it is the whole reason a free tier can exist. It sits at the foot of the page in your own colours rather than ours, so it reads as a credit and not a sticker.",
  },
];

export const metadata: Metadata = {
  title: "popuup — what it will cost",
  description:
    "The prices popuup intends to charge. Nothing is chargeable yet: shops are made by hand for a small group of Shopify brands while we find out whether this is any good.",
  openGraph: { title: "popuup — what it will cost", url: `${HOME}/pricing` },
};

export default function Pricing() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening pricing-top">
        <h1 className="shout">
          what it <span className="shout-mark">will</span>
          <br />
          cost.
        </h1>

        {/*
          Before any number. A reader who takes one thing from this page should
          take this, and a reader who takes the numbers instead should have had
          to scroll past it to do so.

          The offer is a real term, not urgency dressing. Ten is a number we can
          honour and count — the kill-test ledger already tracks exactly who has
          been asked and who said yes — and it is deliberately stated without a
          live counter, because a "3 of 10 gone" ticker on a page that cannot
          read the ledger would be theatre.
        */}
        <div className="caveat">
          <p className="caveat-lead">The first ten merchants keep it free.</p>
          <p>
            Not free for a month. Free, kept, for the ten brands who help us work out whether this is any good — on
            whatever we end up charging everyone else.
          </p>
          <p>
            And nothing is chargeable today regardless: there is no sign-up, no card field and no billing in popuup yet.
            Shops are made by hand, one at a time. The prices below are what we intend to charge once there is something
            to charge for, published now so nobody has to guess rather than so anybody can pay.
          </p>
        </div>
      </section>

      <section className="band tiers-band" aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="visually-hidden">
          Intended plans
        </h2>
        <ul className="tiers">
          {TIERS.map((tier) => (
            <li key={tier.name} className="tier">
              <span className="tier-name">{tier.name}</span>
              <p className="tier-price">
                {tier.price}
                {tier.per && <span className="tier-per">{tier.per}</span>}
              </p>
              <p className="tier-who">{tier.who}</p>
              <ul className="tier-lines">
                {tier.lines.map((line) => (
                  <li key={line.text} data-built={line.built ? "" : undefined}>
                    {line.text}
                    {!line.built && <em>not built yet</em>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="tiers-note">
          Marked lines are the ones that do not exist. Everything else runs today, for the merchants we are making shops
          with by hand — which is why the honest price for all of it is currently nothing.
        </p>
      </section>

      <section className="band answers" aria-labelledby="answers-heading">
        <h2 id="answers-heading" className="lead">
          The rest of it
        </h2>
        <dl>
          {ANSWERS.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="band band-purple closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="shout closing-heading">
          the price today
          <br />
          is nothing.
        </h2>
        <p className="keep-note">
          Send your store and a sentence about who the shop is for. If it turns out to be any good, we will talk about
          the numbers above then.
        </p>
        <a className="btn btn-lg btn-coral" href={ASK}>
          Get my shop made <span aria-hidden="true">→</span>
        </a>

        <SiteFoot />
      </section>
    </main>
  );
}
