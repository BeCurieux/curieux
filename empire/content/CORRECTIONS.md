# Corrections for the Her Little Empire documents

From Vee's answers to the audit (two rounds, 22 October 2026). Empire Studio already follows every decision below. This list is for the **documents** (the PDFs, the workbook and the generators in `source/`), so they say the same thing as the app.

Nothing here has been applied to a live file or a Gumroad listing. Each fix is for Vee (or her build scripts) to make on the next revision. Locations come from the audit records in [`audit/`](audit/) and the register ([`register.csv`](register.csv)).

## At a glance: what changes in each file

| File                                                          | Sections                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| The Income Fit Report (kit HTML and `source/report_src.html`) | §4a (patches ready)                                                |
| Start Here                                                    | §1 question count, §2 refund, §4b, §6 promise                      |
| Workbook                                                      | §1 version and questions, §3 labels, §4b calculators and scorecard |
| Opportunity Cards                                             | §1 version, §3 labels                                              |
| AI Shortcut System                                            | §1 version and Workflow 1, §3 labels, §4b Workflows 10–11          |
| 14-Day Test Plan                                              | §1 version and Days 1–2, §3 labels, §4b Day 14                     |
| Go / No-Go Scorecard                                          | §1 version, §4b                                                    |
| Rules Guides                                                  | §1 version, §3 (add FACT labels)                                   |
| `source/common.py`                                            | §1 version                                                         |
| Fit Check freebie                                             | §1 question count, §2 refund                                       |
| 14-Day Tracker                                                | §3 labels, §8 record keeping                                       |
| 90-Day Grow Plan                                              | §7 pricing                                                         |
| Brand-in-a-Box                                                | §3 labels, §7 founding-price example                               |
| Price It Right                                                | §7 (check its own worked example)                                  |
| 30-Day Faceless Content Plan                                  | §3 labels, §8 Day 13                                               |
| Brand book (visual identity)                                  | §1 sample count, §5 footer and brand, §6 promise                   |
| Other product PDFs with unlabelled figures                    | §3 (by document)                                                   |

## 1. 20 questions, v1.4, everywhere

