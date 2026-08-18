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
 * Two arguments, in order of which is harder to make.
 *
 * **One catalogue, five shops.** Five real generations off a single ingest of
 * Maison Verre — same eight products underneath, five sentences over them, and
 * the same colourway in all five because popuup does not get to repaint a
 * merchant's brand per audience. This is the claim the product rests on and it
 * is the one a mockup gets wrong: five differently-coloured phones would be a
 * better poster and a worse promise.
 *
 * **Five brands, one renderer.** The same template under five different
 * moods. This is the easier claim — a template flexing across merchants — and
 * it goes second for that reason.
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
    href: "/preview/edit-wedding",
    shot: "/press/edit-wedding.jpg",
    title: "The wedding list",
    prompt: "for two people who already own everything",
    n: 5,
    note: "The sold-out decanter is one of the five — marked, not dropped, because a wedding list is exactly where you still want to see it.",
  },
  {
    href: "/preview/edit-first",
    shot: "/press/edit-first.jpg",
    title: "The first glass",
    prompt: "for someone moving into their own place, nothing over 60",
    n: 3,
    note: "Three pieces out of eight. The ceiling in the sentence did the work, and the shop did not pad itself back out.",
  },
  {
    href: "/preview/edit-bar",
    shot: "/press/edit-bar.jpg",
    title: "The negroni kit",
    prompt: "for someone who has started making cocktails at home",
    n: 4,
    note: "It split itself in two — the glasses, then the rest of the bar. Nothing in the sentence asked for that division.",
  },
  {
    href: "/preview/edit-gift",
    shot: "/press/edit-gift.jpg",
    title: "The host gift",
    prompt: "for a host who has everything, under 80",
    n: 4,
    note: "Three of these four are in the first-flat shop too. Same products, a different reason to be on the page.",
  },
  {
    href: "/preview/edit-sale",
    shot: "/press/edit-sale.jpg",
    title: "End of season",
    prompt: "what is left, cheapest first",
    n: 5,
    note: "Cheapest first, and the sold-out decanter is gone. This is the one shop where \u201cwhat is left\u201d has to mean it.",
  },
];

/** The same template under five moods, across five demo brands. */
const BRANDS = [
  { href: "/preview/demo-luxe", shot: "/press/shop-luxe.jpg", name: "Maison Verre", mood: "luxe", what: "Hand-cut glass" },
  { href: "/preview/demo-clean", shot: "/press/shop-clean.jpg", name: "Sea Salt Skin", mood: "clean", what: "Three-step skincare" },
  { href: "/preview/demo-editorial", shot: "/press/shop-editorial.jpg", name: "Folio Press", mood: "editorial", what: "Paper and print" },
  { href: "/preview/demo-playful", shot: "/press/shop-playful.jpg", name: "Pip & Pockets", mood: "playful", what: "Kids' clothing" },
  { href: "/preview/demo-utility", shot: "/press/shop-utility.jpg", name: "Bench & Bolt", mood: "utility", what: "Hand tools" },
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
          Eight products underneath, five sentences over them. Same colours and same type in all five: it is one brand,
          and popuup does not get to repaint it. What changes is what is in the shop and how it is built.
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

      {/* ------------------------------------------------- five brands */}
      <section className="band examples-band" aria-labelledby="brands-heading">
        <h2 id="brands-heading" className="lead">
          Five brands. One renderer.
        </h2>
        <p className="lead-note lead-note-dark">
          The same hand-built template under five moods. Nothing here is a theme somebody picked — the mood follows the
          brand and the shopper, and the colour is always the brand&rsquo;s own.
        </p>

        <ul className="gallery gallery-brands">
          {BRANDS.map((brand) => (
            <li key={brand.href}>
              <a href={brand.href}>
                <span className="device device-light">
                  <img src={brand.shot} alt={`${brand.name}, rendered by popuup`} width={780} height={1690} loading="lazy" />
                </span>
                <span className="gallery-say">
                  <span className="gallery-title">
                    {brand.name} <em>{brand.mood}</em>
                  </span>
                  <span className="gallery-note">{brand.what} · demo store</span>
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
