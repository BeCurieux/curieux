# The App Store submission

Everything the Shopify App Store listing and review need that can be written
down ahead of time. **Submit only after** the stage 4 runbook in
SHOPIFY-APP.md passes end to end, the name has cleared its trademark search (BRIEF.md §11 item 1b),
and counsel has seen the two things below marked *counsel*.

The listing copy below was run through `pnpm scan` against all three packs and
reads **100/100, clear**. The first draft did not: "the EU's new green-claims
rules" tripped the ACCC generic-green rule, so it was reworded. Rescan after
any edit — a claims scanner whose own listing trips its own rules is a
screenshot nobody at Tildie wants to see.

---

## Listing

Shopify's guidance, as read on 2026-09-28
(https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices):
screenshots 1600×900, three to six, at least one of the app's own UI, no
pricing, reviews or outcome guarantees in them; an introduction of at most 100
characters, tied to a merchant benefit, no data claims.

**App name:** Tildie — subject to the trademark search in BRIEF.md §11 item 1b. Unique across the App Store.

**Introduction** (90 characters):

> Check product-page claims against advertising rules, and show a mark where they read well.

**Details:**

> Tildie reads the words on each of your product pages — titles, descriptions, the line shoppers see on Google — and checks them against the advertising rules of the markets you sell into: Australia, the United States and the European Union. Every note names the rule behind it and explains what draws attention, so you can fix a phrase in a minute instead of guessing.
>
> Pages that read well can carry the Claims Verified mark, which states the markets and the month they were reviewed. When a page's wording changes, the mark steps aside until Tildie has read it again, so it only ever sits on words that were checked.
>
> Tildie is an opinion about language, not legal advice. It cannot see your evidence, and it does not replace a qualified adviser.


**Feature list:**

- Every product scored, weakest first, with the rule behind each note.
- Australia, United States and European Union rules, including the EU's new rules on environmental wording.
- A mark for pages that read well, added from the theme editor with no code.
- Automatic rereads when you edit a product, so the mark never outlives your words.

**Pricing:** Shopify App Pricing, monthly — Starter $49 (50 products, one
market), Growth $99 (250 products, three markets), Studio $199 (every product,
every market). Plan handles `starter`, `growth`, `studio`. Set in the Partner
Dashboard, never in the listing text.

**Categories and search terms:** store management / compliance-adjacent is the
closest fit; confirm the current category list in the submission form. Search
terms to try: *product claims, ad copy, greenwashing, EU green claims, TGA,
FTC, product description checker*.

**Screenshots to make** (from the development store in stage 4, 1600×900):

1. The product list: every product scored, weakest first.
2. One product's reading, with the rule named under a flagged phrase.
3. The markets chooser.
4. A product page on the storefront carrying the mark (paper).
5. The same on a dark theme (night).

**Feature media:** optional. If made, a short promotional video, screencast at
most a quarter of it, or one static 1600×900 image.

**Demo store:** the stage 4 development store, linking straight to a product
page that carries the mark.

---

## Review requirements, and where each is met

| Requirement | Where |
|---|---|
| Mandatory compliance webhooks, answered; bad HMAC → 401 | `src/server/handlers.ts` `handleWebhook`; tested; stage 4 step 6 |
| Embedded app authenticates with session (ID) tokens | `src/server/session.ts`; App Bridge from Shopify's CDN |
| Only the scopes the app uses | `read_products`, and `write_app_proxy` for the badge proxy — nothing else |
| Charges through Shopify | Shopify App Pricing; the app never creates a charge |
| Storefront content without editing theme code | the `claims-mark` theme app extension (an app block) |
| Storefront performance | one lazy-loaded image per product page, an SVG of a few kilobytes, cached for a minute |
| Privacy policy URL | **owner** — publish PRIVACY.md (after counsel) on the brand's site |
| Support email and emergency contact | **owner** — in the Partner Dashboard |
| App icon 1200×1200 | **owner** — design, after the name |

The full, current list is Shopify's own and changes; walk it in the submission
form's automated checks rather than trusting this table
(https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements).

---

## Instructions for the reviewer

Paste into the submission form's testing instructions, with the demo store's
details filled in:

> Install the app and choose any plan (development stores are not charged).
> Choose one or more markets and press **Scan my store**. Every product is
> listed with a score, weakest first; the product "[loud product]" is flagged
> and names the rule behind each note.
>
> To see the storefront mark: Online Store → Themes → Customize → product
> template → Add block → Apps → **Claims mark** → Save. Open "[clean product]"
> on the storefront: the mark shows. Edit its description and save; within a
> few seconds the mark leaves that page until the app has read the new wording.
>
> The app reads products only (`read_products`). It holds no customer data.

---

## For counsel

1. **"Claims Verified" on the mark.** Kept by the owner over "Claims reviewed"
   (CLAUDE.md, the card rules). A merchant's shoppers will read it; "verified"
   can suggest an outside body checked. The line under it says what happened —
   reviewed against these markets, this month — and the mark can never say
   approved, certified, compliant or safe (tested). Decide before listing.
2. **PRIVACY.md.** A draft, written from what the code does. Needs a lawyer's
   read and the business's legal details before it is published.

---

## Not in this submission

- **The hosted score page.** The mark links nowhere, because the public page
  it would link to is still shut (CLAUDE.md). When it opens, the badge's
  `href` is one argument away.
- **The iPhone app** (BRIEF.md §4) — separate, later, free.
