import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
import { displayWonk } from "./fonts";
import { SiteBar, SiteFoot, ASK } from "./chrome";
import { MechanicArtwork, CatalogueArtwork, PostArtwork, CreatorArtwork } from "./ArtworkSlices";
import "./landing.css";

const LEAD = {
  mood: "luxe",
  prompt: "a wedding list for two people who already own everything",
  reads: ["Wedding list", "Owns everything", "In stock"],
};

const EDITS = [
  { slug: "edit-wedding", title: "The wedding list", prompt: "for two people who already own everything", n: 5, lift: 0 },
  { slug: "edit-first", title: "The first glass", prompt: "for someone moving into their own place, nothing over 60", n: 3, lift: 3 },
  { slug: "edit-bar", title: "The negroni kit", prompt: "for someone who has started making cocktails at home", n: 4, lift: 1 },
  { slug: "edit-gift", title: "The host gift", prompt: "for a host who has everything, under 80", n: 4, lift: 4 },
  { slug: "edit-sale", title: "End of season", prompt: "what is left, cheapest first", n: 7, lift: 2 },
];

const CHAIN = [
  { name: "The post", body: "A reel, a creator, a campaign. Somebody clicked for a specific reason." },
  { name: "The shop", body: "Your products, picked and ordered and written for that reason." },
  { name: "Your checkout", body: "Shopify takes the money. The customer is yours, exactly as before." },
];

const RULES = [
  "What you can still sell comes first",
  "Products you’ve deleted drop off the page",
  "Sold-out ones stay, and say so",
  "If too much has changed, we ask before rebuilding",
];

const STEPS = [
  { n: "01", title: "Write a sentence", body: "Say what the link is for. “A wedding list for two people who already own everything.”" },
  { n: "02", title: "We build the shop", body: "We read your catalogue and pick the products that fit, then order and write them." },
  { n: "03", title: "Put the link in the post", body: "In a bio, an email, an ad, a creator’s story. Wherever the click starts." },
];

function Burst({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 0l9 32 24-23-14 30 33-8-29 19 29 19-33-8 14 30-24-23-9 32-9-32-24 23 14-30-33 8 29-19-29-19 33 8-14-30 24 23z" fill="currentColor" />
    </svg>
  );
}

