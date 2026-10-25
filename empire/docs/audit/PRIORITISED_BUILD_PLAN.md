# Prioritised build plan (Phase 6)

Each item lists: **Status** · **Evidence** · **Change** · **Why** · **Complexity** (S < ½ day, M 1–2 days, L 3+ days, EST) · **Depends on** · **Third-party cost** (EST unless FACT) · **Accepted when** · **Founder input**.

## P0: first-sale readiness and launch blockers

### P0-1. Merge PR BeCurieux/curieux#68

- **Status:** open, mergeable "clean", CI green on `80d3595` (23 Oct 2026). **Evidence:** GitHub; GAP B1.
- **Change:** merge to `main`; production deploy builds. **Why:** without it there's no production URL and no base for the Ads course PR.
- **Complexity:** S. **Depends on:** nothing. **Cost:** none.
- **Accepted when:** Vercel production deployment of `main` succeeds. **Founder:** **yes, approval and the merge click.**

### P0-2. Vercel Pro

- **Status:** Hobby (non-commercial). **Evidence:** `docs/SERVICES.md`, `docs/HLE_EXISTING_ASSETS_AUDIT.md` §4.
- **Change:** upgrade the team. **Why:** Vercel's terms don't allow selling from Hobby.
- **Complexity:** S. **Depends on:** nothing. **Cost:** ~US$20/month (EST).
- **Accepted when:** the plan shows Pro. **Founder:** **yes (payment).**

### P0-3. Custom domain and SMTP

- **Status:** preview URL only; Supabase's built-in mailer. **Evidence:** `docs/ENVIRONMENT.md` (`APP_URL`), `docs/SERVICES.md`.
- **Change:** point `studio.herlittleempire.com` at Vercel; set `APP_URL`; add custom SMTP in Supabase Auth; add the domain to Supabase's redirect allow-list.
- **Why:** sign-in links must come from a trusted sender and survive a launch-day burst.
- **Complexity:** S. **Depends on:** P0-1, DNS access. **Cost:** US$0 (SMTP free tier, EST).
- **Accepted when:** a sign-in email from the custom sender arrives and signs in on the custom domain. **Founder:** **yes (DNS and email account).**

### P0-4. Gumroad product ids and test purchases

- **Status:** all `gumroadProductIds` empty; no `GUMROAD_*` variables. **Evidence:** `src/content/catalogue.ts`; GAP B2, B3.
- **Change:** copy ids from the dashboard; set `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PING_SECRET`, `CRON_SECRET`; configure the ping URL; fix the handle in the env example (GAP B4).
- **Why:** past buyers and Income Fit Test owners can't unlock anything until this is done.
- **Complexity:** S (code) + founder dashboard time. **Depends on:** P0-1. **Cost:** Gumroad fee per sale only.
- **Accepted when:** a real purchase of one product and one bundle shows in the buyer's library; a refund removes it after the recheck. **Founder:** **yes (dashboard, test purchase).**

### P0-5. Decide what the first paid offer is

- **Status:** undecided between the Launch Pack, the Ads course and the calculator. **Evidence:** PRODUCT_READINESS.
- **Change:** pick one (recommendation below: the Income Fit Test → FIT Finder full report path, which only needs P0-4, plus a free calculator as the lead magnet).
- **Why:** three half-ready offers convert worse than one ready one.
- **Complexity:** S. **Depends on:** nothing. **Cost:** none. **Accepted when:** written down. **Founder:** **yes.**

### P0-6. Privacy and terms completed and reviewed

- **Status:** short privacy page; terms with the exact refund sentence. **Evidence:** `src/app/privacy/page.tsx`; QA item 5.
- **Change:** name Supabase and Vercel as processors, US data location and cross-border transfer, retention; legal review.
- **Why:** required before collecting payments and emails (Australian Privacy Principles apply above certain thresholds; UNKNOWN whether HLE is covered: check).
- **Complexity:** S (drafting). **Depends on:** nothing. **Cost:** reviewer's fee (UNKNOWN). **Accepted when:** reviewed text live. **Founder:** **yes.**

### P0-7. Real AI output review (only if the Launch Pack sells first)

- **Status:** mock only. **Evidence:** QA item 2.
- **Change:** set `ANTHROPIC_API_KEY`, generate every module for 3–5 real profiles, check tone, accuracy and cost in `/admin`.
- **Complexity:** M. **Depends on:** the key. **Cost:** a few US$ (EST). **Accepted when:** no guard warnings on real profiles; cost per pack recorded. **Founder:** **yes (key, review).**

