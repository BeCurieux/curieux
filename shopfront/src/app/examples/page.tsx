/**
 * Shops you can open.
 *
 * The page a merchant goes to when they have read the claim and want to check
 * it. So the constraint that shaped it is that **every image here links to a
 * page that actually renders**, and every one of them was produced by the
 * merchandiser rather than drawn to look like it was. `pnpm press` re-shoots
 * them out of the running renderer, so a change to the template shows up here
 * without anybody redrawing anything.
 *
 * **One catalogue, five shops.** Five real generations off a single ingest of
 * Casa Lino — same eight products underneath, five sentences over them, and the
 * same colour in all five because popuup does not get to repaint a merchant's
 * brand per audience. This is the claim the product rests on and it is the one
 * a mockup gets wrong: five differently-coloured phones would be a better
 * poster and a worse promise.
 *
 * **What used to go second, and why it is gone.** A "five brands, one renderer"
 * gallery followed — the same template under five moods. It was always the
 * weaker argument and this comment said so: a template flexing across merchants
 * is less interesting than one catalogue producing five different shops, which
 * is the thing nothing else does.
 *
 * It also could not be shown honestly. Three of those five brands have no
 * photographs, so the renderer drew SVG placeholders for their products. Those
 * were real renders — the template genuinely produced them — but of
 * invented-looking goods, on a page whose first sentence promises every image is
 * a real generation. Three fake-looking phones cost more than the argument was
 * worth.
 *
 * The five mood shops still exist and still serve at `/preview/demo-<mood>`.
 * They are simply not advertised. Photograph a brand — eight files into
 * `public/demo/<key>/`, see that folder's README — and it earns its place back.
 *
 * Everything on the page is a demo store. Nobody's real products are borrowed
 * to sell something, and every card says so rather than relying on the
 * introduction to have been read.
 */

import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
import { displayWonk } from "../fonts";
import { SiteBar, SiteFoot, ASK } from "../chrome";
import "../landing.css";
import "./examples.css";

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "Examples — popuup",
  description:
    "Real generated shops you can open. Five edits off one catalogue, and the same renderer across five brands.",
  alternates: { canonical: "/examples" },
};

/**
 * The five edits, and the sentences that produced them.
 *
 * `prompt` is the demo config's own, not a punchier one written for this page:
 * showing a prompt beside a shop it never produced would be the exact thing
 * the page exists to disprove.
 */
const EDITS = [
  {
    href: "/preview/edit-ibiza",
    shot: "/press/edit-ibiza.jpg",
    title: "The Ibiza edit",
    prompt: "the Ibiza edit \u2014 swim first, linen next, nothing over 180",
    n: 6,
    note: "It split itself in two — \u201cSwim first\u201d, then \u201cLinen next\u201d. The sentence said the order and the shop was built in that order.",
  },
  {
    href: "/preview/edit-escape",
    shot: "/press/edit-escape.jpg",
    title: "The February suitcase",
    prompt: "for someone going somewhere hot in February",
    n: 7,
    note: "Seven of the eight. Nothing in the sentence mentioned a season, a garment or a price, and it still came back as a packing list.",
  },
  {
    href: "/preview/edit-wedding",
    shot: "/press/edit-wedding.jpg",
    title: "A wedding abroad",
    prompt: "for a wedding abroad, and I am a guest",
    n: 7,
    note: "It opens with the slip dress, which is sold out — shown and marked rather than dropped, because it is exactly what somebody came for.",
  },
  {
    href: "/preview/edit-budget",
    shot: "/press/edit-budget.jpg",
    title: "Under 80",
    prompt: "everything under 80",
    n: 4,
    note: "Four pieces, and they are precisely the four under 80. The ceiling in the sentence did the work and the shop did not pad itself back out.",
  },
  {
    href: "/preview/edit-sale",
    shot: "/press/edit-sale.jpg",
    title: "What is left",
    prompt: "what is left, cheapest first",
    n: 7,
    note: "Cheapest first, the sold-out dress gone, and set in a mono face — the one shop that chose different lettering for itself.",
  },
];


export default function Examples() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      <section className="opening examples-top">
        <p className="tag">Demo shops</p>
        <h1 className="shout examples-heading">
          Shops you
          <br />
          can <span className="shout-mark">open.</span>
        </h1>
        <p className="lede">
          Every one of these is a real generation, and every image links to the page it was taken from. They are demo
          stores — nobody&rsquo;s products are borrowed to sell something — but the pages are the real renderer.
        </p>
      </section>

      {/* ------------------------------------------------ one catalogue */}
      <section className="band band-ink examples-band" aria-labelledby="edits-heading">
        <h2 id="edits-heading" className="lead">
          One catalogue. Five shops.
        </h2>
        <p className="lead-note">
          Eight products underneath, five sentences over them. The same colour in all five — it is one brand, and
          popuup does not get to repaint it. What changes is what is in the shop, how it is built, and occasionally
          the lettering, when the shop&rsquo;s job calls for it.
        </p>

        <ul className="gallery">
          {EDITS.map((edit) => (
            <li key={edit.href}>
              <a href={edit.href}>
                <span className="device">
                  <img src={edit.shot} alt={`${edit.title}, generated by popuup`} width={780} height={1690} loading="lazy" />
                </span>
                <span className="gallery-say">
                  <span className="gallery-title">
                    {edit.title} <em>{edit.n} pieces</em>
                  </span>
                  <q>{edit.prompt}</q>
                  <span className="gallery-note">{edit.note}</span>
                  <span className="gallery-go" aria-hidden="true">
                    Open the shop →
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="band band-lilac closing">
        <h2 className="shout closing-heading">
          Yours next, <span className="shout-mark">then.</span>
        </h2>
        <p className="lead-note">
          Send your store and a sentence about who the shop is for. If your storefront is public we can read its product
          feed without you installing anything.
        </p>
        <a className="btn btn-lg btn-coral" href={ASK}>
          Get my shop made <span aria-hidden="true">→</span>
        </a>
        <SiteFoot />
      </section>
    </main>
  );
}
