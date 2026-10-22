# Corrections for the Her Little Empire documents

From Vee's answers to the audit (22 October 2026). Empire Studio already follows every decision below. This list is for the **documents** (the PDFs, the workbook and the generators in `source/`), so they say the same thing as the app.

Nothing here has been applied to a live file or a Gumroad listing. Each fix is for Vee (or her build scripts) to make on the next revision. Locations come from the audit records in [`audit/`](audit/) and the register ([`register.csv`](register.csv)).

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

## 4. Day 14 rules and the calculator: the Income Fit Report is the source of truth

The report's rules (`gates` and `calcCore` in `src/lib/fit/engine.ts`, ported word for word):

- **Go: next test.** 5+ real conversations with people who fit the customer type; for a service, 2+ people asked about price or booking unprompted and 1+ firm, dated yes or deposit (for a product, 1+ order or pre-order and 1+ person asked about price); and the calculator, with real numbers, shows her minimum hourly rate or more at 50% busy.
- **Adjust.** Demand is there but a number is off, or there's interest without commitments. Change one thing and **repeat Days 9–12**. Two adjust rounds with no commitment means stop.
- **Stop.** 5+ real conversations and nobody asked about price, or she doesn't want another 14 days.
- **Fewer than 5 conversations** isn't a no: not enough evidence yet; find a different place and repeat Days 9–12.
- **Calculator.** Capacity = monthly hours (weekly × 52 ÷ 12) ÷ hours per unit. Scenarios at 25%, 50% and 100% of capacity (whole units, rounded down). Profit = units × (price − cost per unit) − monthly fixed costs; hourly return = profit ÷ monthly hours. Break-even = start-up ÷ margin, rounded up (units to win back the start-up). Signal from the 50% and 100% scenarios against her floor.

To match it:

| File                                                  | Differs how                                                                                                                            | Change                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Go / No-Go Scorecard (PDF and workbook "3 Scorecard") | Verdict from a 12-question total (24+ = next test) and a demand gate; no hourly-rate condition; ADJUST re-runs Days 7–12               | Use the report's go/adjust/stop lines above, including the minimum-hourly-rate condition, and "repeat Days 9–12" |
| 14-Day Test Plan, Day 14                              | Restates the scorecard's verdicts                                                                                                      | The report's lines                                                                                               |
| AI Shortcut System, Workflows 10 and 11               | Workflow 11 asks for a "GO / ADJUST / STOP band" the scorecard doesn't have; Workflow 10's example says "fewer than ten conversations" | The report's three outcomes; five conversations                                                                  |
| Workbook calculators (2A, 2B, 2C)                     | 20% / 50% / 80% of (hours − 2 unpaid hours); break-even on fixed costs; scenarios called "Base"; Plan and Scorecard say "moderate"     | The report's model above (25 / 50 / 100%, no unpaid-hours term, break-even on start-up), one scenario name       |
| Start Here                                            | "uses the same scoring and gives the same top three"                                                                                   | True once the workbook matches; until then, say the report is the reference                                      |

**Check before applying:** the report has no "slow-buying market" path and no separate INSUFFICIENT EVIDENCE verdict (it's the "fewer than 5" note), and it doesn't count the 2 unpaid hours a week the workbook allows for. Matching the report removes all three from the scorecard and workbook. If Vee wants any of them kept, the report (and the app) should gain them instead.

## 5. Footer and brand

| File                                | Says now                                              | Change to                                                              |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Brand book (visual identity) footer | the former trading name and a different contact email | **Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com** |
| Brand book                          | grey #6E6264                                          | #564B4E                                                                |
| Brand book                          | Bodoni Moda 700 for headings                          | Bodoni Moda 800                                                        |
| Brand book (imagery)                | stock photos allowed                                  | no stock photos of people (faceless brand)                             |

The website and current product PDFs already follow these (print style v2).
