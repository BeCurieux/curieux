# Brand and conversion audit (Phases 2 and 4)

**Scope note.** The public website (herlittleempire.com) and the live Gumroad store couldn't be reached from this session (AUDIT_REPORT §1). This audit covers what can be seen: Empire Studio's public pages (`/`, `/pricing`, `/terms`, `/privacy`), its sign-in and purchase flow, the catalogue, and the content register built from the founder's 68 product files (`content/REGISTER.md`). Website-specific questions are marked **UNVERIFIED**, not guessed.

## 1. The customer journey, step by step

| Step                      | What exists                                                                                                      | Verdict                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| First landing             | herlittleempire.com: UNVERIFIED. Empire Studio's `/` leads with Shopify launch software                          | The HLE customer (a woman starting a side income) and the Studio customer (a Shopify seller) aren't the same first visit |
| Understanding the offer   | Studio `/`: concrete list of outputs ("Positioning, ideal customer, palette…"), "How it works", "The honest bit" | Strong, specific, believable                                                                                             |
| Lead capture              | **None.** No email field anywhere in the app; Gumroad's free Fit Check collects emails on Gumroad                | Missing                                                                                                                  |
| Product page              | Studio `/pricing`; Gumroad listings (UNVERIFIED)                                                                 | Clear inclusions; no FAQ section, no preview images                                                                      |
| Checkout                  | Gumroad (merchant of record); app route `/api/billing/checkout` built                                            | **Not purchasable yet** (no Launch Pack product, no env vars)                                                            |
| Delivery and access       | Gumroad delivers files; the app grants access only from a verified sale                                          | Built and unit-tested; **no real purchase tested** (QA item 4)                                                           |
| Onboarding after purchase | Studio onboarding (business profile); no welcome email                                                           | Partial                                                                                                                  |
| Retention                 | Saved progress, version history, export                                                                          | Good for software; no email follow-up                                                                                    |

**Can a customer buy, receive and access a product today?** For the existing Gumroad downloads: probably yes (sold there already, UNVERIFIED today). For Empire Studio's paid tier, the FIT Finder full report via a past purchase, or the Ads course: **no** (GAP_ANALYSIS B2, B3, I1).

## 2. The brief's conversion questions

| Question                                               | Answer (evidence)                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the target customer immediately clear?              | **On Studio, yes but narrow** (Shopify sellers). **Across the brand, no**: kits address women earning "around school hours" (Income Fit Test), Studio addresses Shopify launches, the Ads course addresses small-budget Meta advertisers |
| Is the brand promise compelling and differentiated?    | **Yes.** "Make your own money. Know what you're getting into." (`src/content/brand.ts`, founder-approved 22 Oct 2026) is honest, specific and unlike the category's earnings-led promises                                                |
| Is the offer concrete and believable?                  | Studio: yes ("What Empire Studio is, and isn't"). Kits: yes per the register (worked examples, dated figures). Ads course: Module 1 only                                                                                                 |
| Homepage, product pages, checkout designed to convert? | Studio pages are clear but lack an FAQ, product previews and a visible "who it's for / not for" block. Checkout: Gumroad's (not controllable)                                                                                            |
| Products useful and differentiated?                    | The FIT Finder (scored, gated, dated plan, "not enough evidence" verdict) and the calculator are genuinely distinctive. The kits are practical; three starter kits overlap the planned ladder (GAP D2, D3)                               |
| CTAs, trust signals, credible FAQs?                    | CTAs clear ("Start free — no card", "Get the Launch Pack"). Trust: ABN and email in every footer, exact refund wording. FAQs: honesty section on `/`, none on `/pricing`. **No founder presence at all**                                 |
| Email capture, welcome, abandoned checkout?            | **None implemented** (GAP M1, M2)                                                                                                                                                                                                        |
| Analytics and conversion events?                       | First-party funnel events from landing view to verified purchase (`docs/ANALYTICS.md`); `/admin` dashboard. No ad-platform pixels (deliberate)                                                                                           |
| Testimonials, results, income claims genuine?          | **None exist and none are invented.** The claims guard blocks income claims in generated text and now in course content (`tests/unit/ads-content.test.ts`). Correct, but there's no process to collect real ones                         |
| Pricing, refunds, privacy visible?                     | Pricing page yes; refund sentence on terms and pricing; privacy page exists but is thin (GAP I5); all linked from the footer                                                                                                             |

## 3. Brand assessment

### What already makes it distinct (preserve)

1. **Evidence labels everywhere**: FACT / EST / UNKNOWN with dates, in the kits, the FIT report and the app. Almost nobody in this category does this; it is the brand's sharpest edge.
2. **"Not enough evidence" as a verdict** (Income Fit Test Day 14, carried into the Ads course): telling a woman she can't conclude yet, rather than "keep going, babe", is the anti-hype position made concrete.
3. **House rules enforced in code**: no PLR/MRR, MLM recruiting, income claims, fake scarcity or invented reviews (`src/lib/ai/guard.ts`).
4. **The voice**: plain, warm, a little dry ("A photo brief isn't a photo."; "Sidekick prompts are instructions, not magic.").
5. **Editorial type**: Bodoni Moda 800 headings, Lora numerals, Inter body, Caveat accents, self-hosted.

