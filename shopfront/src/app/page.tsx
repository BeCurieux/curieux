/**
 * The front door.
 *
 * Everything on this page is a claim, so the constraint that shaped it is the
 * same one the renderer works under: nothing may say something the system does
 * not do. That rules out most of what a landing page normally leans on — no
 * logo wall, no counter, no testimonial, no pricing table for billing that is
 * not built, no "instantly", no "syncs".
 *
 * The page runs on cream with purple fields cut into it, and that is a decision
 * about the product rather than about taste: a site that is purple everywhere
 * makes every shop on it look like a popuup product, and the argument here is
 * that a generated shop looks like the *merchant*.
 *
 * Order is the conversion hierarchy, not a tour of the feature list. What is
 * this → why does the click deserve better → what does it produce → how little
 * work is it → where does it sit → what keeps it true → who else is it for →
 * how does it go → where is it really.
 *
 * The shops are real output. `pnpm press` screenshots them from the running
 * renderer into `public/press/`, so a change to the template shows up here
 * without anybody redrawing anything, and this page can never advertise a
 * design that no longer exists.
 *
 * It asks for an email by opening the visitor's own mail client rather than by
 * collecting an address. Email capture is Sprint 3 and gated on the kill test;
 * a form that posted nowhere would be the exact dishonesty the rest of the page
 * is written to avoid.
 */

import type { Metadata } from "next";
import { HOME, INBOX } from "@/lib/origin";
import { displayWonk } from "./fonts";
import "./landing.css";

const ASK = `mailto:${INBOX}?subject=${encodeURIComponent("Make me a shop")}&body=${encodeURIComponent(
  "My store:\n\nWho the shop is for:\n\n",
)}`;

/**
 * The shop in the opening, and the sentence that produced it.
 *
 * Maison Verre rather than the children's shop that was here before. Both are
 * real output; this one is the one a merchant looks at and wants. The prompt is
 * the demo config's own, because a punchier sentence written for the page would
 * mean showing a prompt and a shop that never met.
 */
const LEAD = {
  mood: "luxe",
  prompt: "a wedding list for two people who already own everything",
  // What the merchandiser is actually working from. Chips rather than a
  // product count: a number on screen has to be true, and this catalogue's
  // size is not the point being made.
  reads: ["Wedding list", "Owns everything", "In stock"],
};

/** The other four, as evidence that the sentence is what changed. */
const SHOPS = [
  { mood: "editorial", brand: "Folio Press", prompt: "a desk set for someone who has started writing by hand again" },
  { mood: "clean", brand: "Sea Salt Skin", prompt: "a first routine for someone who has never used skincare" },
  { mood: "utility", brand: "Bench & Bolt", prompt: "the starter kit for someone setting up their first workshop" },
  { mood: "playful", brand: "Pip & Pockets", prompt: "a gift edit for a two-year-old who ruins everything" },
];

const CHAIN = [
  { name: "Attention", body: "A post, a creator, a campaign. Someone arrived for a reason." },
  { name: "popuup", body: "Your catalogue, selected and ordered and written for that reason." },
  { name: "Your checkout", body: "Shopify handles the sale. Your store keeps the customer." },
];

/**
 * What a rebuild does about stock, in the words the rules actually use.
 *
 * The sold-out line is the one to guard. The rule demotes; it does not hide,
 * and it does not substitute — a chip promising a replacement product would
 * advertise the opposite of what `lib/smart/repair.ts` does.
 */
const RULES = [
  "What you can still sell comes first",
  "Anything delisted leaves the page",
  "Sold out stays, and says so",
  "Too much moved? It asks to be remade",
];

const STEPS = [
  { n: "01", title: "Say who is coming", body: "One sentence about the person, or the moment that sent them." },
  { n: "02", title: "popuup merchandises", body: "It reads your catalogue and chooses what belongs in this shop." },
  { n: "03", title: "Share the shop", body: "Behind a post, a creator, an email, a campaign. Anywhere the click starts." },
];

/**
 * The graphic family, drawn rather than imported. Two marks, used sparingly —
 * the same shape three times reads as a brand, eight different ones read as a
 * sticker sheet.
 */
