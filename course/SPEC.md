> **Where this lives (repo note, 2026-11-02).** The spec below is the founder's
> document, saved unchanged. Where it says "the herlittleempire repo", read
> **`curieux/course`**: the `herlittleempire` repo is the static marketing site,
> so the course platform is its own Next.js app here, beside Empire Studio
> (`../empire`), deployed as its own Vercel project. Progress against the build
> order is tracked in `README.md` → Build progress.

# Her Little Empire — Course Platform Build Spec

Nov 3, 2026 · @Lo

## How to use this spec

This is written to be handed to Claude Code in the herlittleempire repo, section by section, in the order given at the end. Save the whole spec into the repo as SPEC.md first so every prompt can refer to it, then run the prompts one at a time and review each before the next.

**Stack (already yours).** Next.js App Router with TypeScript, Supabase (Postgres, Auth, Storage, RLS), Stripe Checkout with webhooks, Tailwind, Playwright for the checkout smoke test. Email via Resend (free tier covers launch). Video on Bunny Stream (cheap, private embeds) or unlisted YouTube for v1. Deploy on Vercel's free tier.

**Non-negotiables for Claude Code.** No GST charged or itemised anywhere. Prices stored in cents, shown in AUD by default and USD for non-AU visitors. No earnings language in any UI copy. Every gated page checks entitlement server-side, never only in the client. Refund is one click in admin and revokes access immediately.

## Scope

**v1 ships** (target: one week of evenings):

- Public: home and sales page, free Product Check (two lessons plus two calculators, email-gated), Hype Check, waitlist, legal and refund pages.

- Auth: magic-link sign-in via Supabase Auth; no passwords.

- Commerce: Stripe Checkout for Module 0 (A\$49), full course (A\$250) and founding cohort (A\$349, counter-limited); benchmark pack (A\$29) as an order bump on the Module 0 checkout; webhook grants entitlements.

- Course: modules and lessons gated by tier, video embed, downloads, lesson-complete tracking, next-lesson prompt.

- Calculators: all twelve as app pages, saving each user's inputs and results.

- Email: welcome, Module 0 onboarding sequence (5 emails), purchase receipts, refund confirmation.

- Admin: buyers list, entitlements, refund button, cohort places remaining, verdicts submitted, CSV export.

**Waits for v2:** community or comments, membership billing, affiliate tracking, multi-currency beyond AUD/USD, the Fit Finder web app, licensing or white-label.

## Data model

Supabase Postgres. All tables have id (uuid), created_at, updated_at. RLS on every table: users read and write only their own rows; admin role (your user id in an admins table) reads everything; lesson and module content is readable by anyone but video and download URLs are served through a signed route that checks entitlement.

| Table           | Key columns                                                                                                                                                                           | Notes                                                |
|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| profiles        | user_id, email, first_name, country, marketing_opt_in                                                                                                                                 | Created on first sign-in by trigger                  |
| leads           | email, source (product_check / hype_check / waitlist / keyword), first_seen, converted_user_id                                                                                        | Free-tier captures before sign-up                    |
| products        | slug, name, tier (free / module0 / course / founding / benchmark_pack), price_aud_cents, price_usd_cents, stripe_price_id_aud, stripe_price_id_usd, active, places_total, places_sold | Founding has places_total 30                         |
| orders          | user_id, product_id, stripe_session_id, stripe_payment_intent, amount_cents, currency, status (paid / refunded), bump_product_id                                                      | One row per checkout                                 |
| entitlements    | user_id, tier, granted_by_order_id, revoked_at                                                                                                                                        | Source of truth for access; refund sets revoked_at   |
| modules         | slug, number, title, summary, order                                                                                                                                                   | Five modules                                         |
| lessons         | module_id, number, title, summary, video_provider, video_id, duration_sec, min_tier, order, script_md                                                                                 | min_tier: free, module0 or course                    |
| lesson_assets   | lesson_id, label, storage_path, kind (sheet / pdf / template)                                                                                                                         | Served via signed URL                                |
| lesson_progress | user_id, lesson_id, completed_at                                                                                                                                                      |                                                      |
| calculators     | slug, name, module_id, min_tier, schema_json                                                                                                                                          | Inputs and formulas are code; schema drives the form |
| calc_runs       | user_id, calculator_slug, inputs_json, outputs_json, verdict                                                                                                                          | Saved automatically; latest shown on return          |
| verdicts        | user_id, product_name, verdict (green / amber / red), reasons_json, submitted_at, reviewed_at, review_md                                                                              | Founding buyers get a written review                 |
| email_events    | user_id or lead_email, template, sent_at, provider_id                                                                                                                                 | Idempotency for the sequence                         |
| admins          | user_id                                                                                                                                                                               | Just you for now                                     |