| File                                                                           | Says now                                                                                   | Change to                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workbook, Cards, AI Shortcut System, 14-Day Test Plan, Scorecard, Rules Guides | "Version 1.3" (21 October 2026)                                                            | "Version 1.4"                                                                                                                                               |
| `source/common.py`                                                             | `VERSION = "Version 1.3"`                                                                  | `"Version 1.4"` (every generator that imports it picks this up)                                                                                             |
| Start Here                                                                     | "17 Fit Finder questions, plus where you live and the least you'd accept for an hour" (19) | "20 questions"                                                                                                                                              |
| Workbook (Fit Finder sheet)                                                    | "17 questions … (two more are optional)" plus location; no minimum hourly rate             | 20 questions, in the report's order. **This adds the minimum hourly rate input** (the report and the Scorecard's "Profitability on paper" both rely on it). |
| 14-Day Test Plan, Days 1 and 2                                                 | "questions 1-12" and "questions 13-15" (15 in total)                                       | Days 1 and 2 cover questions 1–20 between them                                                                                                              |
| AI Shortcut System, Workflow 1                                                 | skill areas are "questions 13 and 14"                                                      | questions 15 and 16 (the report's numbering)                                                                                                                |
| Fit Check freebie                                                              | "17 questions (plus 2 optional)"                                                           | "20 questions"                                                                                                                                              |
| Brand book sample                                                              | "17 questions (plus 2 optional)"                                                           | "20 questions"                                                                                                                                              |

## 2. Refund wording

Use exactly: **"Full refund within 14 days of purchase, no questions asked."** Where consumer rights are mentioned, they go in their own sentence after it.

| File                                        | Says now                                                                                      | Change to                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Start Here, "Help, refunds and corrections" | "Full refund within 14 days of purchase, no questions asked, on top of your consumer rights." | "Full refund within 14 days of purchase, no questions asked. This is on top of your rights under consumer law." |
| Fit Check freebie, "Next step" callout      | "14-day refund"                                                                               | "Full refund within 14 days of purchase, no questions asked."                                                   |

The refund _templates_ inside Little Offer Kit, Sell It Simply, Faceless & Not Anonymous and the Tutor kit are for the buyer's own business and stay as templates.

## 3. Label every figure, with the date checked

Each figure needs FACT, EST or UNKNOWN and the date it was checked. In the FIT Finder, the opportunity text now carries its card's label for the 11 figures that were unlabelled in `opportunities.json` (`LABELS` in `src/lib/fit/data.ts`), so `opportunities.json` can take the same labels on its next revision. The Rules Guides mark EST and UNKNOWN but leave FACT implicit; add it.

The unlabelled figures and claims found, by document:

**The 14-Day Test Plan**

- Day 9: 'in Australia and Canada even one unsolicited commercial email can need consent (Spam Act, CASL), the UK has PECR, and in the US CAN-SPAM requires an opt-out.' Legal claim; not labelled FACT/EST and no check date.
- Day timings (20-60 min per day) and the claim 'replies are likelier' in the morning (Day 9 stretch). Unlabelled assertion.

**14-Day Tracker**

- 'most countries expect you to keep them for five to seven years' (Money log): unlabelled, no date, and contradicts Side Income Money System's FACT table (US: 3 years by default; UK: at least 5 years after the 31 January deadline). FLAG.

**The AI Shortcut System**

- 'Claude is at claude.ai; ChatGPT is at chatgpt.com. Both have a free version that is enough for this kit.' Platform claim; unlabelled and undated.
- Workflow 7 'Before you trust it': 'spam laws apply (Spam Act, CASL, PECR, CAN-SPAM)'. Legal claim; unlabelled and undated.
- 'The AI service may store what you paste' (privacy line). Platform claim; unlabelled.
- Example responses contain illustrative figures ($450-650 price range; $40 insurance; total start-up $180; fixed $60; variable 1.8%; $225 a week; reached 22 → 7 (32%) → 2 (29%); $47 spent; '$55-90 an hour'). They are presented as examples, not labelled FACT/EST.

**The Opportunity Cards**

- Card 2: Preply 33% until 20 hours, 18% after 400 hours, 100% of trial; italki about 21% (EST, Pensight Oct 2026). Repeated unlabelled in 'Why this might be a poor fit'.
- Card 8: A$10-50 per item, median about A$30 (EST, Airtasker Sept 2026); Airtasker 20% Bronze to 12.5% Platinum (FACT); package example 'five hems and two zips for A$120' (unlabelled).
- Card 10: Depop AU 0% seller fee since 22 July 2026, buyers up to 5% + A$1 (FACT). The 'Who pays' line repeats '0% in Australia since July 2026' without a label.
- Card 11: eBay AU free for non-Pro sellers up to A$25,000 in 12 months (FACT); Facebook Marketplace about 10% on shipped checkout (EST). The 'How you reach them' line repeats 'AU$25,000' without a label.
- Card 20: Etsy US$0.20 listing, 6.5%, 15% Offsite Ads (12% over US$10K), AU regulatory operating fee (FACT); real-estate packs US$17.50-26 (EST, Oct 2026); '92,100 sales and 8,600 reviews' shop statistic (unlabelled beyond the EST range); own Shopify store about A$50+/month (EST).
- Card 21: Fiverr guide US$150-400 / 300-1,200 / 500-2,000 a month (EST, Aug 2026); seller with 191 reviews US$400 per three-email flow (EST); Upwork US$35-79 packages, US$20-30 to US$50-150/hr (EST); Spam Act / ACL / TGA claims (unlabelled legal statements).
- Card 22: AUSIT minimum A$0.25/word, A$0.33 specialist, revision A$65/hr (FACT, Nov 2025); ProZ EUR 0.10-0.15 (EST); NAATI requirement (FACT); ProZ about US$150/year (unlabelled).
- Card 23: TPB, legal admission and AFSL requirements (FACT); pricing heuristic 'hours x your former day-rate equivalent plus 20-30% for scoping risk' (unlabelled method).
- Index excluded list: Redbubble 'tier fees take 26-50% of margin', 'non-hosted Airbnb in Greater Sydney (180-day cap)', 'Uber Carshare (closed Sept 2024)', 'BAS ... without registration (illegal)'. All unlabelled and undated on that page.
- Card body figures are labelled FACT/EST/UNKNOWN with per-card dates, but several repeated figures in 'Who pays', 'How you reach them' and 'Why this might be a poor fit' have no label (cards 2, 10, 11). The index and excluded list have no labels.

**The Income Fit Test — Workbook**

- Options K 'Min start-up (AU$, researched)' per option (0-400). Not labelled. The cards give wider EST ranges (for example card 8 'A$0-800 (EST)' versus K=100; card 15 'A$265-1,500 (EST)' versus K=400).
- 2A F10: 'Card payments are usually 2-3%; tutoring and freelance platforms often take 15-33%'. Unlabelled, undated.
- 2A F12 'Two hours is a realistic minimum'; F13 'many new businesses sell only a few hours in the first months'. Unlabelled assertions.

**Brand-in-a-Box (guide)**

- 'Both [Cormorant Garamond and Inter] are free in Canva and Google Fonts' (Make it yours): unlabelled claim, no check date.
- Canva import steps (Create/Upload -> Import file): unlabelled platform claim.

**Sell It Simply Workbook**

- Pinterest pin ratio 2:3 (1000 x 1500): labelled FACT but sourced partly to 'current pin-size guides' (secondary), which by the system's own definition (Side Income Money System) would be EST.

**AI Business Assistant Pack**

- No figures, fees or statistics are stated. Platform-rule claims are general and unlabelled: 'Some marketplaces require you to disclose AI-generated images or designs' (Section 5 callout); 'some claims (health, earnings, eco, best) are regulated in many countries' (Using AI safely).

**First 5 Customers**

- Platform rules stated without FACT/EST label or check date: Preply/italki off-platform ban; Etsy bans discounts/freebies for reviews; eBay off-platform/feedback rules; Depop, Airbnb, Fiverr and Upwork off-platform rules; Canva licence terms; Shopify collaborator access (Options 2, 6, 10-15, 17, 19-22).
- Legal/regulatory claims without labels or dates: spam laws (Spam Act, PECR, CASL, CAN-SPAM); AU BAS-agent registration, UK AML supervision, US PTIN (Option 3); working-with-children checks (Option 1); FTC/ASA/ACCC/Ad Standards disclosure (Options 13-14); NAATI certification (Option 22); Fair Work Ombudsman/ACAS (Option 16); short-stay registration (Option 15).
- 'regular reselling can count as a business for tax' (Option 11): unlabelled.

**Get Found**

- Specific rules/figures: Etsy 13 tags, each up to 20 characters; eBay title under 80 characters; Instagram Reels 9:16; Pinterest 2:3; Preply hidden at 5 absences, 40% short-notice reschedules or 20% cancellations for tutors with 5+ bookings in 90 days, and messages unanswered over 24 hours; Google says meta keywords aren't used. All are covered by the page check date but unlabelled.
- 'Judge a platform after six to eight weeks' (routine): unlabelled estimate.

**Your Little Offer Kit**

- Stan Store Creator US$29/mo or US$300/yr, Creator Pro US$99/mo, 14-day trial, no Stan transaction fee: labelled FACT (checked Oct 2026) in Sources, but the in-body Alternatives row says only 'checked Oct 2026 on stan.store' without the FACT label; the US$300/yr figure is absent from the Sources row.
- Legal/platform claims without labels: paper sizes by country (callout in Build it); consumer-law rights in AU/UK/EU (refund callout); spam laws named by country (Scripts callout).

**Price It Right**

- Unlabelled legal claims: 'write "Tax invoice" only if you are registered for GST'; ABN in Australia / NZBN in New Zealand; 'Consumer law in your country gives buyers rights you can't remove (for example, the Australian Consumer Law)'.
- Payment-term rules (50% deposit; packages under $200 paid upfront; retainers monthly in advance, 30 days' notice; 30 days' notice for price rises) are HLE recommendations, unlabelled.

**Side Income Money System**

- Unlabelled legal claims: 'In Australia, only a registered BAS or tax agent may advise on GST or lodge for a fee' (When to see an accountant); 'Digital records are generally accepted if complete, readable and can't be altered' (receipts callout).

**30-Day Faceless Content Plan**

- Carousel: 'Up to 20 swipeable slides in one post (check the app, limits change)' (Platform limit, unlabelled and undated. Needs FACT + check date.)
- Stories 'disappear after 24 hours' (Platform rule, unlabelled.)
- Film vertically (9:16) (Format spec, unlabelled.)
- 3-5 hashtags per post; 'Hashtags still help a little' (Guidance, unlabelled.)
- Routine: 30-45 minutes a day; batch about 3-4 hours a week; review 20 minutes (Effort estimates not labelled EST.)
- Unlabelled platform figures (20 slides, 24 hours, 9:16) conflict with the labelling rule.

**Comment-to-DM Kit**

- Meta API caps each text at 1,000 bytes (Dated, unlabelled.)
- Set-up 'about 30 minutes'; prep 'Ten minutes' (Effort estimates not labelled EST.)

**Faceless Content System Workbook**

- Example two-hour week: 40 min, 50 min, 10 min, 5 min blocks (Module 5) (Time estimates not labelled EST; owner rule requires a label.)
- 'Wait about seven days after posting' before reading numbers (Module 6) (Guidance, unlabelled.)
- Unlabelled time figures (Module 5) conflict with the 'label every figure FACT/EST/UNKNOWN with check date' rule.

**Client Paperwork Kit**

- Unlabelled legal claims: consumer protection may apply to individuals; some terms may not be enforceable (service agreement callout); privacy laws may apply only above a certain size (privacy intro).

**Etsy Digital Downloads Starter Kit**

- Unlabelled undated platform rules (IP removals, review incentives) conflict mildly with the labelling rule.

**Pinterest Manager Starter Kit**

- In Australia and Canada even one unsolicited commercial email or DM can breach spam law; no bulk threshold (Legal claim, unlabelled and undated; points to regulators. Needs a FACT label and check date.)
- 'Pinterest results take months' / 'usually take a few months' (Unlabelled estimate.)
- Unlabelled spam-law statement conflicts with the labelling rule.

**Tutor & Lesson Starter Kit**

- Background-check names per country (WWCC, DBS/PVG/AccessNI, NZ Police vetting, vulnerable sector check, US varies by state) (Legal/regulatory pointers, unlabelled and undated.)
- Session lengths 45-60 min; first lesson about 50 minutes; trial 30 minutes; 90-second profile video; aim for three trial lessons in week 1 (Guidance figures, unlabelled.)
- Unlabelled safeguarding/legal pointers conflict with the labelling rule. PDF imprint refund wording matches exactly. No [the former trading entity] or lawyer terms.

**VA & Online Business Manager Starter Kit**

- Spam laws: Spam Act (AU), PECR (UK), CASL (CA), CAN-SPAM (US), UEMA (NZ); in AU and CA even one commercial email needs consent (Legal claim, unlabelled and undated.)
- Unlabelled legal statements (spam laws) conflict with the labelling rule. 'Clear boundaries protect your family time' is generic, not about Vee.

## 4. Day 14 rules and the calculator: the corrected Income Fit Report is the source of truth

Vee's decisions: the Income Fit Report is the source of truth for Day 14 and the calculator, and it **gains three things from the Scorecard and workbook**, because they're the honest version: a separate **"not enough evidence" verdict**, the **slow-buying market** path, and the **2 unpaid hours a week** allowance.

### 4a. The report itself (ready to apply)

The changes are written as patches. They were tested by applying them to the supplied v1.4 files and opening the result in a browser, with no script errors:

- [`corrections/report.patch`](corrections/report.patch) for `kit/00_Your_Income_Fit_Report.html` (the shipped file, including the scoring engine);
- [`corrections/report_src.patch`](corrections/report_src.patch) for `source/report_src.html` (the engine there is injected at `/*ENGINE*/`, so make the `top3` change in the engine source too: see the first two hunks of `report.patch`).

Apply from the `01_income-fit-test/` folder with `patch -p1 < report.patch` (and the same for `report_src.patch`). Empire Studio runs the same rules: `tests/fixtures/fit-reference-corrected.cjs` is extracted from the patched report, and the tests require identical top threes on 5,000 answer sets and identical calculator numbers on 2,000 input sets.

What the patches change:

| Part                 | v1.4                                           | Corrected                                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 14 verdicts      | Go, Adjust, Stop; "fewer than 5" as a footnote | **Not enough evidence yet** is its own verdict, checked first: "Fewer than 5 real conversations… That isn't a no; it's not enough information. Repeat Days 9-12 with a different channel or a sharper customer type… If a second round still can't reach five people, the problem is reach…" |
| Go                   | Service or product demand line only            | Adds: "Or, in a slow-buying market (B2B retainers, anything with approvals, high-ticket packages): 2+ people asked about price or timing unprompted, and their feedback was specific… Commitments may come after 14 days."                                                                   |
| Calculator           | All weekly hours can be sold                   | New field **Unpaid hours a week** (default 2; finding customers, messages, admin). Only the hours left can be sold; profit per hour is still spread over all her hours. A new message if unpaid hours take the whole week.                                                                   |
| Ranking              | Ties go to her priority                        | Then to products/services and recurring/one-off, as she said she'd prefer (Vee's earlier decision)                                                                                                                                                                                           |
| "How we scored this" | "Ties go to what you said matters most."       | Adds the preference tie-breaker                                                                                                                                                                                                                                                              |

