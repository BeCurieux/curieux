# Launch decision pack

**Prepared 23 October 2026.** A recommendation for the founder and ChatGPT to decide on. Costs are **ESTIMATE** unless marked FACT; check each provider's pricing page before paying. Nothing here has been bought, merged, deployed or published.

> **Status update, 25 October 2026:** PR BeCurieux/curieux#68 and PR BeCurieux/curieux#69 (`hle-ads`) are merged into `main`, and the email sign-up migration (`20261024000005`) is applied to the Supabase project. Studio still isn't public on `studio.herlittleempire.com` (Vercel Pro and DNS pending) and Gumroad isn't connected. The rest of this document describes the date above.

## 1. Recommended route: launch with what already exists

**One flagship entry offer:** **The Income Fit Test (US$19, Gumroad).**

- It's finished, audited and the brand's clearest expression of "Know what you're getting into".
- It's the only paid product that also unlocks working software: the full FIT Finder report.
- Evidence: `COMPLETE_PRODUCT_INVENTORY.md` §5.

**One free lead magnet:** **The 5-Question Fit Check (free, Gumroad).**

- It already exists, Gumroad delivers it and collects the email, and its last page already leads to the Income Fit Test.
- Supporting free tools, linked but not the main magnet: the FIT Finder free tier and the Ads Profitability Calculator.

**Why not a new product, or the Ads course first:**

- New products would overlap existing ones.
- The Ads course is 1 of 10 modules.
- The Launch Pack needs Gumroad setup, real AI review, and speaks to a different audience.

## 2. Gumroad only, or add Shopify?

|                        | **Continue with Gumroad (recommended)**                                                                          | **Add Shopify**                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Already working        | Store, listings and delivery (founder; UNVERIFIED live). Empire Studio's integration is built and tested in code | Nothing for Her Little Empire. The only connected store is PATONGA, another business (FACT)                          |
| Monthly cost           | US$0 fixed                                                                                                       | Basic around US$39/month (ESTIMATE), plus a digital-delivery app and possibly a course app (ESTIMATE US$0–100/month) |
| Per-sale cost          | 10% + US$0.50 direct; 30% via Discover (FACT, Oct 2026); card processing UNKNOWN                                 | Payment processing around 2–3% + a fixed fee (ESTIMATE; depends on country and plan)                                 |
| Sales tax / GST / VAT  | Check Gumroad's current tax handling for her account (**verify**: platform policy)                               | The seller manages tax registration and collection where required (**verify** with an accountant)                    |
| Work to launch         | Configure product ids, token, ping (an hour or two, ESTIMATE)                                                    | Build a store, migrate 19 products and 3 bundles, re-do delivery, connect Studio entitlements (days, ESTIMATE)       |
| Risk                   | Higher per-sale fee                                                                                              | Two systems to run; migration errors; existing buyers' links                                                         |
| **When to reconsider** | —                                                                                                                | Physical products; fees outweigh Shopify's fixed cost at real volume; or subscriptions need a different stack        |

**Break-even on fees, illustrative only:** Gumroad's 10% costs more than Shopify's percentage only beyond roughly a few hundred US dollars of monthly sales (ESTIMATE). Below that, Shopify's fixed fees cost more. Decide on real sales data, which isn't available to this session.

## 3. Seven-day plan

Owners: **Vee** (founder), **Build** (a coding session), **Reviewer** (a professional). "Approval" means Vee's explicit yes before it happens.