### Visual identity vs this brief's direction

| Brief asks for  | Current token (`src/app/globals.css`)                              | Gap                                                                                                                                     |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Warm cream      | `--ivory #f7f2e9`, `--paper #fffcf7`                               | Matches                                                                                                                                 |
| Blush           | `--blush #eacacb`, `--blush-soft #f5e3e1`                          | Matches                                                                                                                                 |
| Burgundy        | `--aubergine #43252c` (deep, brown-purple)                         | Close; reads aubergine rather than burgundy. Founder's call                                                                             |
| Charcoal        | `--charcoal #242122`, `--mute #564b4e`                             | Matches                                                                                                                                 |
| Restrained gold | **none**; the accent is `--rose #da5265` (bright, large text only) | **Different.** A gold accent would replace or sit beside rose. Needs founder approval (the brief says don't change branding without it) |

These tokens came from the founder's brand book (`content/REGISTER.md` §3 decision 9). **No change is recommended without her sign-off**; if she wants gold, add one token (for rules, numerals, small marks) and test contrast, rather than repainting.

### What makes it feel generic today

- **No single front door.** Three products with three audiences and two currencies (US$ kits, AUD course).
- **No founder at all.** "Faceless" is working as "anonymous". The brief wants faceless _without pretending the founder doesn't exist_: a named founder, a short story and credentials, with no face.
- **No proof yet.** No testimonials, case notes or public experiments. The honest alternative to hype testimonials is **published experiments**: "We spent A$150 on this ad; here are the numbers" — which the Ads course's calculator makes easy and on-brand.

### Founder credentials: a decision needed

This brief describes the founder as a non-practising barrister (England and Wales), Master's in Public Policy, background in policy and regulation. **Two earlier decisions point the other way:**

- the founder's own `README_FOR_CLAUDE_CODE.md` rule bans describing her as a lawyer, barrister or counsel near products (`content/REGISTER.md` §3, decision 4);
- on 23 Oct 2026 the founder chose to keep credentials off the Ads course (`docs/HLE_ARCHITECTURE_DECISIONS.md` AD-11).

If she now wants them used, suggested wording for an About page only (never product pages or lessons): _"Vee is a non-practising barrister (called to the Bar of England and Wales), with a Master's in Public Policy and a career in policy and regulation. She doesn't practise law, and nothing here is legal advice."_ **Before publishing, check the Bar Standards Board's current rules on how unregistered barristers may describe themselves** (UNKNOWN: not checked; outside sites unreachable here).

## 4. Positioning against the category

Maria Wendt, Natalie Ellis / BossBabe and Amy Porterfield are used only as reference points for the _category_. This session couldn't research them (network blocked), so nothing below describes their current content; it describes the **gap Her Little Empire can own**, from general knowledge of the online-business-education category (EST).

| Category norm (EST)                       | Her Little Empire's opposite (already true in the product)                  |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Earnings screenshots and "passive income" | Dated, labelled figures; income claims blocked in code                      |
| Personality-led: the founder's face sells | Faceless, editorial, product-led, with a named founder                      |
| Big signature course at a high price      | Small, specific tools from US$4 up; the course built on a calculator        |
| Urgency: cart closes, bonuses expire      | Evergreen, no countdowns, exact refund sentence                             |
| "Anyone can do this"                      | "Know what you're getting into": the FIT Finder tells some people _not yet_ |
| Community and recruitment loops           | Explicitly anti-MLM; nothing depends on recruiting                          |

**Recommended positioning line (for founder review):** _Practical, honest tools for women building their own income — with the numbers shown, the risks named and no one to recruit._

**Recommended single ladder** (replacing the brief's hypothetical ladder, using what exists):

1. **Free: the FIT Finder** (top three ideas; exists) + **free Ads Profitability Calculator** (engine exists) → email capture.
2. **Entry: existing kits** (US$4–29) and bundles.
3. **Core: Ads That Actually Sell** (once complete) and the **Empire Studio Launch Pack** for those going to Shopify.
4. **Later, with evidence: membership / Academy** (P3).

## 5. Conversion improvements, in order of impact

1. One front door with an email field (FIT Finder or calculator → list).
2. A five-email welcome sequence (copy exists in the Ads plan as a deliverable; adapt).
3. An About block: named founder, no face, credentials only as approved.
4. `/pricing` FAQ: what you get, what you don't, refunds, "will this make me money?" answered honestly.
5. Product previews (real screenshots of the tool, never mock results).
6. One published honest experiment as the first proof.
7. Real-testimonial collection: a post-purchase email asking permission, quoting exactly.