Entitlement resolution: tier order is free \< module0 \< course \< founding. A user's effective tier is the highest non-revoked entitlement. benchmark_pack is a separate boolean entitlement.

## Access tiers and Stripe

| Tier           | Price                                    | Grants                                                                                                                                  | Stripe set-up                                                                                |
|----------------|------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| free           | A\$0, email required                     | Lessons 0.1 and 0.2; Landed Cost and Unit Economics calculators; Hype Check                                                             | No Stripe; lead row then magic link                                                          |
| module0        | A\$49                                    | All Module 0 lessons and tools; credited in full if upgrading                                                                           | Price in AUD and USD; order bump = benchmark_pack at A\$29 shown as a Checkout optional item |
| course         | A\$250 (A\$201 if module0 already owned) | Everything in modules 0–4, all calculators, templates, benchmark pack included                                                          | Coupon generated per user for the credit, applied automatically                              |
| founding       | A\$349, 30 places                        | course plus one written Product Verdict review and the 8-week private thread (v1: an email address and a promise; thread tooling is v2) | places_sold increments in the webhook; checkout refused at 30                                |
| benchmark_pack | A\$29                                    | The benchmark sheets, standalone                                                                                                        | Bump on module0; included in course and founding                                             |

**Webhook rules** (checkout.session.completed, charge.refunded): idempotent on session id; create order, grant entitlement(s), increment places_sold for founding, send receipt email, start the onboarding sequence for module0 and above. On refund: mark order refunded, set revoked_at on the entitlement, decrement places_sold if founding, send refund confirmation. **Refund policy in code:** 14 days from purchase, self-serve button in the account page, no reason required; after 14 days the button becomes a mailto and the admin can still refund manually.

**Currency:** detect country from Vercel's geo header; AU shows AUD, everyone else USD. One Stripe product per tier with two prices. No tax collection configured in Stripe.

## Pages and routes

| Route                                        | Access            | What it does                                                                                                          |
|----------------------------------------------|-------------------|-----------------------------------------------------------------------------------------------------------------------|
| /                                            | public            | Sales page: promise, who it's not for, what's inside, the three gates, price, refund, FAQ; two CTAs (free check, buy) |
| /check                                       | public            | Free Product Check: email form, then lessons 0.1–0.2 and two calculators unlocked by magic link                       |
| /hype                                        | public            | Hype Check: paste a post, get a score and a "what it leaves out" list; copy-to-share; optional email                  |
| /waitlist                                    | public            | Founding cohort and future-module waitlist                                                                            |
| /pricing                                     | public            | The three tiers side by side, honest comparison                                                                       |
| /legal/terms, /legal/privacy, /legal/refunds | public            | Plain-English; refunds page is one paragraph                                                                          |
| /login                                       | public            | Magic link                                                                                                            |
| /learn                                       | signed in         | Course home: modules with progress; locked modules show what unlocks them                                             |
| /learn/\[module\]/\[lesson\]                 | gated by min_tier | Video, script toggle (text version), assets, mark complete, next lesson                                               |
| /tools                                       | signed in         | Calculator library; locked ones show the tier needed                                                                  |
| /tools/\[slug\]                              | gated             | The calculator; autosaves; shows last run                                                                             |
| /verdict                                     | module0 and above | Product Verdict form; founding users see review status                                                                |
| /account                                     | signed in         | Purchases, refund button (within 14 days), email preferences, delete account                                          |
| /checkout/\[product\]                        | signed in         | Creates Stripe Checkout session with correct currency and any credit coupon                                           |
| /api/webhooks/stripe                         | server            | Webhook handler per the rules above                                                                                   |
| /api/assets/\[id\]                           | server            | Signed URL after entitlement check                                                                                    |
| /admin                                       | admin only        | Buyers, entitlements, refund, cohort counter, verdicts queue, lead export                                             |

Design: mobile-first, because she is on her phone. One accent colour, large type, no stock imagery. Text-on-screen reels will link straight to /check and /hype so both pages must load fast and work without sign-in until the gate.