| Day | Task                                                                                                           | Owner          | Depends on     | Cost (ESTIMATE)          | Done when (measurable)                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------- | -------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | Approve: first offer, lead magnet, calculator page, privacy/terms drafts, welcome emails                       | Vee            | —              | US$0                     | Written yes (or changes) on each                                                                              |
| 1   | Merge PR BeCurieux/curieux#68 (approval)                                                                       | Vee            | —              | US$0                     | Vercel production deploy of `main` succeeds                                                                   |
| 1   | Push `hle-ads`, open its PR (approval); merge when green (approval)                                            | Build → Vee    | #68 merged     | US$0                     | CI green; `/ads/tools/calculator` loads on production                                                         |
| 2   | Vercel Pro (approval, purchase)                                                                                | Vee            | —              | ~US$20/month             | Plan shows Pro                                                                                                |
| 2   | DNS for `studio.herlittleempire.com`; `APP_URL`; Supabase URL settings; custom SMTP (approval)                 | Vee (+ Build)  | Pro            | US$0 (free SMTP tier)    | Sign-in email from the custom sender works on the custom domain                                               |
| 3   | Copy Gumroad product ids (Income Fit Test, both bundles that contain it, Fit Check); small PR                  | Vee → Build    | merges         | US$0                     | Unit test maps each id to its product                                                                         |
| 3   | Access token, ping secret, cron secret in Vercel; ping URL and refund subscriptions in Gumroad (approval)      | Vee (+ Build)  | ids            | US$0                     | Settings present; no secret in the repo or chat                                                               |
| 4   | Apply CORRECTIONS §1–2 and the report patches to the Income Fit Test files; add the Studio line to the listing | Vee            | —              | US$0                     | Listing and files say v1.4, 20 questions, exact refund sentence                                               |
| 4   | Send privacy and terms for professional review                                                                 | Vee → Reviewer | Day 1 drafts   | UNKNOWN                  | Reviewer engaged (launching paid traffic waits on the result)                                                 |
| 5   | **Genuine test purchase and refund** (approval; real card)                                                     | Vee + Build    | Days 2–4       | One US$19 sale, refunded | All 10 steps in `SALES_FUNNEL_AND_CUSTOMER_JOURNEY.md` §5 pass                                                |
| 6   | Load the welcome sequence (Gumroad emails, if they can sequence; else a free-tier mailing service) (approval)  | Vee            | Day 1 approval | US$0                     | A test opt-in gets email 1 at once and email 2 on day 2                                                       |
| 6   | Links from herlittleempire.com and the Instagram bio to the Fit Check and calculator, with `?ref=` (approval)  | Vee            | Day 1          | US$0                     | Clicks show in `/admin` signup sources and in Gumroad's referrers                                             |
| 7   | Announce to past buyers (draft in `docs/MIGRATION.md`); post the free tools                                    | Vee            | Days 5–6       | US$0                     | Sent; first real `purchase_verified` with access confirmed (the goal: one verified real sale; not a forecast) |

**Fixed cost for the week:** ~US$20/month (Vercel Pro). Supabase Pro (~US$25/month) is strongly recommended before relying on stored customer data; the free plan has no backups.

## 4. Decisions needing founder approval

1. First offer and lead magnet (above).
2. Merging PR #68; pushing and merging `hle-ads`.
3. Buying Vercel Pro and, when, Supabase Pro.
4. DNS change for `studio.herlittleempire.com`.
5. Production Gumroad settings (token, ping, refund subscriptions).
6. Privacy and terms text, and a professional review.
7. Welcome emails, and where they're sent from.
8. Editing her own Gumroad listings and files (corrections, Studio line).
9. A genuine card purchase and refund for the test.
10. "Get the Launch Pack": configure it, or hide it until it's for sale.
11. Founder credentials: whether and how (§6).
12. Gold accent, currency (US$ vs AUD), a usage-data retention period.

## 5. Blockers vs enhancements vs future

| **Immediate launch blockers**                                                | **Enhancements (after the first verified sale)** | **Future (only with evidence)**                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| PR #68 merge; production deploy                                              | Return to the FIT Finder after sign-in           | Ads course modules 2–10, toolkit, member area   |
| Vercel Pro (commercial use)                                                  | In-app email opt-in with a mailing service       | Ads Diagnostic Tool                             |
| Custom domain and SMTP                                                       | Link the free tools from Studio's home page      | Academy dashboard across products               |
| Gumroad product ids, token, ping, cron secret                                | Founder About block (faceless)                   | Membership / subscription (Stripe Billing)      |
| Income Fit Test corrections                                                  | Real-testimonial process                         | Launch Pack with reviewed real AI output        |
| One genuine test purchase and refund passing                                 | SEO basics (descriptions, share images, sitemap) | Shopify integration (only if physical products) |
| Privacy/terms founder approval (and professional review before paid traffic) | Error reporting                                  |                                                 |

## 6. Needs legal, privacy, tax or platform-policy verification

This session doesn't give compliance assurances. Each item needs checking by the right person or source:

| Topic                                                                                                             | Verify with                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Whether the Australian Privacy Act / APPs apply (small-business exemption), and APP 8 overseas-disclosure wording | Privacy lawyer                       |
| GDPR/UK GDPR and cookie consent (PECR) if EU/UK buyers are targeted                                               | Privacy lawyer                       |
| Refund and consumer-law wording (Australian Consumer Law; other buyer countries)                                  | Lawyer                               |
| How Gumroad handles sales tax/GST/VAT for her account; whether HLE must register anywhere                         | Gumroad's current policy; accountant |
| GST registration status (currently "not registered" per the terms page)                                           | Accountant / ATO                     |
| How a non-practising barrister may describe herself publicly                                                      | Bar Standards Board guidance         |
| Email marketing consent (Spam Act 2003 in Australia; CAN-SPAM; GDPR)                                              | Lawyer; the mailing service's rules  |
| Instagram rules for comment-to-DM automation and promotions                                                       | Meta's current policies (dated)      |
| Vercel Hobby vs commercial use; Supabase plan limits                                                              | Provider terms (current)             |
