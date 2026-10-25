# Content inventory, source-to-feature register and consolidation report

**Audited 22 October 2026** from the documents Vee supplied (`README_FOR_CLAUDE_CODE.md`, `01_income-fit-test/`, `02_products/`, `03_brand/` — 68 files). Every product file was read; every finding cites its file and section.

- **Machine-readable register:** [`register.json`](register.json) and [`register.csv`](register.csv), 35 assets, every field the addendum asks for. Built by `node scripts/build-register.mjs` from the audit records in [`audit/`](audit/).
- **Method extractions (quoted, cited):** [`audit/fit-kit-methods.md`](audit/fit-kit-methods.md), [`audit/products-offer-methods.md`](audit/products-offer-methods.md), [`audit/products-content-methods.md`](audit/products-content-methods.md).
- **Fixes the founder's documents need** (from her answers): [`CORRECTIONS.md`](CORRECTIONS.md).
- The source files themselves are **not** committed; drop them in `source/` locally if you want them beside the register.

## 1. What was converted in this release

| Source                                                                                                          | Became                                                                                                                              | Where                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **The Income Fit Test** (quiz, scoring, 23 opportunities, country rules, calculator, 14-day plan, Day 14 gates) | **The FIT Finder** — the 20 questions, the report, the calculator and the dated plan, saved per account                             | `src/lib/fit/`, `/studio/fit`                            |
| `opportunities.json` (23 options, v1.1)                                                                         | The opportunity database, unchanged                                                                                                 | `content/fit/opportunities.json`                         |
| Sell It Simply, Little Offer Kit, Get Found, First 5 Customers, AI Business Assistant Pack                      | The methods for homepage copy, product listings, photo briefs and launch emails; named steps in the Brand Blueprint and store brief | `src/content/methodology.ts`                             |
| Faceless Content System, 30-Day Plan, 100 Faceless Hooks, Faceless Not Anonymous                                | The social launch kit method; the 100 hooks as data                                                                                 | `src/content/methodology.ts`, `content/hooks/hooks.json` |
| Brand book and print style                                                                                      | Empire Studio's own colours, fonts and labels                                                                                       | `src/app/globals.css`, `public/fonts/`                   |
| `catalog.py`                                                                                                    | The product catalogue, prices and bundles (bundles unlock their contents)                                                           | `src/content/catalogue.ts`                               |

**The FIT Finder is a 1:1 port.** The shipped JavaScript engine is kept verbatim as a test fixture and run beside the TypeScript port on 5,000 random answer sets: identical scores, bands and "why it's out" reasons, and identical top threes whenever she has no product/service or recurring/one-off preference. Vee's changes on top: those two answers break ties between ideas of equal fit, and Day 14 and the calculator gain the Scorecard's "not enough evidence" verdict, the slow-buying path and 2 unpaid hours a week. The corrected report carries the same rules and is tested against the app. It scores the opportunity data embedded in the shipped report, which proves `opportunities.json` matches it exactly (it does: 0 differences).

**Free and paid.** Everyone sees their top three ideas with one line on why each fits. The full report (calculator, rules for their country, dated 14-day plan and go/adjust/stop) unlocks for people who own The Income Fit Test, directly or in The Empire Bundle or The Whole Empire. The buy link is `https://herlittleempireco.gumroad.com/l/income-fit-test` until the Gumroad scripts confirm it.

**Every figure is labelled.** Market figures in the opportunity text that weren't labelled in the field get the label their Opportunity Card gives them (11 figures, `src/lib/fit/data.ts`), and each idea shows the date its card was last checked (16 or 17 October 2026).

## 2. Inventory (summary)

| Group                            | Assets                                                                                                                                                                                                                          | Status                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Income Fit Test kit              | product, report engine, opportunity database, country rules, Start Here, workbook, opportunity cards, AI shortcut system, 14-day test plan, go/no-go scorecard, rules guides, video course                                      | engine, data, rules, plan and gates **built**; workbook and scorecard ready to port; video course not supplied |
| Offer, money and add-ons         | Little Offer Kit, Sell It Simply, Side Income Money System, Client Paperwork Kit, 90-Day Grow Plan, AI Business Assistant Pack, Fit Check freebie, Price It Right, First 5 Customers, Get Found, Brand-in-a-Box, 14-Day Tracker | methods **built** into generators; Price It Right and Side Income Money System formulas ready for a calculator |
| Content and starter kits         | Faceless Content System, Faceless Not Anonymous, 100 Faceless Hooks, 30-Day Plan, Comment-to-DM Kit, Etsy, Pinterest, Tutor and VA starter kits                                                                                 | social method **built**; hooks imported; starter kits are service pathways (Etsy is a future module)           |
| Brand                            | visual identity, print style, fonts                                                                                                                                                                                             | **adopted**                                                                                                    |
| Named in the addendum, not found | course manuscripts and assignments                                                                                                                                                                                              | not supplied                                                                                                   |

