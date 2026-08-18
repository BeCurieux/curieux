/**
 * What is collected, written from the code rather than from a template.
 *
 * A generated privacy policy would be the same lie as a generated shop full of
 * invented products, so every claim on this page corresponds to something in
 * this repository and is checked by `tests/legal.test.tsx` against the code
 * that does it. If the funnel starts writing a cookie or the contact form
 * starts asking for a phone number, a test fails here.
 *
 * The two things worth stating plainly, because they are unusual enough that a
 * reader would assume the opposite:
 *
 *   1. **A shop sets no cookie.** The funnel uses `sessionStorage`, which is
 *      scoped to one tab on one origin and gone when the tab closes. That is
 *      why there is no cookie banner on a popuup shop, and the absence is a
 *      design decision rather than an oversight.
 *   2. **The one place personal data is held is the contact form.** Everything
 *      else stored is a public product feed or a random session id.
 *
 * This is not legal advice and the page says so. It describes the system
 * accurately, which is the part an engineer can actually be responsible for; a
 * lawyer reviewing it is a separate and still-outstanding job, named on the
 * page rather than hidden.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot } from "../chrome";
import "../landing.css";
import "./legal.css";

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "Privacy — popuup",
  description: "What popuup collects, where it goes, and what it does not do. Written from the code.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening legal-top">
        <p className="tag">Privacy</p>
        <h1 className="shout legal-heading">
          What we
          <br />
          <span className="shout-mark">collect.</span>
        </h1>
        <p className="lede">
          Short, because there is not much. Every paragraph below describes something this software actually does.
        </p>
      </section>

      <section className="band legal">
        <div className="legal-body">
          <h2>If you write to us</h2>
          <p>
            The contact form asks for your name, your email address, your store, and optionally a sentence about who
            the shop is for. It is stored so that a person can read it and reply to you.
          </p>
          <p>
            It is not a mailing list. There is nothing to unsubscribe from, because nothing is ever sent to that
            address except a reply from a person. It is not passed to anybody, sold, or used to build a profile. Ask us
            to delete it — <a href={`mailto:${INBOX}`}>{INBOX}</a> — and we will, and you do not have to say why.
          </p>

          <h2>If you open a shop we made</h2>
          <p>
            A popuup shop records that a page was viewed, that a product was clicked, and that somebody went through to
            a checkout. That is the entire list of events — there is no fourth kind and no free-form event, and nothing
            recorded carries a score, a weight, or a group you have been sorted into.
          </p>
          <p>
            Each is tagged with a random identifier generated in your browser and kept in{" "}
            <code>sessionStorage</code>. It is not derived from anything about you, it is scoped to that one tab on
            that one site, and it is gone when you close the tab. <strong>A popuup shop sets no cookie.</strong> That
            is why there is no banner asking you to accept any.
          </p>
          <p>
            One coarse label is kept alongside: roughly where the click came from, worked out from the referrer your
            browser already sent — &ldquo;instagram&rdquo;, not a URL — plus a campaign tag if the merchant put one in
            the link. Nothing else about the request is stored. No IP address, no device fingerprint, no location.
          </p>
          <p>
            The merchant whose shop it is can see the totals. They cannot see who you are, because neither can we.
          </p>

          <h2>If you buy something</h2>
          <p>
            You do not buy anything from popuup. Checkout is a Shopify cart link, pre-filled and handed to the
            merchant&rsquo;s own store, and everything after that click is between you and them under their privacy
            policy. popuup never sees an order, a payment, a customer record or an address.
          </p>

          <h2>What we store about a merchant&rsquo;s store</h2>
          <p>
            A store&rsquo;s public product feed — the same information anybody can read from its storefront — along
            with the shops built from it and the sentences that produced them. That is business data rather than
            personal data, and it is what makes a shop able to stay current with price and availability.
          </p>

          <h2>Who else is involved</h2>
          <ul>
            <li>
              <strong>Anthropic</strong> — the merchandiser sends a store&rsquo;s public catalogue and the merchant&rsquo;s
              sentence to Claude to decide what goes in a shop. No shopper data is sent, because none is collected at
              the point the shop is built.
            </li>
            <li>
              <strong>Supabase</strong> — where shops, catalogues, events and contact-form messages are stored.
            </li>
            <li>
              <strong>Vercel</strong> — where the site runs. It keeps its own request logs, as any host does.
            </li>
            <li>
              <strong>Shopify</strong> — a merchant&rsquo;s own store, which handles every checkout.
            </li>
          </ul>
          <p>
            That is the whole list. There is no analytics script, no advertising pixel, no tag manager, no session
            recorder and no chat widget on this site or on a shop.
          </p>

          <h2>Fonts and images</h2>
          <p>
            Typefaces are served from this site rather than from a font CDN, so opening a shop does not make a request
            to a third party carrying your address. Product photography is loaded from the merchant&rsquo;s own store,
            which is the one unavoidable outside request a shop makes.
          </p>

          <h2>Your rights</h2>
          <p>
            Ask what we hold about you, ask for a copy, or ask us to delete it. One address, and a person reads it:{" "}
            <a href={`mailto:${INBOX}`}>{INBOX}</a>.
          </p>

          <p className="legal-note">
            This page describes the software accurately and is not legal advice. It has not yet been reviewed by a
            lawyer, and saying so here is better than implying otherwise. If popuup starts doing something this page
            does not describe, this page changes first.
          </p>
        </div>
      </section>

      <section className="band band-lilac closing">
        <SiteFoot />
      </section>
    </main>
  );
}
