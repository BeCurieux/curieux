/**
 * The front door.
 *
 * Rebuilt against the owner's reference boards, which asked for a conventional
 * marketing site — cream ground, white cards, two-tone serif headline, numbered
 * steps with arrows between them, an icon row, a closing diagram — instead of
 * the stack of full-bleed colour bands that was here. The layout is theirs
 * almost line for line.
 *
 * What did not come across is every invented fact on them, and it is worth
 * naming them once so this is a decision on the record rather than an omission:
 * the logo wall, the star rating, the "Trusted by 1,000+ stores", the analytics
 * card reading "426 products · Live and syncing", the "Always live" feature,
 * and the plan cards with a Start-for-free button. popuup has no merchants to
 * count, no reviews, nothing that syncs, and no billing. Each of those slots
 * still exists in the page; each holds something true instead:
 *
 *   logo wall            → five real shops off one catalogue, linked
 *   "Always live"        → rebuilt when you ask, which is what the code does
 *   "Trusted by N"       → the ledger of what is and is not built
 *   analytics card       → the sentence being read, which is the actual middle
 *   "Always in stock"    → sold-out shown and marked, which is the product rule
 *
 * The mechanic in the opening is the strongest thing on the boards and it is
 * reproduced whole: the post, the sentence, the shop, with arrows between. A
 * phone on its own shows an outcome, and the outcome is not the surprising
 * part — the surprising part is that the middle panel is all the work there is.
 *
 * Everything in it is real output except the post card, which is our own demo
 * brand's photograph in a card drawn here. Nobody's actual post is borrowed and
 * the card says "demo" on it. The sentence is the demo config's own, and the
 * phone is `pnpm press` output from the shop that sentence produced — so a
 * change to the renderer shows up here without anybody redrawing anything.
 */

import type { Metadata } from "next";
import { HOME } from "@/lib/origin";
import { displayWonk } from "./fonts";
import { SiteBar, SiteFoot, ASK } from "./chrome";
import "./landing.css";

/**
 * The shop in the opening, and the sentence that produced it.
 *
 * `hero.jpg` is `edit-ibiza` framed on a product grid rather than on the top of
 * the page — a full-bleed hero fills a phone viewport entirely, so a capture
 * from the top of the document is a photograph of one product, which
 * demonstrates nothing about merchandising.
 */
const LEAD = {
  shot: "/press/hero.jpg",
  prompt: "the Ibiza edit \u2014 swim first, linen next, nothing over 180",
  /**
   * The demo brand's own photograph, in a post card drawn here.
   *
   * An on-body shot rather than a flat-lay, because this panel is standing in
   * for somebody's reel. A product cut-out in an Instagram card reads as an
   * advert, which is the thing the shop is downstream of, not the thing that
   * produced the click.
   */
  post: "/demo/casa-lino/linen-trouser.jpg",
};

/**
 * Five edits, one catalogue.
 *
 * Five real generations from a single ingest — same brand, same eight products
 * underneath, five sentences. Not five demo brands standing in for the idea,
 * which proves something weaker: that the template flexes across merchants,
 * rather than that the merchandising flexes across audiences.
 */
const EDITS = [
  { slug: "edit-ibiza", title: "The Ibiza edit", prompt: "swim first, linen next, nothing over 180", n: 6 },
  { slug: "edit-escape", title: "The February suitcase", prompt: "for someone going somewhere hot in February", n: 7 },
  { slug: "edit-wedding", title: "A wedding abroad", prompt: "for a wedding abroad, and I am a guest", n: 7 },
  { slug: "edit-budget", title: "Under 80", prompt: "everything under 80", n: 4 },
  { slug: "edit-sale", title: "What is left", prompt: "what is left, cheapest first", n: 7 },
];

/**
 * Counts for the prose, taken from the labels rather than typed again.
 *
 * The paragraph argues from these numbers, and they were typed by hand once. A
 * regeneration moved one shop from seven products to five and the sentence went
 * on saying seven, beside a label that said five, above a screenshot showing
 * five. `tests/marketing.test.tsx` checks every label against its fixture, so
 * reading the prose off the same array means one check covers both.
 */
const pieces = (slug: string): number => EDITS.find((edit) => edit.slug === slug)!.n;