function Burst({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 0l9 32 24-23-14 30 33-8-29 19 29 19-33-8 14 30-24-23-9 32-9-32-24 23 14-30-33 8 29-19-29-19 33 8-14-30 24 23z"
        fill="currentColor"
      />
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
  description:
    "The merchandising layer between social attention and your Shopify checkout. Tell popuup who is arriving; it reads your catalogue and builds the shop for them. No page builder.",
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
      <header className="bar">
        <img className="bar-mark" src="/brand/popuup.svg" alt="popuup" width={180} height={62} />
        <a className="btn btn-sm" href={ASK}>
          Get my shop made <span aria-hidden="true">→</span>
        </a>
      </header>

      {/* ------------------------------------------------------------ opening */}
      <section className="opening">
        <div className="opening-say">
          <p className="tag">
            <Burst className="tag-burst" />
            Merchandising for Shopify
          </p>

          <h1 className="shout">
            every click
            <br />
            deserves its
            <br />
            own <span className="shout-mark">shop.</span>
          </h1>

          <p className="lede">
            Tell popuup who is arriving. It reads your Shopify catalogue and builds the shop for them — products, order
            and copy included.
          </p>
          <p className="lede-sub">For posts, creators, campaigns, emails, ads. Whatever sent the click.</p>

          <a className="btn btn-lg" href={ASK}>
            Get my shop made <span aria-hidden="true">→</span>
          </a>
          <p className="note">Early access. Free while we make these with a small group of Shopify brands.</p>
        </div>

        {/*
          The mechanic, as one object: the sentence, what it was read as, and
          the shop that came out. Overlapping rather than side by side, because
          side by side is three pictures and overlapping is a claim about cause.

          The field is a figure and not an input. There is nothing behind it
          yet, and a box that swallows a sentence and does nothing is a worse
          first impression than an honest picture of one.
        */}
        <div className="stage" aria-label="A sentence, and the shop it produced">
          <Burst className="stage-burst" />

          <span className="device device-lg" aria-hidden="true">
            {/*
              One capture, three times, each clipped to a band and arriving a
              beat apart, so products appear row by row and every pixel stays
              the real renderer's output. A hand-drawn shop animating into
              place would be a picture of something nothing produced.
            */}
            <span className="screen">
              {[0, 1, 2].map((band) => (
                <img key={band} className="screen-band" src={`/press/shop-${LEAD.mood}.jpg`} alt="" width={780} height={1690} />
              ))}

              {/* The middle of the mechanic, and the part a finished mockup
                  hides: the sentence being turned into constraints. */}
              <span className="think">
                <span className="think-lead">Reading your catalogue</span>
                <span className="think-chips">
                  {LEAD.reads.map((chip) => (
                    <i key={chip}>{chip}</i>
                  ))}
                </span>
              </span>
            </span>
          </span>

          <figure className="prompt">
            <figcaption>Make a shop in a sentence</figcaption>
            <p>
              {LEAD.prompt.split(" ").map((word, index) => (
                // The space is a text node between the spans, not inside them:
                // a trailing space inside an inline-block is collapsed away,
                // and the sentence renders as onelongword.
                <span key={word + index}>
                  <span className="typed" style={{ "--w": index } as React.CSSProperties}>
                    {word}
                  </span>{" "}
                </span>
              ))}
              <span className="caret" aria-hidden="true" />
            </p>
            <span className="prompt-go" aria-hidden="true">
              Make it pop <Burst className="prompt-burst" />
            </span>
          </figure>
        </div>
      </section>

      {/* Why the click deserved better. Deliberately three lines — the visitor
          already felt this, and explaining it at length insults them. */}
      <section className="band why">
        <p className="why-line">
          A reel about linen and a gift search in December are not the same person. They land on the same page anyway.
          <Squiggle className="why-squiggle" />
        </p>
      </section>

      {/* -------------------------------------------------------------- proof */}
      <section className="band band-ink proof" aria-labelledby="proof-heading">
        <div className="proof-say">
          <h2 id="proof-heading" className="lead">
            Five sentences.
            <br />
            Five shops.
          </h2>
          <p className="lead-note">Same system underneath. Change the sentence, change the shop.</p>
          <p className="rail-note">
            Demo stores, so nobody&rsquo;s products are borrowed to sell something. The pages are the real renderer.
          </p>
        </div>

        {/* One large enough to read, four as evidence. Five equal thumbnails
            made the viewer study screenshots instead of seeing the point. */}
        <figure className="proof-lead">
          <span className="device">
            <img src={`/press/shop-${LEAD.mood}.jpg`} alt="Maison Verre, a shop generated by popuup" width={780} height={1690} loading="lazy" />
          </span>
          <figcaption>
            <span className="rail-brand">Maison Verre</span>
            <q>{LEAD.prompt}</q>
          </figcaption>
        </figure>

        {/*
          All five in the rail, lead included.

          On a phone the standalone lead above is hidden and this is the whole
          section — one shop at a time, swiped, which is how the comparison
          actually gets made on a small screen. On a wide one the lead sits
          beside its sentence instead and the first rail item steps aside, so
          neither width shows the same shop twice. The duplicate `img` is the
          same URL and costs one request between them.
        */}
        <ul className="rail">
          {[{ ...LEAD, brand: "Maison Verre" }, ...SHOPS].map((shop) => (
            <li key={shop.mood}>
              <figure>
                <span className="device">
                  <img src={`/press/shop-${shop.mood}.jpg`} alt={`${shop.brand}, a shop generated by popuup`} width={780} height={1690} loading="lazy" />
                </span>
                <figcaption>
                  <span className="rail-brand">{shop.brand}</span>
                  <q>{shop.prompt}</q>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {/* The one claim the two products a merchant will compare us against
          structurally cannot make. */}
      <section className="band band-purple negations" aria-labelledby="negations-heading">
        <h2 id="negations-heading" className="shout negations-heading">
          there is no
          <br />
          page builder.
        </h2>
        <ul className="pills">
          <li>No blocks to drag</li>
          <li>No template to pick</li>
          <li>No theme to configure</li>
          <li>No afternoon lost</li>
        </ul>
        <p className="negations-note">
          A campaign should not cost you an afternoon in a builder. Tell popuup who is coming. That is the brief.
        </p>
      </section>

      {/* Positioning as a place rather than an adjective. A layer means nothing
          without something named on each side — including the side we do not
          want, which is the checkout. */}
      <section className="band chain-band" aria-labelledby="chain-heading">
        <h2 id="chain-heading" className="lead">
          Between the tap
          <br />
          and the checkout
        </h2>
        <p className="lead-note">That gap is the whole job.</p>
        <ol className="chain">
          {CHAIN.map((link, index) => (
            <li key={link.name} data-ours={index === 1 ? "" : undefined}>
              <span className="chain-name">{link.name}</span>
              <p>{link.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/*
        Refresh, described in the tense it actually happens in.

        The tempting line is "set it once and it stays true", and it is one word
        away from claiming a connection that does not exist. A shop re-orders
        itself when the catalogue is read again, and reading it again is
        something a person starts. So the copy says that, and the demonstration
        below shows demotion rather than substitution — because the rules never
        add a product, and a picture of one being swapped in would advertise the
        opposite of what the code does.
      */}
      <section className="band band-purple keep" aria-labelledby="keep-heading">
        <div className="keep-say">
          <h2 id="keep-heading" className="shout keep-heading">
            not pages.
            <br />
            shops that keep up.
          </h2>
          <p className="keep-note">
            A page you built in March is still selling March. Read the catalogue again and the shop re-orders itself
            around what you can still sell — by rules you can read, not a model&rsquo;s opinion on the day.
          </p>
        </div>

        <div className="swap" aria-label="What a rebuild does when a product sells out">
          {/* No prices on these cards. The contrast being drawn is
              availability, and a number here would be a price on a page that
              sells nothing — which the honesty tests refuse, correctly. */}
          <div className="swap-row">
            <span className="swap-when">Before</span>
            <span className="swap-card is-out">
              Wrap Coat <em>Sold out</em>
            </span>
            <span className="swap-card">
              Linen Dress <em>In stock</em>
            </span>
          </div>
          <div className="swap-row">
            <span className="swap-when">Rebuilt</span>
            <span className="swap-card">
              Linen Dress <em>In stock</em>
            </span>
            <span className="swap-card is-out">
              Wrap Coat <em>Sold out</em>
            </span>
          </div>
          <ul className="rules">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------- creators and steps */}
      <section className="band creators" aria-labelledby="creators-heading">
        <div>
          <h2 id="creators-heading" className="lead">
            Give every creator
            <br />
            their <span className="lead-coral">own shop.</span>
          </h2>
          <p className="lead-note">
            Their picks. Their name. Their link. Your catalogue and checkout underneath.
          </p>
          <ul className="ticks">
            <li>Their audience</li>
            <li>Your products</li>
            <li>Their own address</li>
          </ul>
        </div>
        {/* The credit reproduced as markup rather than screenshotted, so it
            cannot drift from what a shop actually renders. */}
        <figure className="credit-sample">
          <span className="credit-brand">Maison Verre</span>
          <p className="credit-line">Chosen by Ana Ruiz</p>
          <figcaption>The credit a creator&rsquo;s shop carries, under the brand.</figcaption>
        </figure>
      </section>

      <section className="band steps" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="lead">
          How it goes
        </h2>
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="steps-end">
          That is it.
          <Squiggle className="steps-squiggle" />
        </p>
      </section>

      {/*
        The part a launch page usually leaves out, kept candid rather than
        apologetic. Saying the stage out loud costs nothing with the people
        worth having early, and saves the conversation where somebody arrives
        expecting a product.
      */}
      <section className="band band-lilac early" aria-labelledby="early-heading">
        <div>
          <h2 id="early-heading" className="lead">
            Where this is
          </h2>
          <p className="lead-note">
            Early, on purpose. We are making shops with a small number of Shopify brands to find out whether this is
            genuinely useful before building the rest of it.
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
        <p className="ledger-note">
          Free shops carry a small &ldquo;Made with popuup&rdquo; credit at the foot, in your own colours. Paid plans
          will remove it.
        </p>
      </section>

      <section className="band band-purple closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="shout closing-heading">
          your next post
          <br />
          deserves its own shop.
        </h2>
        <a className="btn btn-lg btn-coral" href={ASK}>
          Get my shop made <span aria-hidden="true">→</span>
        </a>

        <footer className="foot">
          <img className="bar-mark" src="/brand/popuup-light.svg" alt="popuup" width={132} height={45} />
          <span className="foot-line">Make a shop in a sentence.</span>
          <a href={`mailto:${INBOX}`}>{INBOX}</a>
        </footer>
      </section>
    </main>
  );
}