function Squiggle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 24" aria-hidden="true">
      <path d="M2 18c14-18 26 12 40-4S72 2 84 12s22 2 34-6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "popuup — every click deserves its own shop",
  description: "Write one sentence about the post you're linking from, and get a small shop built from your Shopify catalogue with just the products that match it. No page builder.",
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
      <SiteBar />

      <section className="opening">
        <div className="opening-say">
          <p className="tag"><Burst className="tag-burst" /> Merchandising for Shopify</p>
          <h1 className="shout">
            every click<br />deserves its<br />own <span className="shout-mark">shop.</span>
          </h1>
          <p className="lede">
            You post a reel about linen shirts. The link in your bio goes to a homepage with four hundred products on it.
          </p>
          <p className="lede-sub">
            Write one sentence instead, and we’ll build a small shop from your Shopify catalogue with just the products that fit — in an order that makes sense, with words that match the post.
          </p>
          <a className="btn btn-lg" href={ASK}>Get my shop made <span aria-hidden="true">→</span></a>
          <p className="note">
            Works for a post, a creator, an email, an ad — anything you put a link in. Free while we’re building these with a small group of Shopify brands.
          </p>
        </div>

        <div className="stage" aria-label="A sentence, and the shop it produced">
          <Burst className="stage-burst" />
          <span className="device device-lg" aria-hidden="true">
            <span className="screen">
              {[0, 1, 2].map((band) => (
                <img key={band} className="screen-band" src={`/press/shop-${LEAD.mood}.jpg`} alt="" width={780} height={1690} />
              ))}
              <span className="think">
                <span className="think-lead">Reading your catalogue</span>
                <span className="think-chips">
                  {LEAD.reads.map((chip) => <i key={chip}>{chip}</i>)}
                </span>
              </span>
            </span>
          </span>

          <figure className="prompt">
            <figcaption>Make a shop in a sentence</figcaption>
            <p>
              {LEAD.prompt.split(" ").map((word, index) => (
                <span key={word + index}>
                  <span className="typed" style={{ "--w": index } as React.CSSProperties}>{word}</span>{" "}
                </span>
              ))}
              <span className="caret" aria-hidden="true" />
            </p>
            <span className="prompt-go" aria-hidden="true">Make it pop <Burst className="prompt-burst" /></span>
          </figure>
        </div>
      </section>

      {/* The actual campaign artwork now appears as three separate responsive images. */}
      <MechanicArtwork />

      <section className="band why">
        <p className="why-line">
          Someone who just watched your linen reel and someone hunting for a Christmas gift aren’t the same shopper. Right now they both land on the same page.
          <Squiggle className="why-squiggle" />
        </p>
      </section>

      <section className="band band-ink proof" aria-labelledby="proof-heading">
        <div className="proof-say">
          <h2 id="proof-heading" className="lead">One catalogue.<br />Five shops.</h2>
          <p className="lead-note">
            All five of these shops sell the same eight products. One sentence each, and they come out differently for the moment.
          </p>
          <p className="rail-note">
            The colours and lettering stay the same because it is still one brand. These are demo shops built by the same renderer used for merchant shops.
          </p>
        </div>

        <ul className="rail">
          {EDITS.map((edit) => (
            <li key={edit.slug} style={{ "--lift": edit.lift } as React.CSSProperties}>
              <figure>
                <span className="device">
                  <img src={`/press/${edit.slug}.jpg`} alt={`${edit.title}, generated by popuup`} width={780} height={1690} loading="lazy" />
                </span>
                <figcaption>
                  <span className="rail-brand">{edit.title} <em>{edit.n} pieces</em></span>
                  <q>{edit.prompt}</q>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <CatalogueArtwork />
      </section>

      <section className="band band-purple negations" aria-labelledby="negations-heading">
        <h2 id="negations-heading" className="shout negations-heading">there is no<br />page builder.</h2>
        <ul className="pills">
          <li>No blocks to drag</li>
          <li>No template to pick</li>
          <li>No theme to configure</li>
          <li>No afternoon lost</li>
        </ul>
        <p className="negations-note">
          A campaign shouldn’t cost you an afternoon of dragging blocks around. Write the sentence, get the shop. That’s the whole job.
        </p>
      </section>

      <section className="band chain-band" aria-labelledby="chain-heading">
        <h2 id="chain-heading" className="lead">Between the tap<br />and the checkout</h2>
        <p className="lead-note">Everything popuup does happens in that gap.</p>
        <ol className="chain">
          {CHAIN.map((link, index) => (
            <li key={link.name} data-ours={index === 1 ? "" : undefined}>
              <span className="chain-name">{link.name}</span>
              <p>{link.body}</p>
            </li>
          ))}
        </ol>
        <PostArtwork />
      </section>

      <section className="band band-purple keep" aria-labelledby="keep-heading">
        <div className="keep-say">
          <h2 id="keep-heading" className="shout keep-heading">not pages.<br />shops that keep up.</h2>
          <p className="keep-note">
            A page you built in March is still selling March. Read your catalogue again and the shop reorders itself around what you can actually still sell. The rules are fixed and written down — it’s not a model’s opinion on the day.
          </p>
        </div>

        <div className="swap" aria-label="What a rebuild does when a product sells out">
          <div className="swap-row">
            <span className="swap-when">Before</span>
            <span className="swap-card is-out">Wrap Coat <em>Sold out</em></span>
            <span className="swap-card">Linen Dress <em>In stock</em></span>
          </div>
          <div className="swap-row">
            <span className="swap-when">Rebuilt</span>
            <span className="swap-card">Linen Dress <em>In stock</em></span>
            <span className="swap-card is-out">Wrap Coat <em>Sold out</em></span>
            <span className="swap-mark">Moved down, not hidden</span>
          </div>
          <ul className="rules">{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </div>
      </section>

      <section className="band creators" aria-labelledby="creators-heading">
        <div>
          <h2 id="creators-heading" className="lead">Give every creator<br />their <span className="lead-coral">own shop.</span></h2>
          <p className="lead-note">Their picks and their name, on their own link — running on your catalogue and your checkout.</p>
          <ul className="ticks"><li>Their audience</li><li>Your products</li><li>Their own link</li></ul>
        </div>
        <figure className="credit-sample">
          <span className="credit-brand">Maison Verre</span>
          <p className="credit-line">Chosen by Ana Ruiz</p>
          <figcaption>The credit a creator’s shop carries, under the brand.</figcaption>
        </figure>
        <CreatorArtwork />
      </section>

      <section className="band steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="lead">How it goes</h2>
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="steps-end">That is it.<Squiggle className="steps-squiggle" /></p>
      </section>

      <section className="band band-lilac early" aria-labelledby="early-heading">
        <div>
          <h2 id="early-heading" className="lead">Where this is</h2>
          <p className="lead-note">
            Early, on purpose. We’re building shops with a handful of Shopify brands to find out whether they’re genuinely useful before we build the rest.
          </p>
        </div>
        <ul className="ledger">
          <li data-on="">Real shops, from your real catalogue</li>
          <li data-on="">Your Shopify checkout, untouched</li>
          <li data-on="">Creator credit and rebuilds</li>
          <li>Onboarding is by hand, one at a time</li>
          <li>No accounts and no billing yet</li>
          <li>Nothing syncs with your store on its own</li>
        </ul>
        <p className="ledger-note">Free shops carry a small “Made with popuup” credit at the foot, in your own colours. Paid plans will remove it.</p>
      </section>

      <section className="band band-purple closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="shout closing-heading">your next post<br />deserves its own shop.</h2>
        <a className="btn btn-lg btn-coral" href={ASK}>Get my shop made <span aria-hidden="true">→</span></a>
        <SiteFoot />
      </section>
    </main>
  );
}
