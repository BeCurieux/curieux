/**
 * What it will cost.
 *
 * A pricing page for a product with no billing is a trap, and the trap is worth
 * naming rather than tiptoeing around: every convention of the form — the three
 * cards, the raised tier, the per-month figure, the comparison table, the
 * button that says Start — is the visual language of *something you can buy
 * right now*. Use that language for something nobody can buy and the page lies
 * without a single false sentence in it.
 *
 * The alternative is not to have no page. "What will this cost me" is the
 * second question a merchant asks, and refusing to answer reads as evasive. So
 * the answer is given and the tense is fixed: these are the prices we intend,
 * nothing is chargeable, and the one thing anybody can do today is ask for a
 * shop. Stated once, at the top, before any number.
 *
 * Rebuilt to the owner's reference board, which is where the cards, the raised
 * tier, the comparison table and the FAQ row come from. Two things on it are
 * not here:
 *
 *   - The monthly/yearly toggle. There is no yearly price to honour, and a
 *     switch that changes a figure nobody can pay is theatre.
 *   - "100% — enterprise-grade security, we never store your passwords." There
 *     are no passwords. popuup has no accounts.
 *
 * And one thing is moved: the board raises the middle tier and labels it MOST
 * POPULAR, which is a claim about merchants we do not have. Free is raised
 * instead, labelled with the actual offer, which is a term we can count.
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
 * before deciding what this is worth.
 */
interface Line {
  text: string;
  built: boolean;
}

interface Tier {
  name: string;
  price: string;
  per?: string;
  who: string;
  /** The one raised card, and the label on its ribbon. */
  ribbon?: string;
  lines: Line[];
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    who: "One shop, with our credit at the foot of it.",
    ribbon: "First ten keep this",
    lines: [
      { text: "One published shop", built: false },
      { text: "Built from your public product feed", built: true },
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

/**
 * The comparison table.
 *
 * `yes`, `no`, a value, or `pending` — which renders the same "not built yet"
 * marker the cards use, so the phrase means exactly one thing on the page.
 */
type Cell = "yes" | "no" | "pending" | string;

const COMPARE: { row: string; cells: [Cell, Cell, Cell] }[] = [
  { row: "Published shops", cells: ["pending", "pending", "pending"] },
  { row: "Built from your catalogue", cells: ["yes", "yes", "yes"] },
  { row: "Rebuilds against stock", cells: ["yes", "yes", "yes"] },
  { row: "Shopify checkout", cells: ["yes", "yes", "yes"] },
  { row: "Views and clicks", cells: ["yes", "yes", "yes"] },
  { row: "Creator-attributed shops", cells: ["no", "yes", "yes"] },
  { row: "“Made with popuup” credit", cells: ["Always on", "Comes off", "Comes off"] },
  { row: "Per-creator numbers", cells: ["no", "no", "pending"] },
];

const ANSWERS = [
  {
    q: "Does this replace my store?",
    a: "No, and it is not built to. popuup reads your catalogue and makes a shop from it; the sale happens in your Shopify checkout, on your domain. We never touch payments and never own the customer.",
    icon: (
      <>
        <path d="M4 9h16l-1 10.5a1.5 1.5 0 0 1-1.5 1.4h-11A1.5 1.5 0 0 1 5 19.5Z" />
        <path d="M8 9V6.5a4 4 0 0 1 8 0V9" />
      </>
    ),
  },
  {
    q: "Do you take a cut of sales?",
    a: "No. There is no commission and no plan to add one — the money never passes through us, which is the same reason we could not take a cut if we wanted to.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5c-.6-1-1.8-1.6-3-1.6-1.7 0-3 .9-3 2.1 0 3 6 1.5 6 4.5 0 1.2-1.3 2.1-3 2.1-1.3 0-2.5-.6-3-1.6" />
        <path d="M12 6.4v11.2" />
      </>
    ),
  },
  {
    q: "What if I stop paying?",
    a: "Your shops keep working and the credit goes back on. A link in somebody’s bio should not break because a card expired, and a shop that dies with a subscription is a shop nobody would risk putting there.",
    icon: (
      <>
        <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
        <path d="M20.5 4v5h-5" />
      </>
    ),
  },
  {
    q: "What counts as one of the first ten?",
    a: "A merchant we make a shop for who tells us they want it live. We are counting, and when the ten are gone the offer is gone — it is not a rolling banner. Ask now and you will know quickly whether you are inside it.",
    icon: (
      <>
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9 6.7 19.7l1.1-5.9L3.5 9.7l5.9-.8Z" />
      </>
    ),
  },
];

/** The same mark the front page uses, so the two pages read as one site. */
function Squiggle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 16" fill="none" aria-hidden="true">
      <path d="M3 11c18-9 30 5 48-1s28-8 44-1 26 6 62-4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** The little hooked arrow beside the annotation, pointing down at the cards. */
function Hook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 26" fill="none" aria-hidden="true">
      <path d="M3 2c2 9 8 15 20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 13l6.5 5-7 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cell({ value }: { value: Cell }) {
  if (value === "yes") return <span className="compare-yes" aria-label="yes">✓</span>;
  if (value === "no") return <span className="compare-no" aria-label="no">—</span>;
  if (value === "pending") return <em>not built yet</em>;
  return <>{value}</>;
}

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "popuup — what it will cost",
  description:
    "The prices popuup intends to charge. Nothing is chargeable yet: shops are made by hand for a small group of Shopify brands while we find out whether this is any good.",
  alternates: { canonical: "/pricing" },
  openGraph: { title: "popuup — what it will cost", url: `${HOME}/pricing` },
};