The version line still says v1.4 (Vee: "v1.4 everywhere"). If the corrected report ships as a new revision, change the version in every kit file together.

### 4b. Everything else matches the corrected report

The corrected report's rules: **not enough evidence** (fewer than 5 real conversations) first; then **go** (5+ conversations; for a service 2+ asked about price or booking and 1+ firm, dated yes or deposit; for a product 1+ order or pre-order and 1+ asked about price; in a slow-buying market 2+ asked about price or timing and specific feedback, commitments possibly after 14 days; and the calculator shows her minimum hourly rate or more at 50% busy); **adjust** (change one thing and repeat Days 9–12; two adjust rounds with no commitment means stop); **stop** (5+ conversations and nobody asked about price, or she doesn't want another 14 days). Calculator: paid hours = weekly hours − unpaid hours (2 unless she changes it); capacity = paid hours × 52 ÷ 12 ÷ hours per unit; scenarios at 25%, 50% and 100% of capacity (whole units, rounded down); profit = units × (price − cost per unit) − monthly fixed costs; per hour = profit ÷ all her monthly hours; break-even = start-up ÷ margin, rounded up.

| File                                                  | Differs how                                                                                                                                                                                                                        | Change                                                                                                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Go / No-Go Scorecard (PDF and workbook "3 Scorecard") | Already has the not-enough-evidence gate and the slow-buying path. NEXT TEST needs a total of 24+, with no hourly-rate condition; gate-failed ADJUST re-runs Days 7–12                                                             | Keep the gates. Replace "total 24 or more" with "the calculator shows your minimum hourly rate or more at 50% busy". Both ADJUST texts: "change one thing and repeat Days 9–12". |
| 14-Day Test Plan, Day 14                              | Restates the scorecard                                                                                                                                                                                                             | The four outcomes above                                                                                                                                                          |
| AI Shortcut System, Workflows 10 and 11               | Workflow 11 asks for a "GO / ADJUST / STOP band"; Workflow 10's example says "fewer than ten conversations"                                                                                                                        | The four outcomes; five conversations                                                                                                                                            |
| Workbook calculators (2A, 2B, 2C)                     | 20% / 50% / 80% of paid hours; per hour over hours worked; break-even on fixed costs; the product sheet's unpaid default is 2.5 and it models demand per week; scenarios called "Base" while the Plan and Scorecard say "moderate" | The report's model above (25 / 50 / 100% of paid hours, per hour over all hours, break-even on start-up), unpaid default 2 on every sheet, one scenario name                     |
| Start Here                                            | "uses the same scoring and gives the same top three"                                                                                                                                                                               | True once the workbook matches                                                                                                                                                   |

