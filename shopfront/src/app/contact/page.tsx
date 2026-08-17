/**
 * Asking for a shop.
 *
 * The page a merchant lands on from every CTA on the site, and the one place
 * popuup asks for anything. It replaces a `mailto:` link, which was the honest
 * thing to have while the capture gate was shut and was costing real people: a
 * merchant on a phone tapped it and got an empty draft to compose themselves.
 *
 * **The gate was opened on purpose (2026-08-17, owner's call.)** `CLAUDE.md`
 * records it and `tests/stop-line.test.tsx` was narrowed in the same commit
 * rather than routed around — the same shape the creator-shops and Shopify
 * overrides took. Capture *inside a generated shop* is untouched and still
 * shut.
 *
 * What the page has to be honest about, and says plainly rather than in a
 * footnote: replies are by hand, there is no queue and no position in it,
 * nothing is charged, and the store field is asked for because a shop can be
 * built from a public product feed before anybody agrees to anything — which
 * is a thing worth telling somebody before they type their domain into a box.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot } from "../chrome";
import { EarlyAccessForm } from "./form";
import "../landing.css";
import "./contact.css";

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "Ask for a shop — popuup",
  description:
    "Send your store and a sentence about who the shop is for. We read these by hand and nothing is charged.",
  alternates: { canonical: "/contact" },
};

/** What happens after they press the button, in order, with no soft edges. */
const AFTER = [
  {
    lead: "We read it.",
    body: "A person, not a queue. There is no position to be in and no automated reply pretending otherwise.",
  },
  {
    lead: "We build one.",
    body: "If your storefront is public we can read its product feed without you installing anything or agreeing to anything.",
  },
  {
    lead: "You look at it.",
    body: "Then you tell us whether it is worth having. That answer is the thing we are actually collecting.",
  },
];

export default function Contact() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening contact-top">
        <div className="contact-say">
          <p className="tag">Early access</p>
          <h1 className="shout contact-heading">
            ask for a<br />
            <span className="shout-mark">shop.</span>
          </h1>
          <p className="lede">
            Tell us your store and who the shop is for. One sentence is enough — the sentence is the whole brief.
          </p>
          <p className="lede-sub">
            Nothing is charged and there is nothing to cancel. We are trying to find out whether merchants make these
            twice, so the useful thing you can give us is an opinion.
          </p>
        </div>

        <EarlyAccessForm />
      </section>

      <section className="band band-lilac contact-after" aria-labelledby="after-heading">
        <h2 id="after-heading" className="lead">
          What happens next.
        </h2>
        <ol className="after">
          {AFTER.map((step) => (
            <li key={step.lead}>
              <p className="after-lead">{step.lead}</p>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="after-note">
          Your address is used to reply to you. It is not a mailing list, there is nothing to unsubscribe from, and it
          is not passed to anybody — see <a href="/privacy">privacy</a>. Ask us to delete it and we will.
        </p>
      </section>

      <section className="band band-ink closing">
        <h2 className="shout closing-heading">
          or just
          <br />
          write to us.
        </h2>
        <p className="lead-note">
          Some people would rather send an email than fill in a box. <a href={`mailto:${INBOX}`}>{INBOX}</a> reaches the
          same person.
        </p>
        <SiteFoot />
      </section>
    </main>
  );
}
