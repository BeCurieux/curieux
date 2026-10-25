# Complete product inventory

**Prepared 23 October 2026.** Sources:

> **Status update, 25 October 2026:** PR BeCurieux/curieux#68 and PR BeCurieux/curieux#69 (`hle-ads`) are merged into `main`, and the email sign-up migration (`20261024000005`) is applied to the Supabase project. Studio still isn't public on `studio.herlittleempire.com` (Vercel Pro and DNS pending) and Gumroad isn't connected. The rest of this document describes the date above.

- the founder's `catalog.py`, copied into `src/content/catalogue.ts` and `docs/CATALOGUE.md` (prices, bundles, on-sale status, 22 Oct 2026);
- the content register (`content/register.json`), built by reading all 68 files the founder supplied (`01_income-fit-test/`, `02_products/`, `03_brand/`);
- this repository's code and tests.

**Live Gumroad listings, prices and sales could not be checked** from this session (network blocked). Every "on sale" is the founder's statement, not a live check.

**Status scale:**

- **On sale (founder):** a finished file the founder says is listed on Gumroad.
- **Finished, not listed:** finished file, not on Gumroad.
- **Unreleased:** finished file, deliberately not for sale yet.
- **Built software:** code exists and is tested, but it isn't sellable yet.
- **Partly built.**
- **Outline / plan only.**
- **Does not exist.**

## 1. Sales and customer data (FACT, no personal details)