Versions: the product PDFs say "Version 1.1 · October 2026". The Income Fit Test is **v1.4** with **20 questions** (Vee); kit files that say 1.3 or another count are listed in `CORRECTIONS.md`. Prices come from `catalog.py`. Status (Vee, 22 Oct 2026): Fit Check is **free** (Gumroad permalink `fit-check`); Sell It Simply, Faceless Content System and Faceless & Not Anonymous are **unreleased**.

## 3. Vee's decisions (22 October 2026)

| #   | Finding                                                   | Decision                                                                                                               | Done in the app                                                                          | Documents      |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- |
| 1   | Free vs gated FIT Finder                                  | Free: top three with one line on why each fits. Full report stays with Income Fit Test owners and bundle buyers.       | Yes                                                                                      | —              |
| 2   | Products/services and recurring/one-off unused in scoring | Use both as tie-breakers.                                                                                              | Yes (`byFit` in `src/lib/fit/engine.ts`)                                                 | —              |
| 3   | Quiz count and version stated several ways                | 20 questions, v1.4, everywhere.                                                                                        | Already                                                                                  | CORRECTIONS §1 |
| 4   | "lawyer" in referrals                                     | Keep. The rule only bans describing Vee as a lawyer, barrister or counsel near products.                               | Flags removed from the register                                                          | —              |
| 5   | Refund wording                                            | Exactly "Full refund within 14 days of purchase, no questions asked."; consumer rights in their own sentence after it. | Yes (Terms adds the consumer-rights sentence)                                            | CORRECTIONS §2 |
| 6   | Unlabelled figures                                        | Label every figure FACT, EST or UNKNOWN, with the date checked.                                                        | FIT report: yes                                                                          | CORRECTIONS §3 |
| 7   | Day 14 rules and calculator differ                        | The Income Fit Report is the source of truth; everything else matches it.                                              | Already (the app uses the report)                                                        | CORRECTIONS §4 |
| 8   | Footer naming the former trading entity                   | "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com"                                                   | Yes, on every page                                                                       | CORRECTIONS §5 |
| 9   | Brand files disagree                                      | Bodoni Moda 800 headings, grey #564B4E, no stock photos of people.                                                     | Yes; photo rules in the Brand Blueprint and image briefs say "no stock photos of people" | CORRECTIONS §5 |
| 10  | Two products named in the brief that don't exist yet      | Remove references until they exist.                                                                                    | Removed from the app, register and docs                                                  | —              |
| 11  | Brand-in-a-Box has no brand method                        | Label the Brand Blueprint as Empire Studio's own method.                                                               | Yes ("Empire Studio method" badge; no Brand-in-a-Box attribution)                        | —              |
| 12  | Fit Check, Sell It Simply and the faceless workbooks      | Fit Check is free (`fit-check`); the other three are unreleased.                                                       | Yes (catalogue status)                                                                   | —              |

### Round 2 (22 October 2026)

| Finding                        | Decision                                                                                                                         | Done in the app                                                                     | Documents                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| Day 14: what the report lacked | Keep all three: separate "not enough evidence" verdict, slow-buying path, 2 unpaid hours a week. "They're the honest version."   | Yes (four Day 14 boxes; unpaid-hours field in the calculator)                       | CORRECTIONS §4 (report patches ready) |
| Consumer-rights sentence       | Approved: "This is on top of your rights under consumer law."                                                                    | Already                                                                             | CORRECTIONS §2                        |
| Promise                        | "Make your own money. Know what you're getting into." + the website's supporting line; "Big plans. Real life." stays the tagline | Fit Finder page and site footer (`src/content/brand.ts`)                            | CORRECTIONS §6                        |
| Pricing rules                  | Price It Right is the source of truth; the 90-Day Grow Plan matches it and points to it                                          | No pricing rules in the app yet; the planned pricing calculator uses Price It Right | CORRECTIONS §7                        |
| Record keeping                 | The Rules Guides win                                                                                                             | The FIT report's rules already come from them                                       | CORRECTIONS §8                        |
| Instagram handle               | @herlittleempire.co is correct                                                                                                   | —                                                                                   | CORRECTIONS §9                        |

### Still open

