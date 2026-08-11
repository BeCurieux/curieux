# Shopfront — Founding Brief v2

**Company thesis:** Make a shop in a sentence.
**First wedge:** Turn your bio into a shop.
**Internal north star:** There is no page builder. The prompt is the builder.
**Date:** August 2026 · Sounding Labs

---

## Product truth

**A store for every audience, made in seconds.**

Connect Shopify once. Describe who you're selling to or what you're promoting. The product selects, merchandises and designs a beautiful live mini-shop from your existing catalogue — and keeps it synced automatically.

The first wedge is the social bio: instead of sending Instagram and TikTok traffic to a generic homepage or a pile of links, give it a purpose-built shop.

The same primitive repeats without new features:

- `Make a clean bio shop featuring our bestseller, new drop and everything under $80.`
- `Make a Mother's Day edit under $150.`
- `Make one for Jess using her five favourite products and JESS15.`

Carrd's primitive was the page. Ours is the **shop**.

## The honest competitive picture

This is not white space. It is validated demand with an under-served extreme.

- **Linktree** has offered Shopify Stores since 2022; connected collections auto-update, and it now runs a dedicated social-commerce product. But commerce is bolted onto a links product, generically templated, inside a company optimised for 50M general creators.
- **LoudCrowd and Superfiliate** prove creator storefronts work at scale (LoudCrowd claims 12,400+ live storefronts, $420M+ creator GMV; boohoo deployed storefronts to thousands of creators). But these are heavyweight creator-marketing systems — sales-led, programme-oriented, priced and built for brands running creator operations.
- **Replo, GemPages, PageFly** own the "powerful page builder" end for Shopify.

**The open position is the simple extreme:** absurdly self-serve, gorgeous by default, AI-merchandised, priced for any Shopify merchant, with no builder to learn. Nobody occupies "the Carrd of commerce pages." Carrd itself never had white space either — it had a hundred competitors and won the simplicity extreme. Same play, one layer up.

The strategy sentence: **we're taking a capability currently sold inside heavyweight creator-commerce software and making it available to every Shopify merchant in thirty seconds.**

## The killer feature is merchandising, not syncing

Anyone can sync products. The promise is: **you don't build the shop — you describe who it's for.**

`This is for people coming from our TikTok about hormonal acne. Keep it to a three-step routine, nothing over $60, lead with the serum.`

The system understands the catalogue, selects the products, orders them, pulls the best imagery, writes the merchandising copy, applies the offer, designs the page, publishes. AI is not a copywriting button; it is the thing that eliminates page-building.