const STEPS = [
  {
    n: "1",
    title: "You say who it's for",
    body: "One sentence about the post you're linking from. No brief, no form to fill in.",
  },
  {
    n: "2",
    title: "We build the shop",
    body: "We read your catalogue, pick the products that fit, then order and write them.",
  },
  {
    n: "3",
    title: "The link goes in the post",
    body: "A bio, a story, an email, an ad. It sends people to your own Shopify checkout.",
  },
];

/**
 * The four things a merchant gets, and the two the boards got wrong.
 *
 * "Always live — products, prices and stock stay in sync" is the first tile on
 * the reference, and nothing in popuup syncs with a store; a shop is rebuilt
 * when somebody asks for it. "More sales" is the third, and we have run no kill
 * test yet, so it is a number we do not have. Both slots are kept and both say
 * what the code does.
 */
const GAINS: { title: string; body: string; key?: string; icon: React.ReactNode }[] = [
  {
    key: "builder",
    title: "No page builder",
    body: "Nothing to drag, no template to choose, no theme to configure. You write a sentence.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.6" />
        <path d="M14.5 20.5l7-7M14.5 13.5l7 7" />
      </>
    ),
  },
  {
    title: "One shop per audience",
    body: "A reel, a creator, a campaign, a clearout. Each one gets products picked for it.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 5.5a3.2 3.2 0 0 1 0 5.2M18 20a6 6 0 0 0-3-5.2" />
      </>
    ),
  },
  {
    title: "Rebuilt when you ask",
    body: "Read the catalogue again and the shop reorders itself around what you can still sell.",
    icon: (
      <>
        <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
        <path d="M20.5 4v5h-5" />
      </>
    ),
  },
  {
    title: "Straight to your checkout",
    body: "The cart is a Shopify permalink, pre-filled. We never touch payments and never own the customer.",
    icon: (
      <>
        <path d="M5.5 8h13l-1.1 11.2a1.6 1.6 0 0 1-1.6 1.4H8.2a1.6 1.6 0 0 1-1.6-1.4Z" />
        <path d="M8.8 8V6.2a3.2 3.2 0 0 1 6.4 0V8" />
        <path d="M9.6 13.6l1.9 1.9 3.4-3.6" />
      </>
    ),
  },
];

/**
 * What a rebuild does about stock, in the words the rules actually use.
 *
 * The sold-out line is the one to guard. The rule demotes; it does not hide and
 * it does not substitute — a line promising a replacement product would
 * advertise the opposite of what `lib/smart/repair.ts` does.
 */
const RULES = [
  "What you can still sell comes first",
  "Products you’ve deleted drop off the page",
  "Sold-out ones stay, and say so",
  "If too much has changed, we ask first",
];

/**
 * The ledger, which is where the reference boards put a logo wall.
 *
 * A wall of merchants we do not have is the commonest lie on a launch page.
 * This is the honest thing in the same slot and it does the same job: it is the
 * section a sceptical reader is looking for, and being told what is not built
 * buys more trust than eight grey wordmarks would.
 */
const LEDGER = [
  { on: true, text: "Real shops, from your real catalogue" },
  { on: true, text: "Your Shopify checkout, untouched" },
  { on: true, text: "Creator-credited shops and rebuilds" },
  { on: false, text: "Onboarding is by hand, one at a time" },
  { on: false, text: "No accounts and no billing yet" },
  { on: false, text: "Nothing syncs with your store on its own" },
];

/* ------------------------------------------------------------------ marks */

/**
 * Two marks and three arrows, drawn rather than imported.
 *
 * Used sparingly: the same shape three times reads as a brand, eight different
 * ones read as a sticker sheet.
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
    <svg className={className} viewBox="0 0 160 16" fill="none" aria-hidden="true">
      <path
        d="M3 11c18-9 30 5 48-1s28-8 44-1 26 6 62-4"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Solid, coral, between the three panels of the mechanic. */
function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 16" fill="none" aria-hidden="true">
      <path d="M1 8h36" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 2.5L38.5 8 32 13.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dashed, purple, between the numbered steps. */
function DashArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 16" fill="none" aria-hidden="true">
      <path d="M2 8h52" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M50 3l6 5-6 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(HOME),
  title: "popuup — your post deserves its own shop",
  description:
    "Write one sentence about the post you're linking from, and get a small shop built from your Shopify catalogue with just the products that match it. No page builder.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "popuup",
    description: "Your post deserves its own shop.",
    url: HOME,
    images: [{ url: "/press/og.jpg", width: 1200, height: 630 }],
  },
};