## Calculator specs

Each calculator is a typed function in /lib/calc/\[slug\].ts with a JSON schema for its form, a pure compute function, and unit tests against the worked examples. Money inputs in the user's currency, stored as entered with a currency field. All percentages entered as whole numbers. The four below are the free-tier and verdict core and must be exact; the other eight follow the same pattern and are specified in one line each.

**1. Landed Cost** (free). Inputs: unit cost, units per order, freight for the order, duty rate %, packaging per unit, payment fee % (default 2.9) plus fixed fee (default 0.30), expected return rate % (default 5), inbound misc (labels, inspection). Outputs: landed cost per unit = unit cost + freight/units + duty (on unit cost + freight share) + packaging + misc/units; fee cost per unit at the intended sale price; returns allowance per unit = sale price × return rate × 0.5 (half the value lost on a typical return); true cost per unit = landed + fees + returns allowance.

**2. Unit Economics** (free). Inputs: sale price, true cost per unit (from 1), shipping charged to customer, shipping cost to you, fixed monthly costs (Shopify plan, apps, domain, insurance), target monthly take-home. Outputs: contribution margin per unit = price + shipping charged − true cost − shipping cost; margin % of price; break-even units per month = fixed costs ÷ contribution; units needed for target = (fixed + target) ÷ contribution; maximum affordable CAC = contribution × 0.5 (never spend more than half the contribution to acquire a first order). Display one plain sentence: "At this price you keep A\$X per sale. You need N sales a month before you earn anything."

**3. Price Ladder** (module0). Inputs: up to five comparable products with price and a quality note; her true cost per unit. Outputs: market low, median, high; her margin % at each; a recommended position with the rule that margin % under 40 is red, 40–55 amber, over 55 green for a physical product sold direct.

**4. Product Verdict** (module0). Inputs: pulled from the user's latest runs of 1, 2, 3 and the Cash Cycle sheet plus three yes/no questions (demand signal found, compliance check done, cash available ≥ first order cash need). Logic: red if margin % \< 40, or break-even units \> 150/month for a first product, or cash available \< need, or compliance not done; amber if margin 40–55 or break-even 80–150 or no demand signal; otherwise green. Output: the verdict, the reasons as plain sentences, and what would turn it green. Saved to verdicts; founding users can submit it for review.

**The other eight, one line each.** Cash Cycle: deposit %, balance %, lead time days, sell-through days → cash tied up and days to recovery. CAC Ceiling: contribution, expected conversion %, benchmark CPM/CPC → max CAC and whether ads are allowed (yes only if benchmark CAC \< max). Offer Margin: bundle contents and discount → margin per bundle vs. single units. AOV Lever: current AOV, margin, shipping cost → recommended free-shipping threshold (AOV × 1.25, rounded, only if margin covers it). Shipping Rate: zones, weights, carrier rates → what to charge per zone to break even on shipping. Reorder Point: daily velocity, lead time, safety days → reorder at N units, order quantity for 60 days. 90-Day Cash: opening cash, orders/month, AOV, margin, fixed costs, reorder dates → month-end cash for three months with a flag on any month below zero. Working/Not Working scorecard: three months of actuals vs. the Module 0 thresholds → continue, change or stop, with the reasons.

## Email, keywords and lead capture

**Resend** with React Email templates in /emails. Every send is recorded in email_events first, so a retried webhook or cron never sends twice.

| Trigger                          | Email                                                                                 | Timing              |
|----------------------------------|---------------------------------------------------------------------------------------|---------------------|
| Lead captured on /check or /hype | Magic link plus "start with lesson 0.2"                                               | Immediate           |
| Lead, no purchase                | Three-email nudge: the landed-cost mistake; a red verdict is a win; Module 0 is A\$49 | Day 2, 5, 9         |
| module0 or above purchased       | Receipt plus onboarding sequence (5 emails per the course outline)                    | Day 0, 2, 5, 10, 14 |
| founding purchased               | Receipt plus "how to submit your verdict for review"                                  | Immediate           |
| Refund                           | Confirmation, access revoked, no questions                                            | Immediate           |
| Lesson 0.8 completed             | "Your verdict is saved; here's what it means" with the next step by colour            | On completion       |