## 5. Footer and brand

| File                                | Says now                                              | Change to                                                              |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Brand book (visual identity) footer | the former trading name and a different contact email | **Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com** |
| Brand book                          | grey #6E6264                                          | #564B4E                                                                |
| Brand book                          | Bodoni Moda 700 for headings                          | Bodoni Moda 800                                                        |
| Brand book (imagery)                | stock photos allowed                                  | no stock photos of people (faceless brand)                             |

The website and current product PDFs already follow these (print style v2).

## 6. The promise and the tagline

Vee's decision: the website's promise is the promise everywhere; "Big plans. Real life." stays as the tagline, never the promise.

- **Promise:** "Make your own money. Know what you're getting into."
- **Supporting line:** "Find the side income that fits your real week, see what it really costs and takes, check the rules where you live, then test it for 14 days before you spend big."
- **Tagline:** "Big plans. Real life."

| File                                  | Says now                                                        | Change to                                              |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Start Here, under "start here."       | "Find the income idea that fits your life. Test it in 14 days." | The promise, then the supporting line                  |
| The Income Fit Report, cover          | The promise (already)                                           | No change                                              |
| Product PDFs (cover and running foot) | "Big plans. Real life." as the tagline                          | No change: that's the tagline's job                    |
| Brand book                            | Tagline under the mark; no promise                              | Add the promise and supporting line beside the tagline |