export default function Landing() {
  return (
    <main className={`landing ${displayWonk.variable}`}>
      <SiteBar />

      {/* ------------------------------------------------------------ opening */}
      <section className="opening">
        <div className="opening-say">
          <p className="tag">
            <Burst className="tag-burst" />
            Merchandising for Shopify
          </p>

          <h1 className="shout opening-head">
            Your post deserves its <span className="shout-mark">own shop.</span>
            <Squiggle className="opening-squiggle" />
          </h1>

          {/*
            The example is the copy, not decoration around an explanation.

            An earlier draft opened with "Tell popuup who is arriving", and the
            owner's reaction is the reason it went: *what does that mean?* It is
            a metaphor about guests at a house, and it is abstract in the one
            place that can least afford it. Nobody types a person into a box.
            They type a sentence about a post they are linking from.
          */}
          <p className="lede">
            You post a reel about linen shirts. The link in your bio goes to a homepage with four hundred products on
            it.
          </p>
          <p className="lede-sub">
            Write one sentence instead and we&rsquo;ll build a small shop from your Shopify catalogue — just the
            products that fit, in an order that makes sense, with words that match the post.
          </p>

          <div className="opening-do">
            <a className="btn btn-lg" href={ASK}>
              Get my shop made <span aria-hidden="true">→</span>
            </a>
            <a className="btn btn-lg btn-ghost" href="/examples">
              See real ones
            </a>
          </div>

          <ul className="ticks">
            <li>No page builder</li>
            <li>Sold-out shown, not hidden</li>
            <li>Your Shopify checkout</li>
          </ul>

          <p className="note">
            Free while we&rsquo;re building these by hand with a small group of Shopify brands. No account, no card.
          </p>
        </div>

        {/*
          The mechanic, as one object: the post, the sentence, and the shop that
          came out. Arrows rather than a row, because a row is three pictures
          and an arrow is a claim about cause.
        */}
        <div className="opening-fig">
        <div className="mech" aria-label="A post, the sentence written about it, and the shop that came out">
          <figure>
            <figcaption>The post</figcaption>
            <div className="mech-post">
              <img src={LEAD.post} alt="Wide linen trousers, photographed for the demo brand Casa Lino" width={1200} height={1500} />
              {/*
                The place in this caption has to be the place in the sentence
                beside it. It said Formentera while the sentence said Ibiza,
                which quietly broke the only thing the three panels claim: that
                this post produced that sentence, which produced that shop. Two
                islands is two unrelated pictures with arrows drawn between
                them.
              */}
              <span className="mech-post-say">
                <b>The linen we wore all week in Ibiza.</b>
                <span>Shot on the last morning, before the wind got up.</span>
                <em>Demo brand</em>
              </span>
            </div>
          </figure>

          <Arrow className="mech-arrow" />

          <figure>
            <figcaption>The sentence</figcaption>
            {/*
              A figure and not an input. There is nothing behind it, and a box
              that swallows a sentence and does nothing is a worse first
              impression than an honest picture of one. The real field is on
              `/contact`, which is where the button above goes.
            */}
            <div className="mech-prompt">
              <Burst className="mech-prompt-burst" />
              <p>
                {LEAD.prompt.split(" ").map((word, index) => (
                  // The space is a text node between the spans, not inside
                  // them: a trailing space inside an inline-block collapses
                  // away and the sentence renders as onelongword.
                  <span key={word + index}>
                    <span className="typed" style={{ "--w": index } as React.CSSProperties}>
                      {word}
                    </span>{" "}
                  </span>
                ))}
                <span className="caret" aria-hidden="true" />
              </p>
            </div>
          </figure>

          <Arrow className="mech-arrow" />

          <figure className="mech-shop">
            <figcaption>The shop</figcaption>
            <Burst className="mech-burst" />
            <span className="device">
              <img src={LEAD.shot} alt="The Ibiza edit, the shop popuup generated from that sentence" width={780} height={1690} />
            </span>
          </figure>
        </div>

          <span className="stick">
            Different post.
            <br />
            Different shop.
          </span>
        </div>
      </section>

      {/* -------------------------------------------------------- three steps */}
      <section className="band band-paper" aria-labelledby="steps-heading">
        <div className="band-top">
          <h2 id="steps-heading" className="lead">
            Three steps. One sentence each.
          </h2>
          <p className="lead-note lead-note-dark">
            There is no fourth step. That is the entire product, and it is why there is nothing to learn.
          </p>
        </div>

        <ol className="howto">
          {STEPS.map((step, index) => (
            <li key={step.n}>
              <span className="howto-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>

              {index === 0 && (
                <span className="howto-fig">
                  <q>the Ibiza edit — swim first, linen next, nothing over 180</q>
                </span>
              )}
              {index === 1 && (
                <span className="howto-fig howto-mini">
                  <img src="/demo/casa-lino/bikini-top.jpg" alt="" width={1200} height={1500} loading="lazy" />
                  <img src="/demo/casa-lino/linen-shirt.jpg" alt="" width={1200} height={1500} loading="lazy" />
                  <img src="/demo/casa-lino/raffia-tote.jpg" alt="" width={1200} height={1500} loading="lazy" />
                </span>
              )}
              {index === 2 && (
                <span className="howto-fig">
                  <b>casalino.popuup.shop/ibiza</b>
                </span>
              )}

              {/* Positioned out of the step it belongs to. An <svg> is not a
                  legal child of <ol>, and a decorative <li> would make a list
                  of three read as a list of five. */}
              <DashArrow className="howto-link" />
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- what you get */}
      <section className="band" aria-labelledby="gains-heading">
        <div className="band-top">
          <h2 id="gains-heading" className="lead">
            What you actually get
          </h2>
        </div>
        <ul className="gains">
          {GAINS.map((gain) => (
            <li key={gain.title} data-key={gain.key}>
              <span className="gain-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {gain.icon}
                </svg>
              </span>
              <h3>{gain.title}</h3>
              <p>{gain.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------------- proof */}
      {/*
        The claim the whole product rests on, and the reason these five shops
        share a colourway.

        A version with five differently-coloured phones would be a better poster
        and a worse promise: five accents off one catalogue means popuup
        repainting a merchant's brand per audience, which is the exact failure
        the colour rule exists to prevent. What changes is what is in the shops.
        What does not change is whose shop it looks like.
      */}
      <section className="band band-ink" aria-labelledby="proof-heading">
        <div className="band-top">
          <h2 id="proof-heading" className="lead">
            One catalogue. Five shops.
          </h2>
          <p className="lead-note">
            All five sell the same eight products. One sentence each, and they come out completely different:{" "}
            {pieces("edit-budget")} pieces when the sentence caps the price, {pieces("edit-escape")} for a February
            suitcase, and a wedding shop that opens with the one dress that is sold out — marked, not dropped.
          </p>
        </div>

        <ul className="rail">
          {EDITS.map((edit) => (
            <li key={edit.slug}>
              <figure>
                <span className="device">
                  <img
                    src={`/press/${edit.slug}.jpg`}
                    alt={`${edit.title}, generated by popuup`}
                    width={780}
                    height={1690}
                    loading="lazy"
                  />
                </span>
                <figcaption>
                  <span className="rail-brand">
                    {edit.title} <em>{edit.n} pieces</em>
                  </span>
                  <q>{edit.prompt}</q>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <p className="rail-note">
          The colour never changes, because it&rsquo;s still one brand and it isn&rsquo;t ours to repaint. The
          lettering can: the clearance shop set itself in a mono face, which is a decision about that shop&rsquo;s job
          rather than about the brand. This is a made-up shop rather than a real merchant&rsquo;s, so we&rsquo;re not
          borrowing anyone&rsquo;s products to sell you something — but the shops are real, built by the same code
          yours would be. <a href="/examples">Open any of them</a>.
        </p>
      </section>

      {/* The one claim the two products a merchant will compare us against
          structurally cannot make. */}
      <section className="band band-purple negations" aria-labelledby="negations-heading">
        <h2 id="negations-heading" className="shout">
          There is no page builder.
        </h2>
        <ul className="pills">
          <li>No blocks to drag</li>
          <li>No template to pick</li>
          <li>No theme to configure</li>
          <li>No afternoon lost</li>
        </ul>
        <p className="negations-note">
          A campaign shouldn&rsquo;t cost you an afternoon of dragging blocks around. Write the sentence, get the shop.
          That&rsquo;s the whole job.
        </p>
      </section>

      {/* ------------------------------------------------------- two more things */}
      <section className="band" aria-labelledby="duo-heading">
        <div className="band-top">
          <h2 id="duo-heading" className="lead">
            Two things a page can&rsquo;t do
          </h2>
        </div>

        <div className="duo">
          {/*
            Refresh, described in the tense it happens in.

            The tempting line is "set it once and it stays true", which is one
            word away from claiming a connection that does not exist. A shop
            reorders itself when the catalogue is read again, and reading it
            again is something a person starts.
          */}
          <article>
            <h3>Shops that keep up</h3>
            <p>
              A page you built in March is still selling March. Ask for a rebuild and the shop reorders itself around
              what you can actually still sell. The rules are fixed and written down — not a model&rsquo;s opinion on
              the day.
            </p>

            <div className="swap" aria-label="What a rebuild does when a product sells out">
              {/* No prices on these cards. The contrast is availability, and a
                  number here would be a price on a page that sells nothing. */}
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
                <span className="swap-mark">Moved down, not hidden</span>
              </div>
            </div>

            <ul className="rules">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>

          <article>
            <h3>A shop per creator</h3>
            <p>
              Their picks and their name, on their own link — running on your catalogue and your checkout. The credit
              sits under the brand, in the brand&rsquo;s own colours, and it is recorded when the shop is published
              rather than inferred from anything.
            </p>
            <figure className="credit-sample">
              <span className="credit-brand">Maison Verre</span>
              <p className="credit-line">Chosen by Ana Ruiz</p>
            </figure>
            <ul className="ticks">
              <li>Their audience</li>
              <li>Your products</li>
              <li>Their own link</li>
            </ul>
          </article>
        </div>
      </section>

      {/*
        The part a launch page usually leaves out, kept candid rather than
        apologetic. Saying the stage out loud costs nothing with the people
        worth having early, and saves the conversation where somebody arrives
        expecting a finished product.
      */}
      <section className="band band-paper" aria-labelledby="early-heading">
        <div className="band-top">
          <h2 id="early-heading" className="lead">
            Where this actually is
          </h2>
          <p className="lead-note lead-note-dark">
            Early, on purpose. We&rsquo;re making shops with a handful of Shopify brands to find out whether they&rsquo;re
            genuinely useful before building the rest of it.
          </p>
        </div>

        <ul className="ledger">
          {LEDGER.map((line) => (
            <li key={line.text} data-on={line.on ? "" : undefined}>
              {line.text}
            </li>
          ))}
        </ul>

        <p className="ledger-note">
          Free shops carry a small &ldquo;Made with popuup&rdquo; credit at the foot, in your own colours. Paid plans
          will remove it — <a href="/pricing">what that will cost</a>.
        </p>
      </section>

      {/* ------------------------------------------------------------ closing */}
      <section className="band band-lilac closing" aria-labelledby="closing-heading">
        <div className="closing-say">
          <h2 id="closing-heading" className="shout closing-heading">
            Your catalogue. <span className="shout-mark">Every audience.</span>
          </h2>
          <p className="lead-note lead-note-dark">
            Send your store and a sentence about who the shop is for. If your storefront is public we can read its
            product feed without you installing anything.
          </p>
          <div className="closing-do">
            <a className="btn btn-lg" href={ASK}>
              Get my shop made <span aria-hidden="true">→</span>
            </a>
            <a className="btn btn-lg btn-ghost" href="/pricing">
              See pricing
            </a>
          </div>
        </div>

        {/* Catalogue in, shops out — the diagram from the board, with its
            invented product photographs replaced by shots we already ship. */}
        <div className="flow" aria-label="One catalogue in, a shop per audience out">
          <span className="flow-node">Your catalogue</span>
          <DashArrow className="flow-arrow" />
          <span className="flow-out">
            {EDITS.slice(0, 3).map((edit) => (
              <a key={edit.slug} href={`/preview/${edit.slug}`}>
                <img src={`/press/${edit.slug}.jpg`} alt="" width={780} height={1690} loading="lazy" />
                {edit.title}
              </a>
            ))}
          </span>
        </div>

        <SiteFoot />
      </section>
    </main>
  );
}