| Source                                   | What it shows                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Empire Studio database (read-only count) | 1 account (the founder's test); **0 purchases**; 0 entitlements; 0 FIT Finder results                       |
| Gumroad sales, revenue, refunds, ratings | **UNVERIFIED: not available to this session.** The founder can export them from Gumroad → Analytics / Sales |
| Testimonials                             | **None exist in the project.** None have been invented                                                      |

No product can be ranked on revenue here. The recommendation in §4 uses readiness, differentiation and customer value only.

## 2. Summary table

| Product                                   | Price                                       | Status                                                | Target customer (from the product)                                                                            |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **The Income Fit Test** (flagship kit)    | US$19                                       | On sale (founder)                                     | Women choosing a side income that fits their real week                                                        |
| The 5-Question Fit Check                  | Free                                        | On sale, free (founder)                               | Same, earlier: filtering ideas in ten minutes                                                                 |
| Video Course (Income Fit Test)            | US$6                                        | On sale (founder); **file not supplied to the audit** | Income Fit Test buyers                                                                                        |
| First 5 Customers                         | US$7                                        | On sale (founder)                                     | Income Fit Test add-on: word-for-word outreach for five real conversations                                    |
| Get Found                                 | US$7                                        | On sale (founder)                                     | Income Fit Test add-on: how buyers find sellers on 12 platforms                                               |
| Price It Right                            | US$5                                        | On sale (founder)                                     | Income Fit Test add-on: setting and defending a first price                                                   |
| 14-Day Tracker                            | US$4                                        | On sale (founder)                                     | Income Fit Test users running the 14-day test                                                                 |
| Brand-in-a-Box                            | US$9                                        | On sale (founder)                                     | New sellers who want to "look real on day one" (four editable templates)                                      |
| 100 Faceless Hooks                        | US$9                                        | On sale (founder)                                     | Faceless Instagram sellers (swipe file of 100 hooks)                                                          |
| Comment-to-DM Kit                         | US$12                                       | On sale (founder)                                     | Same                                                                                                          |
| 30-Day Faceless Content Plan              | US$17                                       | On sale (founder)                                     | Same                                                                                                          |
| Your Little Offer Kit                     | US$19                                       | On sale (founder)                                     | Beginners making a first US$7–27 digital product                                                              |
| VA & OBM Starter Kit                      | US$29                                       | On sale (founder)                                     | Aspiring virtual assistants                                                                                   |
| Etsy Digital Downloads Starter Kit        | US$29                                       | On sale (founder)                                     | Aspiring Etsy printable sellers                                                                               |
| Pinterest Manager Starter Kit             | US$29                                       | On sale (founder)                                     | Aspiring Pinterest managers                                                                                   |
| Tutor & Lesson Starter Kit                | US$29                                       | On sale (founder)                                     | Aspiring tutors                                                                                               |
| The 90-Day Grow Plan                      | US$24                                       | On sale (founder)                                     | Someone whose first 14-day test went well                                                                     |
| Side Income Money System                  | US$19                                       | On sale (founder)                                     | Anyone tracking side-income money and tax set-asides (guide + spreadsheet)                                    |
| Client Paperwork Kit                      | US$19                                       | Finished, not listed                                  | Service providers needing client paperwork templates                                                          |
| AI Business Assistant Pack                | US$12                                       | Finished, not listed                                  | Side-business owners using an AI chat assistant (60 prompts)                                                  |
| Sell It Simply (workbook)                 | —                                           | Unreleased                                            | Sellers after launch                                                                                          |
| Faceless Content System (workbook)        | —                                           | Unreleased; course videos not supplied                | Faceless content creators                                                                                     |
| Faceless & Not Anonymous (workbook)       | —                                           | Unreleased; course videos not supplied                | Faceless sellers building trust                                                                               |
| **Bundles:** The Empire Bundle            | US$39                                       | On sale (founder)                                     | Income Fit Test + video course + First 5 Customers, Get Found, Price It Right, 14-Day Tracker, Brand-in-a-Box |
| The Faceless Content Bundle               | US$29                                       | On sale (founder)                                     | 100 Faceless Hooks, 30-Day Plan, Comment-to-DM, Get Found                                                     |
| The Whole Empire                          | US$99                                       | On sale (founder)                                     | All 19 catalogue products                                                                                     |
| **Software:** FIT Finder                  | Free tier + unlocked by the Income Fit Test | Built software                                        | Same as the Income Fit Test                                                                                   |
| Empire Studio: Shopify Launch Pack        | US$49 (default; configurable)               | Built software, not sellable                          | People launching a Shopify store                                                                              |
| Ads That Actually Sell (10-module course) | AUD, not set                                | Partly built: 1 of 10 modules                         | Small sellers trying Meta ads on a small budget                                                               |
| Ads Profitability Calculator              | Free                                        | Built software (on `hle-ads`, unpushed)               | Anyone about to spend on ads                                                                                  |
| Ads Diagnostic Tool                       | —                                           | Outline / plan only                                   | Same                                                                                                          |
| School-Hours Business Kit                 | —                                           | **Does not exist**                                    | —                                                                                                             |
| Digital Product Starter Kit               | —                                           | **Does not exist**                                    | —                                                                                                             |
| First 100 Sales System                    | —                                           | **Does not exist**                                    | —                                                                                                             |
| Academy dashboard, membership             | —                                           | **Does not exist**                                    | —                                                                                                             |

## 3. The named items in detail

### School-Hours Business Kit: does not exist

No file, catalogue entry or register asset has this name (FACT, searched 23 Oct 2026). "School hours" is a **theme** across existing products:

- the Income Fit Test ("23 realistic ways to earn around school hours");
- FIT Finder question hints;
- Sell It Simply's "school-hours selling week";
- three opportunity cards.

The founder's earlier decision was to remove references to products that don't exist (`content/REGISTER.md` §3, decision 10). If the name is wanted, it would best **rename or reposition the Income Fit Test**, not become new writing.

### FIT Finder: built software

- **What it is:** the Income Fit Test turned into an interactive tool in Empire Studio (`src/lib/fit/`, `/studio/fit`).
  - 20 questions, scored against 23 researched opportunities with dated cards.
  - **Free:** your top three, with one line on why each fits.
  - **With the Income Fit Test** (directly or in either bundle that contains it), the full report: a calculator, rules for five countries, a dated 14-day plan, and Day 14 verdicts including "not enough evidence".
- **Quality:**
  - a 1:1 port of the shipped report, tested on 5,000 answer sets (identical scores and reasons);
  - founder-approved changes (tie-breakers, slow-buying path, 2 unpaid hours a week);
  - saved per account; e2e-tested on desktop and phone.
- **Blocking:** Gumroad product ids (empty), so owners can't unlock the full report yet; and production deployment.

### Empire Studio: Shopify Launch Pack, built software, not sellable

- **What it is:** one-time US$49 (default) for one business: 80 AI generations and up to 10 products. It covers:
  - Brand Blueprint;
  - store design brief and ten Shopify Sidekick prompts (labelled interim; no HLE Shopify method exists);
  - homepage copy, product listings and photo briefs;
  - launch emails, social launch kit and a launch checklist;
  - export.

  A free tier gives a preview and 4 generations.

- **Quality:** version history, a claims guard, usage limits and a daily AI budget; tested on the mock generator.
- **Not done:**
  - no Gumroad product, so "Get the Launch Pack" is a dead end;
  - real AI output not reviewed for tone, accuracy or cost;
  - Sidekick prompts not tried in real Shopify themes;
  - a different audience from the rest of the catalogue.

### Digital Product Starter Kit: does not exist

It overlaps **Your Little Offer Kit** (US$19: idea to live US$7–27 product in a weekend) and the **Etsy Digital Downloads Starter Kit** (US$29). Recommendation: don't write it; bundle or reposition those two if the founder wants this rung.

### Ads That Actually Sell: partly built (about 10%)

- **Plan:** `docs/HLE_IMPLEMENTATION_PLAN.md`, with architecture decisions AD-1 to AD-12. **Content:** Module 1, "The Numbers" (`content/ads/modules/01-the-numbers.md`):
  - about 2,000 words;
  - four hypothetical AUD worked examples, two of them losses;
  - mistakes, a checklist, a five-question assessment with answers, and dated sources;
  - every figure recomputed by a test; the claims guard passes.
- **Missing:**
  - Modules 2–10 (Module 2's Meta interface facts need live verification);
  - the toolkit (30 ad concepts, 12 faceless shot lists, templates);
  - member area, sales page, diagnostic, and a Gumroad product in AUD.
- **Branch:** `hle-ads`, not pushed.

### Ads Profitability Calculator: built software (free)

- **What it is:** `/ads/tools/calculator`. It covers price, discount, GST or VAT (inclusive, exclusive, not registered), fees, costs, refunds and upsells, then:
  - break-even cost per sale and break-even ROAS;
  - an ad period compared against break-even;
  - break-even spend by number of sales;
  - CSV and print.
- **Safeguards:**
  - "Not enough evidence yet" under 5 sales;
  - "A ROAS above 1 can still be a loss";
  - a loss-making product flagged first;
  - a limits section, and no predictive wording (tested);
  - nothing typed leaves the browser (tested).
- **Tests:** 19 engine tests with hand-computed answers, 12 page-logic tests, 7 browser tests on desktop and phone.
- **Not live:** branch `hle-ads`, not pushed.

### Ads Diagnostic Tool: outline / plan only

The design only (AD-4): a rule table with minimum-data gates, ranked hypotheses, a next test with a success criterion, and a "What we can't conclude yet" panel. No code.

## 4. Overlap, outdated information, quality problems and corrections

| Issue                                                                                                                                                    | Evidence                                 | Fix                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Income Fit Test files disagree on version (1.4 vs 1.3) and question count (20 vs 19, 17+2, 15)                                                           | `content/CORRECTIONS.md` §1              | Founder confirmed v1.4, 20 questions; edit the files                        |
| Refund wording shortened in some files (e.g. Fit Check's "14-day refund")                                                                                | CORRECTIONS §2                           | Exactly "Full refund within 14 days of purchase, no questions asked."       |
| Unlabelled figures                                                                                                                                       | CORRECTIONS §3                           | Label FACT/EST/UNKNOWN with dates                                           |
| Income Fit Report's Day 14 rules and calculator differ from the workbook and scorecard                                                                   | CORRECTIONS §4; two report patches ready | The corrected report is the source of truth                                 |
| Brand book footer names the former trading entity; old grey and heading weight                                                                           | CORRECTIONS §5                           | Footer "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com" |
| 30-Day Plan Day 13 says "share the results the next day"; elsewhere day 16                                                                               | REGISTER §3                              | Founder decision pending (suggested: day 16)                                |
| 14-Day Test Plan covers questions 1–15 only                                                                                                              | register (`14-day-test-plan`)            | Align with 20 questions                                                     |
| Old generators (`cards.py`, `quickstart.py`) produce outdated content (25 cards, old fees, a Centrelink line that contradicts the Rules Guide)           | REGISTER §3                              | Don't use them                                                              |
| Carousel templates T01–T10 for the 30-Day Plan weren't in the supplied files                                                                             | register                                 | Confirm they're in the Gumroad download                                     |
| Starter kits overlap the planned Digital Product Starter Kit and First 100 Sales System                                                                  | `docs/audit/GAP_ANALYSIS.md` §3          | Don't create overlapping products                                           |
| Catalogue in US$, Ads course planned in AUD                                                                                                              | AD-8                                     | Founder decision                                                            |
| **Correction to an earlier audit statement:** the Video Course isn't "missing". `catalog.py` lists its file; it just wasn't supplied, so it's unreviewed | register `video-course`                  | Founder to supply it for review                                             |

## 5. Best first offer

**The Income Fit Test (US$19)** plus its free entry points: the FIT Finder free tier and the 5-Question Fit Check. Reasons (detail in `docs/launch/FIRST_OFFER_RECOMMENDATION.md`):

- **Readiness:** a finished, audited flagship, with corrections already written.
- **Differentiation:** an honest, evidence-labelled method with a "not enough evidence" verdict; no competitor claims needed.
- **Value:** a buyer gets the kit and the interactive full report in Empire Studio. It's the only paid product joined to working software.
- **Economics (hypothetical):** US$16.60 kept per direct sale after Gumroad's 10% + US$0.50 (FACT, Oct 2026), before card processing (UNKNOWN) and refunds.

**Not recommended first:**

- the Empire Bundle, until the video course is reviewed;
- the Launch Pack (unconfigured, unreviewed AI, a different audience);
- the Ads course (1 of 10 modules).

## 6. Every product in the register (35 assets)

Generated from `content/register.json` and `src/content/catalogue.ts` on 23 Oct 2026. "Known issues" and "Compliance notes" are the register's own findings, shortened. Kit components of the Income Fit Test (workbook, cards, plan, scorecard, rules guides and so on) are listed separately because they were audited separately; they're sold as part of the kit.

### The 14-Day Test Plan (`14-day-test-plan`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (cover and footers 'Version 1.3 · 21 October 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'One objective, one task, one output and one checkbox a day. Thirty to sixty minutes, designed around pick-up rather than against it.' It 'does not promise you will earn money in 14 days'. (Cover; What this plan promises)
- **Contents:** 16-page daily plan: cover, an at-a-glance page and one page per day for Days 1-14. Each day page has a time estimate (20-60 min), today's objective, a 30-60 minute core task in three steps, the expected output ('save this'), what to open, an optional stretch, a notes box, a done checkbox and a progress bar. There are three milestones (Day 3 choose, Day 10 talk to real people, Day 14 decide) and four phases (Days 1-3, 4-9, 10-12, 13-14). Two honest limits are stated: replies take days, and a first sale is not guaranteed. A firm dated yes or deposit counts as a commitment, and fewer than five conversations means 'not enough information'.
- **In Empire Studio:** Dated, saveable plan in the FIT Finder report (the report's version)
- **Known issues:** Day 1 says answer 'Fit Finder questions 1-12' and Day 2 'questions 13-15'. That covers only 15 questions; the workbook has 17 (+ location) and the report 20. · Day 6 says 'Read the moderate scenario', while the workbook calls it 'Base'. Day 6 Stretch uses 'base-scenario'. The terms are mixed on the same page. · Start Here says the report has already done Days 1-3, but this plan still gives Days 1-3 as Workbook tasks. There is no note on which path applies.

### 14-Day Tracker (`14-day-tracker`)

- **Price:** US$4 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** unknown (PDF CreationDate 22 Oct 2026; no version in text)
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Decide now, before you're attached to the idea." (What would count as a yes); "Count only what people did, not what they said they might do." (Day 14)
- **Contents:** Twelve-page printable companion to the Income Fit Test 14-day plan. It has a 'test at a glance' page (option, time per day, who will pay, maximum spend, three places to find people, offer, test price) and 'what would count as a yes' targets (5+ real conversations, 2+ asked price/how to buy, 1+ paid/deposited/pre-ordered). Fourteen identical daily half-pages record date, minutes, today's task, who I spoke to, four signal tick-boxes and one thing learned. Also a conversation log, a money log and a Day 14 summary in Scorecard order, including real hourly return = (received - spent) / hours.
- **In Empire Studio:** Plan ticks and calculator inputs saved per result
- **Known issues:** Daily tasks are not included; each day says 'TODAY'S TASK (FROM THE 14-DAY PLAN)', which is in the Income Fit Test (out of scope: 01_income-fit-test/source/plan.py, 04_14_Day_Test_Plan.pdf). · Hours must be derived from 'Total minutes spent' (divide by 60); not stated. · No version stated.
- **Compliance notes:** None found. No income claims (the footer says 'No income guarantees').

### The AI Shortcut System (`ai-shortcut-system`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (footer 'Version 1.3 · 21 October 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Twelve copy-and-paste workflows ... that do the slow parts of the 14 days: research, structure, drafting and counting. Written for someone who has never opened either.' (Cover)
- **Contents:** 15-page guide with 12 copy-and-paste prompts for Claude or ChatGPT, one per slow step of the 14-Day Test Plan (Days 1, 4, 5, 6, 7, 8, 9, 10-11, 12, 13, 14 and any day). Opening pages explain how to use a chatbot for first-timers, four forbidden outputs (invented demand or market size, competitor revenue or 'typical earnings', statements about legal or tax obligations, earnings projections), and what the AI is and is not for. Each workflow page has the same shape: what it does, when to use it, what to have ready, the prompt, an example of a useful response, doing it without AI, what a good answer looks like, before you trust it, then, and a privacy line. Workflow 12 is a routine for checking whether the AI invented a claim.
- **In Empire Studio:** Not built
- **Known issues:** Workflow 11 asks for 'Scorecard total: [X] of 36, which the card says is: [GO / ADJUST / STOP band]'. The scorecard says the total is 'context only, not the verdict', has no bands, and its verdicts are NEXT TEST / ADJUST / STOP / INSUFFICIENT EVIDENCE ('GO' is not one of them). · Workflow 1 'Then' says enter skill areas as 'Fit Finder (questions 13 and 14)'. In the workbook they are the 14th and 15th of 17 questions (C19, C20). In the report they are questions 15 and 16 of 20 (location is Q1). Plan Day 2 says 'Answer questions 13-15'. · Workflow 10 example says 'Fewer than ten conversations: directional only', while the prompt and the scorecard use a 5-conversation threshold.
- **Compliance notes:** Workflow 11 prompt example text 'What I would need to be true to keep going: [e.g. 300 a week within 3 months; no evenings]' puts an income figure in a template. It is a user-entered placeholder, but review it against the no-income-claims rule. · Prompts explicitly forbid testimonials, urgency ('limited time, only X spots left, don't miss out'), invented reviews and earnings projections. These align with the owner rules.

### Country rules (report summaries and rules.py) (`fit-country-rules`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** checked 17 Oct 2026 (AU), 19 Oct 2026 (US, UK, CA, NZ)
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** What rules apply where I live?
- **Contents:** Short dated summaries per country in the report, labelled fact or unknown. rules.py builds the full Rules Guide from research files that aren't in the folder, and holds the US chapter back unless a US_READY flag is set.
- **In Empire Studio:** src/lib/fit/rules.ts
- **Known issues:** The research_*.md files rules.py reads are not in the folder. · Whether the shipped US chapter is final (US_READY) is unknown.

### Your Income Fit Report (quiz and scoring engine) (`fit-report`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** v1.4
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Personalised result from the quiz.
- **Contents:** The interactive report: 18 scored questions plus a minimum hourly rate and an optional name (20 in total), the Fit Finder scoring ported from the workbook's Options sheet (columns AF–AZ), top three, why it fits, risks, a calculator, country rules summaries, a dated 14-day plan, Day 14 gates and back-ups.
- **In Empire Studio:** src/lib/fit/engine.ts (1:1 port, parity-tested)
- **Known issues:** 'Sells without pitching' feeds only the risks text, not the score. · The workbook's calculator model differs from the report's; the report is the source of truth (founder, 22 Oct 2026) and the workbook is to be brought into line (content/CORRECTIONS.md).

### The Go / No-Go Scorecard (`go-no-go-scorecard`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (cover and footers 'Version 1.3 · 21 October 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Twelve questions and three gates, so the decision at day 14 rests on evidence of demand, never on how much you enjoyed it.' (Cover)
- **Contents:** 4-page decision tool. Twelve questions are each scored 0-3 with an anchored guide, then a total of 36 that is 'context only, not the verdict'. Evidence gates are applied in order: Gate 1 enough evidence (Reach 0 or 1 → INSUFFICIENT EVIDENCE); Gate 2 willingness (0 → STOP); Gate 3 demand gate with different standards for Service, Product and Slow-buying market; then total ≥24 → NEXT TEST or <24 → ADJUST if demand passes, and an ADJUST-or-STOP rule if it fails. Each of the four verdicts has a next-step paragraph. The final page ('After Day 14') invites buyers to reply with their verdict and mentions a planned optional membership.
- **In Empire Studio:** Day 14 gates in the FIT Finder report (the report's version)
- **Known issues:** 'Two ADJUST rounds without a commitment is a STOP' needs round history. Neither the PDF nor the workbook tracks rounds. · Product demand gate 'Commitments 1+ (an order or pre-order) and Purchase interest 1+'. It is not said whether an order also counts as purchase interest (so an order with no separate price question may fail the gate). · Start-up cost scale '1 = all of it' versus '2 = about half'. The boundaries between 'about half', 'all of it' and 'well under' are not numeric.
- **Compliance notes:** 'you found out for the price of this kit and 14 days' (STOP box). This refers to the price without stating it. Fine. · 'We're planning an optional membership' / 'The kit is complete on its own' / 'No income promises, ever.' No urgency. Compliant.

### The Income Fit Test (product) (`income-fit-test`)

- **Price:** US$19 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** v1.4 (Start Here); 1.3 on other files
- **Sales URL:** https://herlittleempireco.gumroad.com/l/income-fit-test (founder-supplied; not checked live)
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Which side income fits my real week, and how do I test it cheaply?
- **Contents:** The flagship: an offline personalised report (20-question quiz, top three of 23 researched ideas, calculator, rules for five countries, a dated 14-day plan and go/adjust/stop), plus the workbook, opportunity cards, AI shortcut system, 14-day test plan, scorecard and rules guides.
- **In Empire Studio:** FIT Finder (quiz, report, calculator, dated 14-day plan, Day 14 gates), saved per account
- **Known issues:** Version numbering differs between files (1.4 vs 1.3); the founder confirmed v1.4 (see content/CORRECTIONS.md). · Question count is stated as 20, 19, 17 + optional and 15 in different files; the founder confirmed 20.

### The Opportunity Cards (`opportunity-cards`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (footer 'Version 1.3 · 21 October 2026'; index notes 'Version 1.1 replaced eight low-leverage options')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** '23 realistic ways to earn around school hours' ... 'Whether your particular customers will pay you is the one thing no card can know. That is the whole point of the 14 days.' (Cover; How to read a card)
- **Contents:** 39-page research catalogue of 23 income options, one card each, researched in Australia (cards last checked 16 Oct 2026 for 1-15 and 17 Oct 2026 for 16-23). It is followed by 'By country' pages (checked 19 Oct 2026) giving a key rule and rate evidence for the US, UK, Canada and NZ for each card. Each card has: school-hours fit, typical blocks, chips (remote, hours, block, start-up, skill, checks, space, car), four dot ratings (demand evidence, income leverage, room in the market, sells without pitching), what you would do, who pays, reach, minimum resources and start-up, ongoing costs and fees, skills, permissions/checks (Australia), observed rates (not typical earnings), time to first dollar, poor-fit reasons, what to verify, shape of the work, a first inexpensive test and named sources. The front matter explains the FACT/EST/UNKNOWN labels, the index of the 23 options, and a 'researched and excluded' list.
- **In Empire Studio:** Not built
- **Known issues:** The generator for the current 23-card PDF is not in source/ (cards.py is the old 25-card version). · The index start-up chip conflicts with the card body ranges: card 1 'under A$150' vs 'A$0-300 (EST)'; card 4 'under A$75' vs 'A$0-150'; card 5 'under A$150' vs 'A$0-300'; card 8 'under A$100' vs 'A$0-800'; card 15 'A$400+' vs 'A$265-1,500'; card 20 'under A$100' vs 'A$50-200'; card 21 'under A$50' vs 'A$0-100'; card 19 'A$200+' vs 'A$0-200 plus a capable laptop'. · Canva Pro cost is inconsistent: 'about A$20/month' (cards 5, 12) vs 'about A$18 a month' (cards 18, 20).
- **Compliance notes:** Third-party income figures appear (for example card 14 'A$5K-50K a month' claims, card 12 'a few hundred pounds a month', card 20 '92,100 sales'). Each is framed as unverified or promotional, not as an HLE claim. Low risk, but review against the no-income-claims rule. · Card body figures are labelled FACT/EST/UNKNOWN with per-card dates, but several repeated figures in 'Who pays', 'How you reach them' and 'Why this might be a poor fit' have no label (cards 2, 10, 11). The index and excluded list have no labels.

### Opportunity database (23 options) (`opportunity-database`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** database v1.1
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Researched, comparable ideas.
- **Contents:** Machine-readable fields for all 23 opportunities: scoring inputs and the text for what you do, who pays, reach, first test, poor fit and what to verify.
- **In Empire Studio:** content/fit/opportunities.json

### Rules Guides (the rules, in plain words) (`rules-guides`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (footer 'Rules Guides · Version 1.3 · 21 October 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Registering, tax, records, thresholds, insurance, checks, benefits and free help, for five countries, with links to the pages we checked and any gaps marked UNKNOWN.' (Cover)
- **Contents:** 19-page country guide for Australia (checked 17 Oct 2026), the United States, the United Kingdom, Canada and New Zealand (each checked 19 Oct 2026). Each chapter answers about 11 numbered questions: registration/ID, hobby or business, structure and name, records, declaring income and paying tax, what you can claim, GST/VAT/sales-tax thresholds, platform reporting, insurance/licences/checks, benefits interactions, and free help. Canada adds '12 Quebec in brief'. Each item carries its check date and links to official pages. EST and UNKNOWN are marked inline; 'Worth a qualified check' notes flag gaps. It is framed as 'A map, not advice'.
- **In Empire Studio:** Not built
- **Known issues:** US item 11 says 'FTC disclosure (applies to options 5, 13, 14 and 18 in Part B)'. No 'Part B' exists in the kit; it presumably means the Opportunity Cards. · Voice inconsistency: first person in several items ('not on the page I opened', 'I didn't check an IRD list item by item'), versus 'we' elsewhere. · Many items are UNKNOWN (for example the US 92.35% earnings factor, state 1099-K thresholds, US DBA fees, the UK VAT deregistration threshold, CPP rates, NZ childcare income limits).
- **Compliance notes:** Refund wording in the footer matches exactly: 'Full refund within 14 days of purchase, no questions asked.' · General, not personalised: 'A map, not advice'. It refers users to an accountant or the free services. No personalised legal output.

### Start Here (`start-here`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.4 (header and footer: 'Version 1.4 · 21 October 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Find the income idea that fits your life. Test it in 14 days.' The work fits 'around school pick-up, a day job or whatever else fills your week.' (00_Start_Here.pdf, p.1)
- **Contents:** Two-page orientation guide. Page 1 gives five steps: open the offline report, answer '17 Fit Finder questions, plus where you live and the least you'd accept for an hour of your time', read the report and save it as a PDF, read the three matching Opportunity Cards, and start Day 4 of the 14-Day Test Plan because 'Your report has done Days 1 to 3'. Page 2 shows a sample Fit Finder result for 'A fictional mother in Australia' (Email flows 12/12/10 → 34; Resume writing 12/12/9 → 33; VA 12/11/9 → 32, all 'Strong fit'), noting that 12 of the 23 options were filtered out. It also has a which-tool-which-day map, the seven-file list, formats and printing, help/refunds/corrections, a note about a planned optional membership, and a 'what this kit is / is not' box. The sample matches the workbook's cached default result exactly.
- **In Empire Studio:** Not built
- **Known issues:** Question count: says '17 Fit Finder questions, plus where you live and the least you'd accept for an hour' (= 19). The report has 20 (it adds a name question), and the workbook asks 17 plus location plus 2 optional (income goal, free-text week), with no minimum-hourly question. · Step 5 says the report has done Days 1-3, but 'Which tool, which day' still assigns Days 1-2 to the Workbook Fit Finder and Workflow 1. Both paths are offered without saying which one is primary. · 'The seven files' lists 00-06 PDFs and the workbook but leaves out 00_Your_Income_Fit_Report.html, which is the eighth file in the kit folder.
- **Compliance notes:** Refund wording differs: 'Full refund within 14 days of purchase, no questions asked, on top of your consumer rights.' (Help, refunds and corrections). The required sentence is followed by an extra clause. The footer uses the exact wording. · 'A fictional mother in Australia' is labelled fictional and 'not customer outcomes'. This is acceptable: it is not an AI person and not a testimonial.

### The Income Fit Test — Workbook (`workbook`)

- **Price:** — · **Status:** Part of the Income Fit Test kit · **Version:** 1.3 (Start Here sheet B3: 'Version 1.3 · 21 October 2026'; Options A26 notes v1.3 changes)
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'The Fit Finder scores your circumstances against researched options; it does not know whether your customers will pay.' and 'The rate you charge and the return you earn are different, because admin and marketing hours are real and unpaid.' (Start Here B18; 2A Service B3)
- **Contents:** Nine-sheet spreadsheet: Start Here, 1 Fit Finder, Income Pathway, 2A Service, 2B Product, 2C Asset, 3 Scorecard, Audit and Options. 795 formulas. The Fit Finder scores all 23 options from the Options database against 17 answers plus country. Each option gets lifestyle, practical-readiness and commercial scores (each of 12, total of 36), hard filters with stated reasons, a priority bonus and a deterministic rank key. The three Reality Calculators model pessimistic, base and optimistic scenarios, breakeven and start-up recovery, plus a 5/10/15-hours table (Service and Product only). The Scorecard implements the evidence-gate verdict (NEXT TEST, ADJUST, STOP or INSUFFICIENT EVIDENCE). The Audit sheet holds 20 PASS/FAIL checks against the pre-loaded inputs. Start-up figures are converted from A$ at fixed early-October 2026 rates.
- **In Empire Studio:** Not built
- **Known issues:** Answers 'Prefer selling products or services?' (C16) and 'Prefer recurring clients or one-off projects?' (C17) are collected but not used in any scoring or filter formula. They only appear as text on Income Pathway B8. In the default sample ('prefers services and recurring clients'), #1 and #2 are Project-type options. · Options columns P (rate evidence), X (pitching load), M (Product/Service/Asset), N (Recurring/Project) and C (group) feed no formula. The cards say the four dots 'feed the Fit Finder's commercial score', but pitching (X) is not part of COMMERCIAL FEASIBILITY (AU = demand + leverage + competition + speed). · AO 'Checks or resources needed (info)' is calculated but not used in PRACTICAL READINESS (AP = 2×skills + capital + tech).
- **Compliance notes:** Income goal input (C23) is framed as 'Context only — a goal is not evidence it can be earned.' Acceptable. · Calculators label every scenario 'Scenario, not a forecast'. No income claims found.

### Brand-in-a-Box (guide) (`brand-in-a-box`)

- **Price:** US$9 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** unknown (PDF CreationDate 22 Oct 2026; no version in text)
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "look real on day one." (cover)
- **Contents:** Three-page guide to four editable templates (Service_Menu.pptx A4, Price_List.pptx 4:5, Six_Launch_Posts.pptx six 4:5 posts, Etsy_Banner.pptx 4:1) for Canva, PowerPoint, Keynote or Google Slides. Gives import steps and a 'Make it yours in ten minutes' list: swap the fictional example businesses (Larkspur Ledger, Quillwort & Co. Flowers), change one accent colour (terracotta #B5543C) everywhere while keeping the cream and near-black, and use Cormorant Garamond (headings) plus Inter (text) or 'any elegant serif plus a clean sans'. It also says to use only real customer quotes with permission and only real founding offers and 'usually' prices. Page 3 is a single preview image of all templates. There is no brand strategy method: no positioning, ideal customer, personality, tone or photo direction exercises.
- **In Empire Studio:** Not built
- **Known issues:** The template files themselves (catalog FILES: 'Her-Little-Empire_Brand-in-a-Box.zip') are not in the folder; only the guide PDF is. · No method for positioning, ideal customer, brand personality, tone of voice, photo direction or colour selection beyond 'pick your own [accent]'. · Cream and near-black hex values are not given (only #B5543C).
- **Compliance notes:** 'Kind words' post rule: 'a real quote from a real customer, used with their permission. Never invent one.' Compliant. · Preview shows a founding offer 'The Tidy-Up for $380 (usually $480) until 30 November' as a fictional example; compliant only if users follow the stated rule ('Only show a "usually" price if it is the price you actually charge').

### Her Little Empire visual identity (`brand-system`)

- **Price:** — · **Status:** Internal / brand asset · **Version:** brand book v1 / print style v2, Oct 2026
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Consistent, recognisable brand.
- **Contents:** Colour tokens, font roles, devices (running head, numbering, footnote, one rose word), imagery do/don't, motion and the two-second check.
- **In Empire Studio:** Empire Studio's colours, fonts and labels
- **Known issues:** Resolved (founder, 22 Oct 2026): Bodoni Moda 800 for headings, grey #564B4E, no stock photos of people. The brand book v1 still says #6E6264, 700 and allows stock photos; see content/CORRECTIONS.md.
- **Compliance notes:** The brand book footer names the former trading entity. Replace it with: Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com (content/CORRECTIONS.md).

### Sell It Simply Workbook (`sell-it-simply-workbook`)

- **Price:** — · **Status:** Finished file, unreleased · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "A product for everyone speaks to no one in particular." (Module 1 intro); "Sell It Simply is about the months after: who it is for, how it is shown, how it is priced, where it is found, and a routine you can keep." (Start here)
- **Contents:** Companion workbook to a 'Sell It Simply video course' (8 modules), for the months after a product is live. Covers positioning in the customer's own words (a 'Find her words' method, a positioning card and a one-sentence promise), a six-part sales page template, a six-image shot list and image honesty test. Also covers price ladders, upsell/cross-sell/bundle/order-bump wording, faceless Instagram with comment-to-DM, Pinterest (10 pin-title formulas) and Etsy facts. Includes email consent basics for five countries, a four-email welcome sequence, a two-week launch plan, honest review rules and request templates, and a weekly numbers tracker with a school-hours selling week. Facts are labelled FACT/EST/UNKNOWN (checked Oct 2026). JSON and PDF match; the PDF adds only cover, contents, numbering and footer.
- **In Empire Studio:** Methods: homepage_copy, product_listing, image_briefs, email_sequence, theme_brief; named steps in Empire Studio's own brand_blueprint method
- **Known issues:** Not listed in catalog.py: no price, no bundle, not on Gumroad per ON_GUMROAD; the 'Sell It Simply video course' it accompanies is also absent from catalog.py (catalog 'video-course' is the Income Fit Test video course). · Version not in JSON. · No Shopify-specific guidance (channels covered: Instagram, Pinterest, Etsy, Gumroad).
- **Compliance notes:** Refund wording is delegated to the seller ('[Your refund note, in line with consumer law in your country]'); not the mandated HLE wording. Owner decision needed if Empire Studio generates refund text. · Social-proof example '"made by a mum who uses it every week" - only if true' is conditional; acceptable but touches the faceless-founder rule if generators default to family references.

### AI Business Assistant Pack (`ai-business-assistant-pack`)

- **Price:** US$12 · **Status:** Finished file, not listed on Gumroad · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Sixty copy-and-paste prompts that help you draft, plan and organise your side business with any AI chat assistant, safely." (tagline); "AI is a helpful drafting partner. It is not a source of truth and it is not a professional adviser." (Using AI safely)
- **Contents:** Sixty fill-in-the-blank prompts for any AI chat assistant, in 10 sections: finding customers, writing your offer, emails and DMs, social content, listings and product descriptions, admin, pricing thinking, client delivery, reviews and feedback, and weekly planning. Opens with an 'About me' context starter and five prompting habits, and an AI safety checklist (check facts, no private data, disclose AI where required, no fake reviews). Prompts build in HLE guardrails such as 'No hype words', 'Do not invent features', 'Mark any answer that depends on my policies with [CHECK]', 'Do not suggest a market rate' and 'Do not predict income'. JSON and PDF match exactly (0 strings missing).
- **In Empire Studio:** Ideal-customer, benefits and FAQ prompts in the methods
- **Known issues:** Not on Gumroad per catalog.py ON_GUMROAD. · No prompts for brand palette, typography, photo direction, store theme or SEO meta descriptions. · Version not in JSON.
- **Compliance notes:** Prompt 6.6 (simple terms draft) and the 'legal-style wording' note could produce legal-style outputs for a specific user. The pack labels them as starting templates, but in Empire Studio this must not become a personalised legal output. · Strong compliance otherwise: forbids fake reviews and testimonials and presenting AI text as a customer's words.

### First 5 Customers (`first-5-customers`)

- **Price:** US$7 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** unknown
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "You don't need a big audience to test an idea. You need five real conversations and one person willing to pay." (Read this first)
- **Contents:** Twenty-page Income Fit Test add-on with word-for-word outreach scripts for each of the 23 Opportunity Cards. A 'Read this first' page sets the rhythm: five new personalised messages a day on Days 3-12, one follow-up 3-4 days later, log every reply, and evidence = payment, deposit, pre-order, booked paid session or signed quote. Three safety rules cover messaging only people with a real reason, following platform rules, and never inventing proof. Each option page has where to find your first five, a watch-out, and four scripts: first message, follow-up, the ask (Scorecard evidence) and a review request. Option 17 covers Shopify store set-up for local brands (a service, not a Shopify seller's own launch).
- **In Empire Studio:** Honesty rules in the email_sequence method
- **Known issues:** No version stated; no JSON source. · No email-list launch sequence: scripts are 1:1 messages, not a broadcast sequence to subscribers. · No option for a Shopify product seller's own launch (option 17 is a Shopify set-up service).
- **Compliance notes:** Option 7 script begins 'I'm a local mum ...': a user-voice template, not Vee, but generators should not default to family references (faceless founder rule). · Review requests target customers who are pleased ('I'm so glad the sessions are helping'), while Get Found's Google Business Profile page says 'Don't ask only happy customers for reviews'. Internal tension.

### Get Found (`get-found`)

- **Price:** US$7 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** unknown (each platform page says 'CHECKED 19 OCTOBER 2026')
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Anyone selling a trick to 'beat the algorithm' is guessing. The platforms publish the basics, and they are surprisingly similar." (Read this first)
- **Contents:** Thirteen-page Income Fit Test add-on on how buyers discover sellers on 12 platforms, 'in each platform's own words'. Opens with four shared ranking principles (relevance: use the words buyers type; completeness; satisfaction; consistency) and three things that never work (buying engagement, keyword stuffing, moving buyers off-platform). Maps each of the 23 options to 1-3 platforms and gives a 30-minute weekly routine. Twelve platform pages (Instagram, Pinterest, LinkedIn, Etsy, eBay, Depop, Facebook Marketplace, Google Business Profile, Google Search (simple website), Airbnb, Preply, Fiverr) each list how you're found, five 'do this week' actions, three things to avoid and the official pages checked.
- **In Empire Studio:** SEO and title rules in the product_listing method
- **Known issues:** No Shopify page or Shopify SEO guidance (Shopify only appears as option 17's platforms: Google Business Profile, LinkedIn). · Nothing on collection descriptions. · Meta description guidance is one line ('Clear, unique page titles, short meta descriptions and descriptive link text'); no length.
- **Compliance notes:** Discourages buying reviews/engagement and asking only happy customers: compliant.

### Your Little Offer Kit (`little-offer-kit`)

- **Price:** US$19 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Make and launch a small, honest US$7-27 digital product in one weekend, from idea to Gumroad link." (tagline); "One problem, one person, one result." (Start here)
- **Contents:** Walks a beginner from idea to a live US$7-27 digital product on Gumroad in one weekend (or four evenings). Gives 25 example ideas, a four-question 1-5 scoring worksheet (14+ = good weekend project, below 12 = narrow it) and a one-sentence promise formula. Includes an hour-by-hour weekend plan, an outline template, simple design rules, file-format guidance and a quality checklist. Covers pricing tiers and five steps to a price, Gumroad setup and fees (FACT/UNKNOWN labelled, checked Oct 2026), and templates for product description, receipt, refund note and sales page. Ends with 5 launch posts, 5 story slides, 3 DMs, a launch email, after-launch measurement and a sources table. JSON and PDF match: every JSON string appears in the PDF; the PDF adds only cover, contents, section numbers and the legal/refund footer.
- **In Empire Studio:** Methods: product_listing, homepage_copy, email_sequence, design rules
- **Known issues:** Version not in JSON (PDF only). · Card-processing fee on Gumroad is UNKNOWN by the kit's own label. · No Shopify guidance: the kit is built around Gumroad (with Etsy/Stan/Payhip alternatives), so Shopify setup, fees and checkout are absent for Empire Studio.
- **Compliance notes:** Refund policy note template (Templates section) offers '[we offer refunds within [X] days ... / we handle refund requests case by case]': this is a template for the buyer's own product, but it differs from the mandated wording 'Full refund within 14 days of purchase, no questions asked.' Owner should decide whether Empire Studio may generate any other refund wording. · PLR/MRR are mentioned only to reject them ('Why we avoid PLR and MRR'): not a violation.

### Price It Right (`price-it-right`)

- **Price:** US$5 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** unknown
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Set your first price, quote it without flinching, get paid on time, and raise it when the evidence says you can." (cover)
- **Contents:** Seven-page Income Fit Test add-on on setting and defending a first price. Step 1 sets a price from three numbers: the floor (all hours x minimum hourly return + costs + fees), the market (low/middle/high of five comparable offers) and the value to the buyer, plus decision rules and a worked example. Step 2 chooses a price format (hourly, fixed package, retainer, product, paid pilot) and gives a package fill-in template. It provides quote and invoice templates, word-for-word scripts for price conversations, founding-price endings and price rises, payment terms, and an after-five-customers price check. No JSON source exists; the PDF is the only version.
- **In Empire Studio:** Not built
- **Known issues:** No version stated. · No JSON/structured source. · Depends on the Income Fit Test 'Reality Calculator' and 'Go / No-Go Scorecard' (out of scope) for the minimum hourly return input.
- **Compliance notes:** Founding price scripts require a real end date and real 'who gets it': compliant with no fake urgency. · Refund mention: 'write your policy down before your first sale' (seller's own policy); footer carries mandated wording.

### Side Income Money System (`side-income-money-system`)

- **Price:** US$19 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "A simple way to track every dollar in and out, set tax money aside, and walk into tax time with a tidy pack." (tagline); "Keeping business money apart from household money is the single most useful thing you can do." (Step 1)
- **Contents:** Guide to an accompanying spreadsheet (Start here, Income log, Expense log, Tax set-aside, Monthly summary, Year-end checklist) for tracking side-income money. Explains setting up a separate account and a receipts system, and lists the income and expense log columns (business amount = total x business-use %). The tax set-aside is profit (income minus business expenses, floored at zero) x a user-chosen percentage; no percentage is recommended. Includes general deductibility principles, registration thresholds and record-keeping periods for AU, US, UK, Canada and NZ (FACT, with day-level check dates), and a benefits-reporting reminder. Also a 20-minute monthly routine, a year-end pack checklist and when to see an accountant. JSON and PDF match; the PDF adds cover, contents, numbering and footer.
- **In Empire Studio:** Not built
- **Known issues:** The spreadsheet (catalog FILES: 'Her-Little-Empire_Side-Income-Money-System.xlsx') is not in the folder, so cell formulas, the 75% pink threshold, the drop-downs and how fees are 'carried across' cannot be verified. · It is ambiguous whether platform fees are entered once in the Income log ('Fees deducted') and copied automatically to expenses, or must also be entered in the Expense log (Income log tip: 'the sheet can carry them across'; Step 4: income 'plus fees' and expenses 'including fees'). · No pricing formula exists in this product, although the brief pairs it with Price It Right.
- **Compliance notes:** The word 'counsellor' ('free financial counsellor') appears; it is not 'counsel' and not a credential, so not a violation.

### 100 Faceless Hooks (`100-faceless-hooks`)

- **Price:** US$9 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Start here' intro: 'A hook is the first line someone sees. On a faceless account, it does the job a face would do: it makes the right person stop.' Tagline: '...so you never start from a blank slide again.'
- **Contents:** A swipe file of 100 numbered fill-in-the-blank hooks for text-on-screen reels, carousel covers and story slides, grouped by goal (cover; 'How this swipe file works'). Seven goal groups: Stop the scroll (1-20), Make them save (21-35), Make them comment (36-50), Make them share (51-60), Build trust while faceless (61-70), Soft sell / lead to the offer (71-85), Story slides (86-100). A seven-step 'From hook to post' method and five worked examples (VA, Etsy printables, tutoring, baking, Pinterest management). 20 'comment KEYWORD' calls to action, plus a rules checklist covering engagement bait, giveaways and approved automation tools. A 'Make it yours' worksheet, a hook rewrite formula, a 'What not to do' list and a 7-day hook practice plan of about 20-30 minutes a day (EST).
- **In Empire Studio:** content/hooks/hooks.json (100 hooks, verbatim) used by social_content
- **Known issues:** Hooks have no tags, formats or per-hook notes in the source; category is only the section's goal. · Worked example #22 quotes the hook as '[Number] [templates] for [task]...' but hook 22 reads '[Number] [templates / scripts / prompts] for [task]...' (minor mismatch). · No check date for the Instagram engagement-bait and promotion rules cited.
- **Compliance notes:** CTA 2, CTA 13 and the closing callout promote HLE's own free Fit Check / Income Fit Test and the handle '@herlittleempire.co'. These must be stripped or replaced for Empire Studio users. Whether '@herlittleempire.co' is the correct handle is unknown, and no other file in scope confirms it. · Hook 81 'Why we priced [product] at [price]' and soft-sell hooks are fine, but generated posts must keep the 'only use a hook if the post delivers exactly what it says' rule.

### 30-Day Faceless Content Plan (`30-day-faceless-content-plan`)

- **Price:** US$17 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** 'Start here' intro: 'This is a month of Instagram content you can fill in and post, without ever showing your face. Every day has a format, an idea, a hook, a caption template and a story prompt. You bring your niche, your offer and your words.'
- **Contents:** A done-for-you month of Instagram content for a faceless small business selling a service or digital product: 12 reels, 10 carousels and 8 story days (cover; verified by counting the Days 1-30 table). Uses a teach/trust/show/sell rhythm over four weekly focuses, with week 4 (days 22-30) as 'a gentle launch' of the user's offer. Each day has format · type, idea, hook and template/notes, plus a full caption template (story days include frame-by-frame scripts) and a daily story prompt. Ten carousel templates T01-T10 (PowerPoint files that open in Canva) are mapped to days. A routine section gives a 30-45 minute daily option and a batch option (about 3-4 hours a week). Also includes a four-format explainer, 25 b-roll ideas, keyword/hashtag/posting-time and platform-rule guidance, an accessibility checklist with an alt-text formula, a tracking sheet and a day-30 review.
- **In Empire Studio:** Method: social_content (weekly rhythm, launch week days 23–29)
- **Known issues:** Carousel templates T01-T10 ('Carousel-Templates.zip' in catalog.py FILES) are not in the source folder. · Inconsistency: Day 13 plan row says 'Share the results the next day', but the Day 13 caption says 'On day 16, share the results' and story prompt Day 16 shares Day 13's results. · No hashtag examples (only bracketed sets A/B/C). No Shopify-specific guidance; the 'offer' is a service or digital product.
- **Compliance notes:** Launch days handle urgency correctly: Day 23 'Only mention a close date if it's real', Day 29 'Countdown sticker only for a real deadline', week-4 callout 'No pressure, no fake countdowns'. Day 27 case study is 'Your own real work only, with written permission. No made-up numbers.' · Day 9 caption example 'at home with a toddler' is a buyer template example, not about Vee. Low risk.

### Comment-to-DM Kit (`comment-to-dm-kit`)

- **Price:** US$12 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Tagline: 'Set up "comment a keyword, get a DM" on Instagram for your small digital-product or service business, with word-for-word flows, captions and an honest way to track it.'
- **Contents:** Sets up 'comment a keyword, get a DM' on Instagram using ManyChat, with a free manual saved-replies alternative (cover; 'No tool' section). Opens with dated platform rules (checked Oct 2026): one private reply per comment within 7 days, a single-block first DM, the 24-hour window opening only on a reply or regular-button tap, once per person per post, and stricter rules for Live. Gives keyword rules and 30 keyword ideas across 7 niches, a ManyChat connection-method table, a Free-plan table (25 active contacts, 4 live automations), and a step-by-step build of the comment automation. Three word-for-word DM flows (freebie delivery; product link with a qualifying question; service enquiry to booking), each with a follow-up and a polite exit. Also an optional email-consent ask, 10 caption templates and 5 story-reply prompts. Closes with a messaging-window table, a 'what not to do' list, spam-law pointers by country, a testing checklist, troubleshooting and a weekly tracker with no targets.
- **In Empire Studio:** Listed as a social_content source; templates not yet used
- **Known issues:** Several items are explicitly UNKNOWN: how 'active contact' is counted, delays/follow-ups on Free, keywords per trigger on Free, the Instagram ads trigger, native Instagram comment-to-DM automation, sticker-tap triggers, and whether 'comment KEYWORD' posts get less reach. · No Shopify integration guidance (e.g. product links with tracking only via '?src=ig-planner'). · Some sources are weak: 'Commonly advised by ManyChat community moderators', a ManyChat community moderator (July 2026), and an 'Inro guide' for menu names.
- **Compliance notes:** Platform automation risk: depends on third-party ManyChat and Meta rules that the file itself says change often. Every rule carries an Oct 2026 date, so it must be re-verified on a schedule before the app shows it. · Consent: the optional email ask (Flow 1) includes privacy-policy and opt-in wording with 'A starting template, not legal advice' — good, but the app should not auto-enable email capture.

### Faceless Content System Workbook (`faceless-content-system-workbook`)

- **Price:** — · **Status:** Finished file, unreleased · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Cover: 'show up without your face.' Tagline: 'The companion workbook to the Faceless Content System course: one page per module, plus your planners and trackers.' Module 1 intro: 'Trust comes from showing real work, a clear method and honest limits.'
- **Contents:** Companion workbook to a 'Faceless Content System' course: one page per module (6 modules) plus planners and trackers (tagline; 'Start here'). Module 1 gives six faceless formats with what each is 'often good for' and effort, a 25-item no-face b-roll list and an AI presenter labelling rule. Module 2 gives four hook kinds (Stop, Save, Share, Conversation), four reusable hook formulas, a four-part caption template and an 'Honest caption check'. Module 3 covers grid style, series planning, a profile tidy-up and a 9-post grid planner; Module 4 is a short comment-to-DM set-up with public replies, two DM templates and a test checklist. Module 5 is a 'two-hour week' batching plan with a weekly output checklist (3 reels, 1 carousel, 1 quote); Module 6 defines five numbers to read about seven days after posting and a keep/tweak/drop rule, followed by a 30-day tracker and review.
- **In Empire Studio:** Method: social_content (formats, caption template)
- **Known issues:** Not in catalog.py: no price, no bundle, no Gumroad status. Whether the 'Faceless Content System course' exists or is sold: unknown. · The course videos the workbook accompanies are not in the source folder. · Callout says 'Everything here was checked when we made it' but gives no check date.
- **Compliance notes:** Unlabelled time figures (Module 5) conflict with the 'label every figure FACT/EST/UNKNOWN with check date' rule. · Checklist item 'Packing a school bag, then sitting down to work' and the privacy callout about children's faces/school logos: content is consistent with the faceless-founder rule, but generated b-roll briefs must keep the 'check nothing private is visible' step.

### Faceless & Not Anonymous Workbook (`faceless-not-anonymous-workbook`)

- **Price:** — · **Status:** Finished file, unreleased · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Module 1 intro: 'Faceless means you choose not to show your face. Anonymous means nobody can tell who is responsible. Be the first, never the second.' 'Start here' callout: 'people trust what they can check. A face is only one thing they can check, and not the most important one.'
- **Contents:** Companion workbook to a 'Faceless & Not Anonymous' course, with one page per module, built on the idea 'people trust what they can check' ('Start here' callout). Module 1 separates faceless ('you choose not to show your face') from anonymous ('nobody can tell who is responsible') and notes when faceless is harder (one-to-one personality services, coaching, in-home local services, regulated work). Module 2 is a five-layer trust stack (Name, Contact, Policies, Pages, Replies) scored 0-2, with templates for a plain-words refund policy and a founder contact block. Modules 3-4 cover recognisable look/voice/signature and 'proof without hype' (remove-the-hype checklist, FACT/EST/UNKNOWN labelling table, a one-time review request). Modules 5-6 give boundaries, a founder note and three replies to 'who's behind this?', an AI/helper disclosure checklist, a 14-item trust audit scored out of 28, an ask-a-friend script and a three-monthly re-audit schedule.
- **In Empire Studio:** Trust rules in social_content and theme_brief
- **Known issues:** Not in catalog.py: no price, no bundle, no Gumroad status. Course videos not in source folder; whether the course is sold: unknown. · No jurisdiction-specific display rules beyond 'for example, an ABN in Australia'; the user is told to check their register/regulator. · Trust stack has no guidance on Shopify-specific pages (policy pages, contact page settings).
- **Compliance notes:** Refund policy template ('within [14] days ... refund you in full. No questions, no forms.') and founder block ('[14]-day refund, no questions') differ from the required wording. They are templates for the buyer's own business, so they may be acceptable, but the app must never use them as Her Little Empire's own refund text. · Founder-note and contact-block examples use family details ('e.g. mum of one', 'a mum of one on the coast of NSW') and the rude reply offers '[optional: for my family's sake]'. These are buyer-facing examples, but if reused in HLE's own copy they would conflict with 'keep Vee's family off the internet'. Flag for owner.

### The 90-Day Grow Plan (`90-day-grow-plan`)

- **Price:** US$24 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "This plan is for after a first test went well: real people showed real interest." (Start here); "Feeling busy is not evidence. These three numbers are." (Your measures)
- **Contents:** A 90-day plan for after a successful 14-day test, in three 30-day phases (Prove it again, Make it repeatable, Make it steady) with weekly goals and 30-60 minute daily tasks. Decisions at day 30, 60 and 90 rest on three measures: paying customers, repeat customers and real hourly return = (money received - all costs) / all hours, with a worked example. Includes a baseline and own-minimums page, illustrative customer minimums by offer type, a raising-prices checkpoint at day 60 (3+ of 6 signs means test a higher price), four simple systems (customer sheet, templates, payments, records), a weekly review worksheet, stop/pivot/pause options, energy boundaries and a day-90 decision page. JSON and PDF match; the PDF adds cover, contents and footer.
- **In Empire Studio:** Not built
- **Known issues:** Depends on the Income Fit Test Go/No-Go Scorecard and 14-day test (out of scope). · No launch email sequence content; only a price-change message, a kind boundary reply and a list of template names (enquiry reply, offer, confirmation, onboarding, delivery, follow-up, 'not now'). · Version not in JSON.
- **Compliance notes:** Explicitly sets no income targets ('There are no income targets in this plan'): compliant. · Terms of service starter carries the standard 'not legal advice' line.

### Client Paperwork Kit (`client-paperwork-kit`)

- **Price:** US$19 · **Status:** Finished file, not listed on Gumroad · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Good paperwork is a kindness to you and your client. It sets expectations before anyone is disappointed." (Start here)
- **Contents:** Starting templates for a service client journey: proposal, simple service agreement (12 clauses plus Schedule A), onboarding form, privacy note, invoice reminder sequence (with invoice, 3 days before, +1, +7, +14 days), scope-change confirmation, offboarding/handover email, and testimonial request and permission form. Every template is headed '[STARTING TEMPLATE – edit before use. A starting template, not legal advice. ...]'. Includes a clause-by-clause table of questions to ask a lawyer, data-habit checklists, and a 'Get it checked' page listing where to find legal help in AU, US, UK, Canada and NZ. JSON and PDF match apart from one template header string the comparison script flagged because of an en-dash; the PDF adds cover, contents and footer.
- **In Empire Studio:** Not built
- **Known issues:** Not on Gumroad per catalog.py ON_GUMROAD (in FILES/PRICE and The Whole Empire only). · Version not in JSON. · Clause 7 and 8 text is truncated in this audit's rendering only; full text is present in the JSON/PDF.
- **Compliance notes:** Personalised legal outputs: turning these templates into an AI generator that fills in agreements for a specific user would risk the 'no personalised legal outputs' rule. Keep them as static starting templates with the standard disclaimer. · The testimonial content is about collecting real testimonials with consent: compliant.

### Course manuscripts and assignments (`course-manuscripts`)

- **Price:** — · **Status:** Not supplied · **Version:** n/a
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** n/a
- **Contents:** No manuscripts were in the folder. The Faceless Content System workbook is described as a course workbook; the video course is listed in catalog.py but not supplied.
- **In Empire Studio:** Not built
- **Known issues:** Manuscripts and assignments

### Etsy Digital Downloads Starter Kit (`etsy-digital-downloads-starter-kit`)

- **Price:** US$29 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Tagline: 'Pick a micro-niche you know from the inside, check it has room, and plan, list and launch your first ten digital downloads on Etsy.' 'Start here': 'The trade-off: the shop is small and slow at first.'
- **Contents:** Takes a beginner from picking a micro-niche to planning, listing and launching a first ten digital downloads on Etsy over about 30 days of short sessions ('Start here'). Niche selection via a 5-step idea process and an 8-question scoring worksheet (out of 40), with a rule to drop ideas scoring 1 on insider knowledge or trademark safety. Free demand checks (logged-out search bar suggestions, a page-one review-count check labelled a 'ROUGH signal only') and a 'What to avoid' section (trademarks, flooded printables, copying, Canva licence). A first-10-products 'family' plan, a listing title formula, tag guidance, a description structure, photo/mock-up, pricing (fees deliberately not listed) and file-delivery checklists, plus a 'Start here' buyer page template. A launch checklist, Etsy-compliant review rules, Pinterest as a second traffic source and a week-by-week 30-day plan.
- **In Empire Studio:** Not built
- **Known issues:** No Etsy fee figures (deliberate: 'We don't list Etsy fee amounts here because they change'); listing title length, tag count, image sizes and file limits are all 'check Etsy's current' with no figures. · No Shopify equivalent steps (store setup, digital delivery app, policies). · Time to first sale is UNKNOWN / 'weeks to months (EST)'.
- **Compliance notes:** Feedback/outreach messages limited to 'people you know or groups whose rules allow it', which is consistent with spam rules. · Unlabelled undated platform rules (IP removals, review incentives) conflict mildly with the labelling rule.

### The 5-Question Fit Check (`fit-check-freebie`)

- **Price:** Free · **Status:** Free on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF footer: 'Version 1.1 · October 2026'); JSON has no version field
- **Sales URL:** https://herlittleempireco.gumroad.com/l/fit-check (founder-supplied; not checked live)
- **Customer problem or promise (register; quotation marks mean quoted from the product):** "Most side-income ideas don't fail because they're bad. They fail because they don't fit the week you actually have." (Start here)
- **Contents:** Free printable that filters side-income ideas against the user's real week in ten minutes. Five questions: weekly hours, longest reliable block, evenings/weekends, start-up money and preferred customer contact. Each of up to three ideas is scored 0/1/2 per question (max 10): 8-10 worth testing first, 5-7 possible, 0-4 park it. Six red flags (including licences, upfront spend, cold messaging only, promised income/pay-to-join). Ends with a 14-day test outline and an upsell to the Income Fit Test. JSON and PDF match.
- **In Empire Studio:** Free tier of the FIT Finder: top three ideas, one line on why each fits
- **Known issues:** Not in catalog.py (freebie; no price or bundle). · How each idea is judged to 'fit' each answer is left to the user; no mapping data (the Income Fit Test database, out of scope, would supply it).
- **Compliance notes:** Refund wording '14-day refund' (Next step callout) is shortened and differs from the mandated 'Full refund within 14 days of purchase, no questions asked.' (The PDF footer does carry the full wording.) · Rejects MLM/pay-to-join: compliant. No income claims, testimonials or urgency.

### Pinterest Manager Starter Kit (`pinterest-manager-starter-kit`)

- **Price:** US$29 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Tagline: 'Start a small Pinterest management service for product brands and bloggers, with clear packages, workflows and honest reporting.' Intro: 'A Pinterest manager helps a brand show up in those searches, consistently, month after month.'
- **Contents:** Helps a beginner start a small Pinterest management service for product brands and bloggers, with packages, workflows and reporting (tagline). Covers what the role does (keywords, pin design, scheduling, board optimisation, monthly reporting), who pays (including 'Etsy and Shopify sellers') and honest watch-outs (offshore pricing, churn, US-centred demand). Templates: three illustrative packages with placeholder prices, a free 30-day-pins audit checklist and one-page summary, an 18-question onboarding questionnaire, and a monthly client report. Workflows: a 10-step keyword research process using the search bar, guided search and Pinterest Trends; a pin design checklist (2:3, 1000 x 1500 px labelled FACT, Oct 2026); and a 4-week pin calendar with a monthly rhythm. Scripts for warm-route client finding, boundaries and a day-by-day first-30-days plan.
- **In Empire Studio:** Not built
- **Known issues:** Package prices are placeholders; rate evidence exists only for the US. 'No Australian evidence in our research, and little for the UK, Canada or NZ'. · The Income Fit Test 'Pinterest management Opportunity Card' it builds on is out of scope. · No Shopify-specific pin/catalogue set-up steps beyond 'Rich Pins or product catalogue set up, if relevant'.
- **Compliance notes:** Founding-rate scripts are guarded against fake discounts ('Only call it a founding rate if your regular price is already set...'). OK. · Review request is permission-based. No income claims: the boundaries script says 'I can't promise specific traffic or sales numbers'. The rate figure is labelled EST.

### Tutor & Lesson Starter Kit (`tutor-lesson-starter-kit`)

- **Price:** US$29 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Tagline: 'Choose what and who you teach, set up simple lessons, bookings and policies, and find your first five students online.' Step 1 intro: 'Maths tutor is broad. Maths for adults returning to study is easy to choose.'
- **Contents:** Takes a beginner from choosing a subject and student type to booking a first five regular online students (tagline; 'Start here'). Compares four student types by hours and needs, and platform vs direct teaching. The 'platform rule' is that students met on a platform stay on it; Preply commission is given as an EST (Oct 2026). Templates: lesson plan, a 50-minute first-lesson structure, a trial-lesson script with platform and direct asks, welcome/reschedule/progress/payment messages and a 10-clause cancellation policy (marked 'not legal advice'). A safeguarding section lists background-check types by country (AU, UK, NZ, CA, US) and a safe-practice checklist for teaching children. A pricing worksheet with an illustrative per-hour calculation including prep time, a first-5-students plan and tracker, and a 30-day plan.
- **In Empire Studio:** Not built
- **Known issues:** All rates are 'UNKNOWN until you check'; the illustrative table has a [price] placeholder. · No Shopify relevance stated; selling lessons through a store is not discussed. · Safeguarding table gives check names only, with no dates, costs or eligibility details (explicitly varies).
- **Compliance notes:** Testimonial request is permission-based ('first name only. Happy to show you the wording first'), with a ban on incentives. OK. · Founding-rate ask is guarded against fake discounts. No income claims ('We make no promises about income or student numbers').

### VA & Online Business Manager Starter Kit (`va-starter-kit`)

- **Price:** US$29 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** 1.1 (PDF cover imprint: 'Version 1.1 · October 2026.' (not stated in the content JSON))
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** Tagline: 'Set up a small, steady virtual assistant service that fits your hours, with the scripts, templates and systems to run it calmly.' 'Start here': 'This kit walks you from "I could do that" to your first paying client and a calm way of working.'
- **Contents:** Sets up a small virtual assistant service that fits limited hours, from first 2-3 services to a first paying client, with a later VA-to-OBM path (tagline; 'Start here'). Service selection steps and six starter service ideas (including 'Order and supplier admin' for 'Shopify and Etsy sellers'), three illustrative packages (5, 10, 15-20 hours a week) and a one-page services menu template. A floor-rate pricing method (earnings + costs + tax set-aside divided by billable hours) with an illustrative example, and an AU$35-65/hour EST range to check. Client-finding openers, a 20-minute discovery-call script with a paid two-week pilot, onboarding/security checklists, a welcome email, 20 SOP templates, a weekly report and boundaries scripts. A tools overview by category, signs of OBM readiness and a day-by-day first-30-days plan.
- **In Empire Studio:** Not built
- **Known issues:** Rate evidence only for Australia ('2026', no month); US/UK/CA/NZ left to the user. · The Income Fit Test 'VA to OBM Opportunity Card' it builds on is out of scope. · No Shopify-store pathway; Shopify appears only as a client type.
- **Compliance notes:** Founding rate has an end date in writing (Pricing tips); review requests follow platform rules and ban writing reviews for clients. · Unlabelled legal statements (spam laws) conflict with the labelling rule. 'Clear boundaries protect your family time' is generic, not about Vee.

### Video Course (`video-course`)

- **Price:** US$6 · **Status:** On sale on Gumroad (founder, 22 Oct 2026; UNVERIFIED live) · **Version:** v1.3 per catalog.py
- **Sales URL:** Not recorded in the repo
- **Customer problem or promise (register; quotation marks mean quoted from the product):** unknown
- **Contents:** unknown — not in the folder
- **In Empire Studio:** Not built
- **Known issues:** Entire course