Sequences run from a daily Vercel cron that reads email_events and sends what's due. Unsubscribe link on every marketing email; transactional emails exempt. **ManyChat** stays outside the app: keywords CHECK, FIT, PRICE, IDEAS each send a deep link to /check, /pricing, /waitlist and the ideas PDF, with a UTM so leads.source is set. **Hype Check** scoring v1 is a weighted keyword rubric (dollar amounts with timeframes, "passive", "guaranteed", "anyone can", urgency words, missing costs or hours) returning a 0–100 score and the three things the post leaves out; log anonymised inputs for later tuning; no AI call in v1 so it stays free to run.

## Admin, refunds and the cohort counter

/admin, gated by the admins table and a server check. One page with tabs: Buyers (search, tier, purchase date, country, refund button), Leads (source, converted or not, export CSV), Cohort (places sold of 30, list, review status per verdict with a textarea to write the review and a send button), Verdicts (all submitted, colour, product name), Numbers (today and 7-day: leads, Module 0 sales, course sales, refunds, conversion lead→buyer).

Refund button calls Stripe refund, then the same handler as the webhook so state stays consistent even if the webhook is delayed. Cohort counter is enforced in the checkout route (refuse at 30) and in the webhook (decrement on refund), never only in the UI. The five-number daily tracker from the launch sprint is the Numbers tab, so you don't need a spreadsheet.

## Content loading

Lessons live as markdown files in /content/modules/\[module\]/\[lesson\].md with frontmatter (number, title, summary, min_tier, video_provider, video_id, duration, assets). A seed script reads them into modules and lessons so you edit text in the repo and run one command. Scripts go in the same file under the body; the lesson page shows the script as a "read instead" toggle, which also gives the course a text version for accessibility and for buyers who prefer reading. Videos: upload to Bunny Stream (or unlisted YouTube), paste the id into frontmatter. Assets: upload to Supabase Storage bucket lesson-assets (private), reference the path in frontmatter; the signed route serves them. Benchmark sheets and templates are assets on a hidden "Library" module so they appear in one place. Worked examples A, B, C are ordinary lessons flagged example: true so the UI labels them.

## Build order: the prompts for Claude Code

Run these in the herlittleempire repo, one per session, each starting with "Read SPEC.md." Review and commit after each. Keys (Supabase, Stripe test mode, Resend) go in .env.local and Vercel, never in the repo.

1.  **Foundation.** "Set up the Next.js App Router project per the Stack section: Tailwind, Supabase client (server and browser), magic-link auth with /login and a protected /learn placeholder, the profiles trigger, and the admins table with my user. Add Playwright with one smoke test that signs in."

2.  **Schema.** "Create the Supabase migrations for every table in the Data model section with RLS policies exactly as described, plus the entitlement resolution function. Seed products with the five tiers and prices."

3.  **Content pipeline.** "Implement /content markdown loading and the seed script per Content loading. Add two placeholder lessons in module 0 and build /learn, /learn/\[module\]/\[lesson\] with tier gating, video embed, script toggle, mark-complete and next-lesson."

4.  **Calculators.** "Implement /lib/calc for Landed Cost, Unit Economics, Price Ladder and Product Verdict exactly per Calculator specs, with unit tests, schema-driven forms at /tools/\[slug\], autosave to calc_runs, and the /verdict page. Then the remaining eight in the same pattern."

5.  **Commerce.** "Implement /checkout/\[product\] with Stripe Checkout in AUD/USD by geo, the benchmark-pack bump on module0, the course credit coupon for module0 owners, the founding counter, and the webhook per Webhook rules. Add the refund button to /account within 14 days. Extend the Playwright test to buy module0 in test mode and assert the entitlement."

6.  **Public pages.** "Build /, /pricing, /check (lead capture then free access), /hype with the keyword rubric, /waitlist and the three legal pages, mobile-first, using the copy in /content/pages. No earnings language anywhere."

7.  **Email.** "Add Resend with the templates and sequences in the Email section, the email_events idempotency table, and the daily cron route."

8.  **Admin.** "Build /admin with the five tabs per the Admin section, including the review textarea and CSV export."

9.  **Launch check.** "Run the full Playwright suite, check every gated route server-side with a signed-out request, confirm no GST appears anywhere, and produce a launch checklist of env vars and Stripe live-mode steps."

What I write in parallel so the content is ready when step 3 lands: the eight Module 0 scripts, the sales page copy, the three free-tier emails and the five onboarding emails, the legal pages, and the Hype Check rubric word lists. Those are the next documents.