export default function Pricing() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening pricing-top">
        <p className="tag">Simple pricing. None of it live.</p>

        <h1 className="shout pricing-head">
          What it will cost. <span className="shout-mark">When it does.</span>
          <Squiggle className="pricing-squiggle" />
        </h1>

        {/*
          Before any number. A reader who takes one thing from this page should
          take this, and a reader who takes the numbers instead should have had
          to scroll past it to do so.
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

        <p className="aside-note">
          Every marked line below is one that doesn&rsquo;t exist yet
          <Hook />
        </p>
      </section>

      <section className="band" aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="visually-hidden">
          Intended plans
        </h2>

        <ul className="tiers">
          {TIERS.map((tier) => (
            <li key={tier.name} className={tier.ribbon ? "tier tier-lead" : "tier"}>
              {tier.ribbon && <span className="tier-ribbon">{tier.ribbon}</span>}
              <span className="tier-name">{tier.name}</span>
              <p className="tier-who">{tier.who}</p>
              <p className="tier-price">
                {tier.price}
                {tier.per && <span className="tier-per">{tier.per}</span>}
              </p>

              {/* Not "Start for free". Nothing starts — the only thing anybody
                  can do today is ask, and the button says what it does. */}
              <a className={tier.ribbon ? "btn" : "btn btn-ghost"} href={ASK}>
                Ask for a shop
              </a>

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

      <section className="band band-paper" aria-labelledby="compare-heading">
        <div className="band-top">
          <h2 id="compare-heading" className="lead">
            The three, side by side
          </h2>
          {/* Above the table rather than in a `<caption>`: the wrapper scrolls
              horizontally, and a caption inside it gets clipped by that. */}
          <p className="lead-note lead-note-dark">
            A tick means it runs today for the shops we build by hand. The marker means it is intended and not built.
          </p>
        </div>

        <div className="compare-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Compare plans</th>
                {TIERS.map((tier) => (
                  <th key={tier.name} scope="col">
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((line) => (
                <tr key={line.row}>
                  <th scope="row">{line.row}</th>
                  {line.cells.map((cell, index) => (
                    <td key={`${line.row}-${TIERS[index]!.name}`}>
                      <Cell value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" aria-labelledby="answers-heading">
        <div className="band-top">
          <h2 id="answers-heading" className="lead">
            Questions worth asking first
          </h2>
        </div>

        <dl className="answers">
          {ANSWERS.map((item) => (
            <div key={item.q}>
              <span className="answer-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
              </span>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="band band-lilac closing" aria-labelledby="closing-heading">
        <div className="closing-say">
          <h2 id="closing-heading" className="shout closing-heading">
            The price today is <span className="shout-mark">nothing.</span>
          </h2>
          <p className="lead-note lead-note-dark">
            Send your store and a sentence about who the shop is for. If it turns out to be any good, we will talk about
            the numbers above then.
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