1. **Old generators in `source/`:** `cards.py` builds 25 cards, not the 23 shipped; `quickstart.py` builds an outdated Australia-only guide with old ASIC fees and a Centrelink line that contradicts the current Rules Guide. The generators for the current Cards, Start Here and Rules Guides, and the script that injects the scoring engine into the report, aren't in the folder.
2. **30-Day Plan Day 13:** the Rules Guides don't cover it (it's about poll results). Suggested: "Share the results on day 16", as two of three places say (CORRECTIONS §8).
3. **Price It Right's own worked example** ($380 founding, then $420) doesn't follow its "start at the middle" rule (about $400). Now that it's the source of truth, change the example or add a founding-price rule (CORRECTIONS §7).
4. **Customer promise templates:** the five "one-sentence promise" formulas inside the products are for buyers writing their own promise. The app uses Sell It Simply's for brand positioning and Little Offer Kit's for product listings unless Vee wants one formula.
5. **Gumroad product ids** for `src/content/catalogue.ts`, and confirmation of the buy link (coming from Vee's Gumroad scripts).

### Compliance notes (against the README rules)

- **Family details in buyer-facing examples** (Faceless Not Anonymous "mum of one on the coast of NSW", Comment-to-DM "toddler on my hip"). Fine as templates; the app's generators never default to family references.
- **Self-promotion inside products** (Fit Check CTAs and @herlittleempire.co, the confirmed handle, in 100 Faceless Hooks and Comment-to-DM; VA kit cross-sell). Stripped from what the app shows store owners, because it's about Her Little Empire, not their shop.
- **Personalised legal output risk:** Client Paperwork Kit and AI pack prompt 6.6 must stay static templates, never AI-filled agreements.

No income claims, fake urgency, fake testimonials, MLM or PLR/MRR were found in any product. Several products explicitly reject them.

## 4. Duplication and consolidation

Source files are never edited or deleted. Each shared method has one authoritative version in the software, with distinctive material from the others kept.

| Overlap                                             | Authoritative version                                                                                                | Keep from the others                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Income Fit Test ↔ Income Fit Report                 | **The report** (interactive) for quiz, scoring, gates and the dated plan                                             | Workbook formulas and its 20 audit checks (test cases); the scorecard's full criteria as a downloadable; the PDF plan's notes boxes and AI workflows |
| Little Offer Kit ↔ Sell It Simply (product copy)    | **Sell It Simply's six-part page** (the superset)                                                                    | Little Offer Kit's "What it's not", "Why we made it", product description template, FAQ, receipt and weekend plan                                    |
| Price It Right ↔ Little Offer Kit (pricing)         | **Price It Right** floor/market/value for the pricing tool                                                           | Little Offer Kit's digital-product tiers, "simpler/similar/more complete" and fee maths; the 90-Day plan's six signs a price is too low              |
| First 5 Customers ↔ Sell It Simply (first sales)    | **First 5 Customers** for one-to-one outreach; **Sell It Simply** for the launch email sequence                      | Little Offer Kit's launch email; the Tracker's thresholds; Get Found's "ask every customer, not just the happy ones"                                 |
| Faceless Content System ↔ 100 Faceless Hooks        | **100 Faceless Hooks** (7 goals, numbered) as the hook library                                                       | FCS's four hook formulas and caption template; its "Honest caption check"                                                                            |
| Faceless Content System ↔ 30-Day Plan               | **30-Day Plan** for launch calendars; **FCS** for the ongoing weekly cadence                                         | 30-Day per-format how-tos and accessibility checklist; FCS's six formats and effort column                                                           |
| Side Income Money System ↔ 90-Day Grow Plan (money) | **Side Income Money System** for records, set-aside and thresholds; the **90-Day plan's** real-hourly-return formula | SIMS log schemas, receipt naming, threshold watch; Client Paperwork Kit's 5-step invoice reminders (downloadable only)                               |

## 5. Research and legal-review flags

- **Earnings language** — FIT content, cards, money tools: no claims found, but card text quotes third-party figures (e.g. card 14 "A$5K-50K a month" framed as unverified). Review against the no-income-claims rule.
- **Tax, registration and consumer law** — Rules Guides, Side Income Money System thresholds (checked 17/19 Oct 2026): re-verify at each country's tax-year change; the app shows each line with its check date and label.
- **Platform rules and fees** — Gumroad 10% + US$0.50 (FACT, Oct 2026), Etsy fees, Meta/ManyChat automation rules: re-verify before each revision; Comment-to-DM depends on third-party rules that change often.
- **Email consent** — unsubscribe windows and postal-address rules are in Sell It Simply; keep them dated.
- **Legal templates** — Client Paperwork Kit: static, disclaimed, never personalised.

## 6. Retained as downloadable resources (not the product)

The finished PDFs remain the offline, print-friendly versions buyers already own: opportunity cards, rules guides, 14-day plan pages with notes boxes, scorecard, workbooks, starter kits. The app links people to their Gumroad library; it doesn't rebuild a PDF library.

## 7. Next conversions

See [`../docs/BACKLOG.md`](../docs/BACKLOG.md): the pricing calculator (Price It Right, tests from its worked example), the money tracker (Side Income Money System A–E formula), the hook library page, the Day 14 scorecard with the workbook's full criteria, and a Shopify method for the Brand Blueprint gaps and Sidekick prompts once Vee writes one.