### P0-8. Supabase Pro before the first paid customer

- **Status:** free plan. **Evidence:** `docs/SERVICES.md`. **Change:** upgrade; confirm backups. **Why:** free projects pause when idle and have no backups.
- **Complexity:** S. **Cost:** ~US$25/month (EST). **Accepted when:** daily backups listed. **Founder:** **yes (payment).**

## P1: brand polish, conversion, content and email

| ID    | Item                                           | Status / evidence                                  | Change                                                                                  | Why                                                   | Cx  | Depends  | Cost (EST)          | Accepted when                                                                    | Founder                      |
| ----- | ---------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- | --- | -------- | ------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| P1-1  | **Free calculator page** as lead magnet        | Engine done (`src/lib/ads/calculator.ts`), no page | `/ads/tools/calculator`: inputs, results, formulas shown, CSV, print; open to all       | Fastest real value; on-brand proof of "numbers shown" | M   | P0-1     | none                | Works signed out on desktop and phone; axe clean; figures match the engine tests | Review                       |
| P1-2  | **Email service and capture**                  | None (GAP M1)                                      | Choose a service; consent-based capture on the calculator and FIT Finder; double opt-in | No list = no second chance at a visitor               | M   | P1-1     | US$0 to ~1,000 subs | A test signup lands in the list with consent recorded                            | **Yes** (service)            |
| P1-3  | **Five-email welcome sequence**                | Planned (Ads plan M5)                              | Write and load; no urgency, no income claims; guard-checked                             | Turns a lead into a buyer                             | M   | P1-2     | none                | All five pass the claims guard; sent to a test address                           | **Yes** (tone)               |
| P1-4  | **One front door and ladder**                  | Three audiences (BRAND §3)                         | One public landing: FIT Finder + calculator → kits → course/Studio                      | Clarity converts                                      | M   | P0-5     | none                | A first-time visitor can name the next step in one click                         | **Yes**                      |
| P1-5  | **About block with a named, faceless founder** | None                                               | Short story; credentials only in approved wording (BRAND §3)                            | Trust without a face                                  | S   | Decision | none                | Founder-approved text live                                                       | **Yes** (wording, BSB check) |
| P1-6  | **Pricing FAQ and previews**                   | No FAQ on `/pricing`                               | 6–8 honest FAQs; real screenshots                                                       | Answers objections before checkout                    | S   | —        | none                | FAQ live; no claim fails the guard                                               | Review                       |
| P1-7  | **SEO basics for public pages**                | None (GAP M5)                                      | Descriptions, Open Graph image, sitemap, robots (noindex the app behind sign-in)        | Shareable, findable                                   | S   | —        | none                | Valid sitemap; OG preview renders                                                | No                           |
| P1-8  | **Apply CORRECTIONS to the PDFs**              | Patches ready (`content/CORRECTIONS.md`)           | Founder updates the files on Gumroad                                                    | Products must match the app                           | M   | —        | none                | Each correction ticked                                                           | **Yes**                      |
| P1-9  | **Real-testimonial process**                   | None (GAP M7)                                      | Post-purchase email asking permission; store consent with the quote                     | Proof without invention                               | S   | P1-2     | none                | First quote stored with written permission                                       | **Yes**                      |
| P1-10 | Gold accent (optional)                         | Not in tokens (BRAND §3)                           | One token, small marks only; contrast-tested                                            | The brief's palette                                   | S   | Decision | none                | Contrast AA; founder sign-off                                                    | **Yes**                      |

## P2: complete the course, calculator and diagnostic

| ID   | Item                                   | Status / evidence | Change                                                                                             | Cx  | Depends    | Cost        | Accepted when                                        | Founder                    |
| ---- | -------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- | --- | ---------- | ----------- | ---------------------------------------------------- | -------------------------- |
| P2-1 | Push `hle-ads`, open the Ads course PR | 2 commits local   | Rebase on merged `main`, push, new PR                                                              | S   | P0-1       | none        | CI green                                             | Merge                      |
| P2-2 | Member area (M2)                       | Not built         | `/ads/learn`, reader, progress (`ads_progress` + RLS), access gate, sample lesson, saved scenarios | M   | P2-1, P0-4 | none        | Plan M2 criteria (`docs/HLE_IMPLEMENTATION_PLAN.md`) | Review                     |
| P2-3 | Modules 2–10 and toolkit (M3)          | Module 1 only     | Write to Module 1's standard; toolkit as Markdown/CSV                                              | L   | P2-2       | none        | Plan M3 criteria; Module 2 facts verified live       | **Yes** (tone, Meta check) |
| P2-4 | Diagnostic tool (M4)                   | Designed (AD-4)   | Rule table, minimum-data gates, "can't conclude yet"                                               | M   | P2-1       | none        | Plan M4 criteria                                     | Review                     |
| P2-5 | Sales page and Gumroad product (M5)    | Not built         | `/ads` page; AUD Gumroad product                                                                   | M   | P2-3       | Gumroad fee | A real test purchase unlocks the course              | **Yes** (price)            |