**After generation, editing is words too** — with one engineering caveat taken seriously. Open-ended natural-language editing against arbitrary page state is where trust goes to die ("make the hero smaller" doing something weird twice is fatal when there's no manual editor to fall back on). So V1 constrains it: prompts map to a defined set of legal moves within a tight design system — reorder, resize within steps, feature/hide, swap imagery, adjust tone, filter (e.g. in-stock only) — plus minimal direct manipulation (drag to reorder, tap to hide/swap). The constraint is the product philosophy anyway: there is no builder to leak into.

**Discipline test for every future feature:** does this add a builder? Then no.

## Five pillars

1. **Commerce-native.** Live inventory, variants, reviews, discounts, collections, drops and (paid tier) back-in-stock are the product, not integrations.
2. **Beautiful automatically.** Editorial mini-shops, not stacked buttons. Design taste is a durable edge against both Linktree's genericism and the enterprise tools' utility.
3. **AI merchandising.** The core feature, per above.
4. **Creator shops — in V1.** "Make another shop → for a creator": name, photo or video, products, unique code, publish. Nearly the same object as the brand shop, so it costs little to include — and it lets us test the brand-bio market and the creator-shop market simultaneously without building two products. The demo it unlocks — **one Shopify catalogue → twenty different shops in seconds** — is the strongest demo the product has. What V1 does *not* include is creator programme management; that's LoudCrowd's territory and a later decision, not the founding thesis.
5. **Constantly live.** Sell-outs, price changes, new reviews and drop launches reflect automatically. The reason this beats a Canva/Carrd/Lovable export, forever.

## Scope

**V1:** Shopify connect → catalogue import → shop generated from one prompt → product cards, hero video/image, collections, reviews, discount code, email capture → word-editing (constrained) → creator shops (single) → custom URL → publish → mobile-first → **funnel analytics** (below).

**First paid-tier additions, deliberately deferred:** back-in-stock notifications, SMS capture (compliance weight), deeper analytics. These carry infrastructure cost and are exactly what's worth gating at the paid tier.

**Not building:** a visual page builder, A/B testing, affiliate programme management, CRM, email platform, an integrations zoo.

**Checkout:** one tap → pre-filled Shopify checkout via cart permalink. Do not promise fully on-page checkout; the permalink delivers the feeling without the payments trap.

## Metrics: the product's claim, measured

The claim is "sell products," so page views alone are unacceptable. V1 measures the funnel:

**Views → product clicks → checkout starts** — with attributable orders/revenue as soon as Shopify attribution makes it practical.

This is not analytics scope creep; it is the answer to the first retention-deciding question every merchant will ask: *"Is this actually better than sending everyone to my store?"* If we can't answer it with their own numbers, we lose them.

## Model and growth loop

- **Free:** full shop with a small "made with" badge. Badges on live merchant shops are the marketing budget.
- **Pro ~$15–19/mo:** remove badge, custom domain, pixels/UTMs, Klaviyo capture, back-in-stock, SMS.
- **Later:** multi-shop/creator tiers ($99–299/mo) once a brand runs many shops; possibly attribution-based pricing when GMV data supports it.
- **Distribution:** Shopify App Store (compounding installs and reviews, legible to acquirers) plus the badge loop.

Merchant economics beat creator-tool economics: the page produces trackable revenue, so free→paid conversion and retention should both outperform the Linktree model.

## Acquisition thesis (no price predictions)

Buyers who plausibly care, and why: **Linktree** (commerce conversion is its structural weakness; proven consolidator), **creator-commerce platforms and Later-types** (the Mavely deal shows creator→sale attribution commands premiums), **Klaviyo** (every shop is a list-growth surface), **Wix** (proven buyer of solo AI-native builders), **Shopify** (platform risk first, acqui-hire second), **Canva/Lovable** (generation-tech angle).

Rather than forecasting exit prices, the brief commits to accumulating the **strategic assets a buyer would price:**

- merchant installs and active live shops
- attributable GMV through shops
- creator shops live, and shops-per-brand
- organic install rate from published-shop badges
- merchandising and conversion data (which prompts, layouts and orderings convert)

If those compound, the exit takes care of itself; if they don't, no forecast would have saved it.

## Risks

- **Incumbent bundling:** Linktree deepens commerce, or Shopify revives a Linkpop successor. Mitigation: speed, App Store position, and owning the no-builder extreme they'd have to *un-build* toward.
- **Platform dependency:** Shopify API terms and app review timelines.
- **Word-editing trust:** constrained scope in V1; expand the legal-move set only as reliability proves out.
- **Willingness to pay above Linktree-free:** unvalidated until the kill-test.

## The kill-test (before OAuth is built)

The generation flow runs on public storefront data — no app approval needed to demo. So:

**Thirty Shopify brands, over-indexed on former Linkpop users and active bio-link users. Generate a genuinely excellent shop for each — not a mock, their real products, imagery and reviews. DM the actual link:**

> *"I made this from your Shopify store — it goes live and stays synced the moment you connect. Want it for your Instagram bio?"*

(Phrasing matters: it isn't synced *yet*, and we don't claim it is. First contact under our own name in our own ecosystem starts honest.)

**Measure the funnel:** opened → replied → asked to connect → published → asked price / paid.

- **Proceed:** 5+ of 30 actively wanting it live. Any unprompted "how much?" is gold.
- **Kill:** polite silence. Kill quickly rather than rationalise — the whole point of a two-week, near-zero-cost test is that a "no" is cheap now and expensive after four weeks of OAuth plumbing.

**Post-launch double-down trigger:** ~1,000 published shops with badges driving >30% of new installs.