The "one-sentence promise" templates inside Little Offer Kit, Sell It Simply, the AI Business Assistant Pack, the 90-Day Grow Plan and Fit Check help a _buyer_ write the promise for her own business. They aren't Her Little Empire's promise and aren't changed by this.

## 7. Pricing: Price It Right is the source of truth

| File                                                                   | Says now                                                                                            | Change to                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 90-Day Grow Plan, "How to test a higher price"                         | "Raise in one clear step, not lots of small ones. Example only, in any currency: from $40 to $50."  | "A common rule of thumb is to raise by 15–25% for the next buyer (EST, not a rule). See Price It Right, 'The price check'."                        |
| 90-Day Grow Plan, same box                                             | "Keep existing customers on their current price for a set time, and tell them the date it changes." | "Give existing customers at least 30 days' notice of the date it changes (Price It Right, 'Price rise for a regular client')."                     |
| 90-Day Grow Plan, "Message to existing customers about a price change" | "from [date], my price for [offer] will be [new price]."                                            | "from [date, at least 30 days away], my price for [offer] will be [new price]." Or replace the template with a pointer to Price It Right's script. |
| 90-Day Grow Plan, "Signs your price may be too low"                    | Its own list                                                                                        | Keep the list (Price It Right has no equivalent), and add: "Then use Price It Right to set the new price."                                         |
| Brand-in-a-Box preview                                                 | "The Tidy-Up for $380 (usually $480) until 30 November."                                            | Use Price It Right's worked example: founding $380, then $420 ("$380 (usually $420)").                                                             |