## P3: Academy and recurring revenue (only with evidence)

| ID   | Item                        | Gate before building                                                    | Change                                                     | Cx  | Cost (EST)                     | Founder |
| ---- | --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --- | ------------------------------ | ------- |
| P3-1 | Academy dashboard           | ≥ 2 paid products in Studio with repeat use (Studio's `/admin` metrics) | One dashboard across FIT Finder, course, tools             | M   | none                           | **Yes** |
| P3-2 | Membership / subscription   | Evidence of repeat demand (repeat usage, survey of paying customers)    | Stripe Billing via `BillingProvider`; tax approach decided | L   | Stripe fees; tax setup UNKNOWN | **Yes** |
| P3-3 | Shopify OAuth / Etsy Studio | Launch Pack sales                                                       | Per `docs/SHOPIFY-INTEGRATION.md`, `docs/ETSY-STUDIO.md`   | L   | none                           | **Yes** |

## 5. Summary

### Excellent, and must be preserved

- The **honesty system**: FACT/EST/UNKNOWN labels with dates; the claims guard blocking income claims, fake urgency, PLR/MRR, MLM and invented reviews, now applied to course content in tests.
- The **FIT Finder**, a faithful, tested port with an honest "not enough evidence" verdict.
- **Security**: RLS everywhere (mutation-tested), access only from verified sales, no secrets committed.
- The **voice** and the **promise**: "Make your own money. Know what you're getting into."
- The **test discipline**: 115 unit, 20 e2e, an RLS suite, all passing.

### Complete

Empire Studio (code), the FIT Finder, the content register and corrections, the ads calculator engine, Ads Module 1, the 19-product Gumroad catalogue (per `catalog.py`).

### Broken

Production deployment (until #68 merges); library matching (empty product ids); no way to buy the Launch Pack; one wrong Gumroad handle in a docs example.

### Missing

Email list and sequences; custom SMTP; paid hosting plans; public SEO; founder presence; real testimonials; Ads Modules 2–10, member area, diagnostic and sales page; the School-Hours kit, Reality Check, Starter Kit, First 100 Sales, Academy and membership; the website's code in version control.

### What's preventing the first sale (of the new offers)

1. #68 unmerged → no production. 2. Vercel Hobby. 3. Empty Gumroad product ids and no `GUMROAD_*` settings. 4. No email capture. 5. Privacy/terms not reviewed. (Existing Gumroad kits are presumably selling already: UNVERIFIED.)

### The 10 highest-impact improvements

1. Merge #68 and move to Vercel Pro (P0-1, P0-2).
2. Fill Gumroad ids and run one real purchase + refund (P0-4).
3. Ship the free calculator page (P1-1).
4. Add email capture with consent to the calculator and FIT Finder (P1-2).
5. Write the five-email welcome sequence (P1-3).
6. One front door and one ladder across kits, tools and course (P1-4).
7. A named, faceless founder About block, with approved credentials wording (P1-5).
8. Custom domain and SMTP for sign-in (P0-3).
9. Complete and review the privacy page (P0-6).
10. Publish one honest, numbers-shown ads experiment as the first proof (BRAND §3).

### What can realistically launch within seven days

The free calculator page, email capture, the welcome sequence, production on Pro with the custom domain, working library matching, and the FIT Finder full report for Income Fit Test owners. **Not** the full Ads course (9 modules of writing plus Meta verification). See [SEVEN_DAY_LAUNCH_PLAN.md](SEVEN_DAY_LAUNCH_PLAN.md).

### Exact recommended next step

**Founder: merge PR BeCurieux/curieux#68.** Then I rebase and push `hle-ads` as the Ads course PR, and build P1-1, the public calculator page at `/ads/tools/calculator` on the tested engine, as the first new thing a customer can use.
