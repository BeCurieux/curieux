/**
 * The terms, for a product nobody can buy yet.
 *
 * Which is what makes this page easy to get wrong in one specific direction:
 * the standard shape of a terms page assumes a paid subscription, an account,
 * a cancellation policy and a limitation of liability against a fee that has
 * been charged. Use that shape here and the page implies a commercial
 * relationship that does not exist, in exactly the way a pricing page with a
 * highlighted middle tier would.
 *
 * So the tense is fixed at the top and the page says what is actually true
 * today: nothing is charged, nothing is guaranteed, a merchant owns their own
 * products and copy, and either side can walk away with no notice because
 * there is nothing to give notice about.
 *
 * Not legal advice, and the page says so rather than implying review that has
 * not happened.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot } from "../chrome";
import "../landing.css";
import "./legal.css";

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "Terms — popuup",
  description: "What popuup is offering today, what it is not, and who owns what.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening legal-top">
        <p className="tag">Terms</p>
        <h1 className="shout legal-heading">
          Where this
          <br />
          <span className="shout-mark">stands.</span>
        </h1>
        <p className="lede">
          popuup is early and nothing here is for sale yet. These terms describe that rather than a subscription
          somebody might one day have.
        </p>
      </section>

      <section className="band legal">
        <div className="legal-body">
          <h2>What is on offer</h2>
          <p>
            Today: we will read a store&rsquo;s public product feed, build a shop from it, and show it to the merchant.
            That is done by hand, at our discretion, for a small number of merchants while we find out whether these
            are worth making. There is no account to open, no plan to be on, and no queue with a position in it.
          </p>

          <h2>What it costs</h2>
          <p>
            Nothing. There is no billing built, no card taken and nothing to cancel. The prices on the{" "}
            <a href="/pricing">pricing page</a> are what we intend to charge later, stated so that nobody is surprised
            by them; they are not in effect, and none of them can be bought today. If that changes, it changes with
            notice and with agreement, not by a page being edited.
          </p>

          <h2>Who owns what</h2>
          <ul>
            <li>
              <strong>Your products, photography, prices and brand stay yours.</strong> popuup reads them, arranges
              them, and writes copy around them. Nothing about that transfers anything.
            </li>
            <li>
              <strong>A shop we generate for you is yours to use.</strong> Take it down, keep it, or ask us to delete
              it.
            </li>
            <li>
              <strong>The software is ours.</strong> The template, the merchandiser and the code behind them are not
              part of what is handed over.
            </li>
          </ul>

          <h2>What we do not do</h2>
          <ul>
            <li>
              We do not take payments. Checkout is a link into a merchant&rsquo;s own Shopify store, and every sale is
              theirs under their own terms.
            </li>
            <li>
              We do not touch a store. Building a shop reads a public product feed; nothing is written back, no theme
              is changed and no app needs installing.
            </li>
            <li>We do not contact a merchant&rsquo;s customers, and we do not hold a customer list.</li>
          </ul>

          <h2>What is not promised</h2>
          <p>
            Uptime, permanence, or that a generated shop is any good. This is software being tested in public: a shop
            can be wrong about who a product is for, a URL can change, and the whole thing can be turned off. If a shop
            of yours is live and something is about to break it, we will tell you first — but nothing here is a service
            level and it would be dishonest to dress it as one.
          </p>
          <p>
            Prices, stock and imagery in a shop come from the merchant&rsquo;s own store. If a price is wrong there, it
            is wrong in the shop, and the merchant&rsquo;s checkout is what actually governs a sale.
          </p>

          <h2>Ending it</h2>
          <p>
            Either side, at any time, for any reason, with no notice, because there is nothing to give notice about.
            Ask us to take a shop down and delete what we hold, and we will:{" "}
            <a href={`mailto:${INBOX}`}>{INBOX}</a>.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Do not ask us to build a shop for a store you do not run, or for products you are not entitled to sell. We
            will refuse, and we will not explain at length.
          </p>

          <p className="legal-note">
            Written to describe what popuup actually does today, and not reviewed by a lawyer. Saying so is better than
            implying otherwise. See also <a href="/privacy">privacy</a>.
          </p>
        </div>
      </section>

      <section className="band band-lilac closing">
        <SiteFoot />
      </section>
    </main>
  );
}