**Inside Price It Right itself (for Vee to check):** its worked example (floor $280, five offers $250–$600, middle about $400) prices at $380 founding then $420. That doesn't follow its own rule "If the floor sits between low and middle, start at the middle" (about $400), and the guide has no rule for founding discounts or for when the floor is above the middle or below the low. Since it's now the source of truth, either change the example to $400 or add a sentence saying a founding price can sit just under the middle.

## 8. Record keeping (and 30-Day Plan Day 13)

The Rules Guides win: they were checked most recently (17 October 2026 for Australia, 19 October 2026 for the others). Side Income Money System's table already matches them.

| File                                       | Says now                                                         | Change to                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14-Day Tracker, "Every dollar · Money log" | "most countries expect you to keep them for five to seven years" | "How long to keep them depends on where you live: Australia, most records for five years; US, three years by default (longer in some cases); UK, at least five years after the 31 January filing deadline; Canada, six years from the end of the tax year they relate to; New Zealand, at least seven tax years (FACT, checked 17–19 October 2026). Your Rules Guide has the details." |

**30-Day Faceless Content Plan, Day 13:** the plan table says "Share the results the next day", while the Day 13 caption says "On day 16, share the results" and the story prompts schedule it for Day 16. The Rules Guides don't cover this one (it's about Instagram polls, not rules), so it needs its own call. Suggested, because two of the three places already say it: change the plan table to "Share the results on day 16."

## 9. Instagram handle

**@herlittleempire.co** is confirmed correct. The products that use it (100 Faceless Hooks, Comment-to-DM Kit) need no change. Empire Studio still strips these self-promotional lines from what it shows store owners, because they're about Her Little Empire, not the owner's shop.
