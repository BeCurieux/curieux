# Content inventory, source-to-feature register and consolidation report

**Audited 22 October 2026** from the documents Vee supplied (`README_FOR_CLAUDE_CODE.md`, `01_income-fit-test/`, `02_products/`, `03_brand/` — 68 files). Every product file was read; every finding cites its file and section.

- **Machine-readable register:** [`register.json`](register.json) and [`register.csv`](register.csv), 37 assets, every field the addendum asks for. Built by `node scripts/build-register.mjs` from the audit records in [`audit/`](audit/).
- **Method extractions (quoted, cited):** [`audit/fit-kit-methods.md`](audit/fit-kit-methods.md), [`audit/products-offer-methods.md`](audit/products-offer-methods.md), [`audit/products-content-methods.md`](audit/products-content-methods.md).
- The source files themselves are **not** committed; drop them in `source/` locally if you want them beside the register.

## 1. What was converted in this release

| Source                                                                                                          | Became                                                                                                                        | Where                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **The Income Fit Test** (quiz, scoring, 23 opportunities, country rules, calculator, 14-day plan, Day 14 gates) | **The FIT Finder** — the 20 questions, the report, the calculator and the dated plan, saved per account                       | `src/lib/fit/`, `/studio/fit`                            |
| `opportunities.json` (23 options, v1.1)                                                                         | The opportunity database, unchanged                                                                                           | `content/fit/opportunities.json`                         |
| Sell It Simply, Little Offer Kit, Get Found, First 5 Customers, AI Business Assistant Pack                      | The methods for homepage copy, product listings, photo briefs and launch emails; parts of the Brand Blueprint and store brief | `src/content/methodology.ts`                             |
| Faceless Content System, 30-Day Plan, 100 Faceless Hooks, Faceless Not Anonymous                                | The social launch kit method; the 100 hooks as data                                                                           | `src/content/methodology.ts`, `content/hooks/hooks.json` |
| Brand book and print style                                                                                      | Empire Studio's own colours, fonts and labels                                                                                 | `src/app/globals.css`, `public/fonts/`                   |
| `catalog.py`                                                                                                    | The product catalogue, prices and bundles (bundles unlock their contents)                                                     | `src/content/catalogue.ts`                               |

**The FIT Finder is a 1:1 port.** The shipped JavaScript engine is kept verbatim as a test fixture and run beside the TypeScript port on 5,000 random answer sets: identical scores, bands, top threes and "why it's out" reasons. It scores the opportunity data embedded in the shipped report, which proves `opportunities.json` matches it exactly (it does: 0 differences).

**It respects the live product.** The full report unlocks only for people who own The Income Fit Test (directly, or in The Empire Bundle or The Whole Empire). Everyone else sees their first pick and an honest offer to buy the kit at its live price. **Decision for Vee:** keep this, or give the full FIT Finder free as a lead magnet.

## 2. Inventory (summary)

| Group                            | Assets                                                                                                                                                                                                                          | Status                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Income Fit Test kit              | product, report engine, opportunity database, country rules, Start Here, workbook, opportunity cards, AI shortcut system, 14-day test plan, go/no-go scorecard, rules guides, video course                                      | engine, data, rules, plan and gates **built**; workbook and scorecard ready to port; video course not supplied |
| Offer, money and add-ons         | Little Offer Kit, Sell It Simply, Side Income Money System, Client Paperwork Kit, 90-Day Grow Plan, AI Business Assistant Pack, Fit Check freebie, Price It Right, First 5 Customers, Get Found, Brand-in-a-Box, 14-Day Tracker | methods **built** into generators; Price It Right and Side Income Money System formulas ready for a calculator |
| Content and starter kits         | Faceless Content System, Faceless Not Anonymous, 100 Faceless Hooks, 30-Day Plan, Comment-to-DM Kit, Etsy, Pinterest, Tutor and VA starter kits                                                                                 | social method **built**; hooks imported; starter kits are service pathways (Etsy is a future module)           |
| Brand                            | visual identity, print style, fonts                                                                                                                                                                                             | **adopted**                                                                                                    |
| Named in the addendum, not found | Business Starter System, Money & Operations Kit, course manuscripts and assignments                                                                                                                                             | **do not exist in the files** (see §4)                                                                         |

Versions: the product PDFs say "Version 1.1 · October 2026"; Start Here says Income Fit Test **v1.4** while other kit files say **1.3**. Prices come from `catalog.py`.

## 3. Findings that need Vee

### Inconsistencies in the source

1. **The quiz length is stated four ways:** 20 (README, report), 19, "17 questions (plus 2 optional)" (Fit Check freebie, brand book sample) and 15. The real count is 20 (18 scored + minimum rate + name).
2. **Two quiz answers are never used in scoring:** products or services, and recurring or one-off. "Sells without pitching" affects only the risks text. Use them, or stop asking?
3. **Kit version:** v1.4 (Start Here) vs 1.3 elsewhere.
4. **Old generators in `source/`:** `cards.py` builds 25 cards, not the 23 shipped; `quickstart.py` builds an outdated Australia-only guide with old ASIC fees and a Centrelink line that contradicts the current Rules Guide. The generators for the current Cards, Start Here and Rules Guides aren't in the folder.
5. **Day 14 rules differ:** the report adds a minimum-hourly-rate gate and re-runs Days 9–12 after "adjust"; the scorecard has no rate gate; AI Shortcut Workflow 11 asks for a "GO / band" the scorecard doesn't have. The app uses the **report's** version (it's what buyers get interactively).
6. **Calculator models differ** between the report and the workbook. The app uses the report's.
7. **Record keeping:** the 14-Day Tracker says "five to seven years"; Side Income Money System's dated table says the US default is 3 years.
8. **30-Day Plan Day 13:** results shared "the next day" in one place, "day 16" in two others.
9. **Pricing rules disagree:** Price It Right raises by 15–25% (EST) with 30 days' notice; the 90-Day Grow Plan says "one clear step" with no notice period. Price It Right's worked example ($380 founding, then $420) doesn't follow its own "start at the middle" rule, and Brand-in-a-Box shows the same package as "usually $480".
10. **Five different "one-sentence promise" formulas** across Little Offer Kit, Sell It Simply, AI Business Assistant Pack, the 90-Day plan and Fit Check. The app uses Sell It Simply's for brand positioning and Little Offer Kit's for product listings until Vee picks one.
11. **Brand files disagree:** grey #6E6264 vs #564B4E; Bodoni weight 700 vs 800; stock photos allowed (brand book v1) vs banned (print style v2). The app follows print style v2 and the README.

### Compliance flags (against the README rules)

- **The former trading entity's name appears in the brand book footer**, with a different contact email. Don't reuse that footer anywhere. (The app uses Her Little Empire's seller details; the name is redacted from the committed audit records.)
- **"lawyer" near products:** Client Paperwork Kit (11 times, including a cover item), First 5 Customers (option 16), opportunity card 16 and the workbook's Options sheet (cell AC17). These are referrals ("send these questions to a lawyer"), not credentials, but they conflict with the literal rule.
- **Refund wording that isn't the required sentence:** Start Here adds ", on top of your consumer rights"; Fit Check says "14-day refund". (Buyer-facing refund _templates_ in Little Offer Kit, Sell It Simply and Faceless Not Anonymous are for the customer's own business; the app never generates Her Little Empire's refund text.)
- **Unlabelled figures:** Get Found's platform pages, several card text fields (cards 2, 10, 11), Faceless Content System time figures and 30-Day Plan platform figures (20 slides, 24 hours, 9:16) have no FACT/EST/UNKNOWN label or check date. The Rules Guides mark EST and UNKNOWN but leave FACT implicit.
- **Family details in buyer-facing examples** (Faceless Not Anonymous "mum of one on the coast of NSW", Comment-to-DM "toddler on my hip"). Fine as templates; the app's generators never default to family references.
- **Self-promotion inside products** (Fit Check CTAs and "@herlittleempire.co" in 100 Faceless Hooks and Comment-to-DM; VA kit cross-sell). Stripped from what the app shows store owners. Is "@herlittleempire.co" the right handle?
- **Personalised legal output risk:** Client Paperwork Kit and AI pack prompt 6.6 must stay static templates, never AI-filled agreements.

No income claims, fake urgency, fake testimonials, MLM or PLR/MRR were found in any product. Several products explicitly reject them.

## 4. Duplication and consolidation

Source files are never edited or deleted. Each shared method has one authoritative version in the software, with distinctive material from the others kept.

| Overlap                                             | Authoritative version                                                                                                                   | Keep from the others                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Income Fit Test ↔ Income Fit Report                 | **The report** (interactive) for quiz, scoring, gates and the dated plan                                                                | Workbook formulas and its 20 audit checks (test cases); the scorecard's full criteria as a downloadable; the PDF plan's notes boxes and AI workflows |
| "Business Starter System" ↔ Little Offer Kit        | **Doesn't exist.** For product copy: **Sell It Simply's six-part page** (the superset)                                                  | Little Offer Kit's "What it's not", "Why we made it", product description template, FAQ, receipt and weekend plan                                    |
| "Business Starter System" ↔ Price It Right          | **Price It Right** floor/market/value for the pricing tool                                                                              | Little Offer Kit's digital-product tiers, "simpler/similar/more complete" and fee maths; the 90-Day plan's six signs a price is too low              |
| "Business Starter System" ↔ First 5 Customers       | **First 5 Customers** for one-to-one outreach; **Sell It Simply** for the launch email sequence                                         | Little Offer Kit's launch email; the Tracker's thresholds; Get Found's "ask every customer, not just the happy ones"                                 |
| Faceless Content System ↔ 100 Faceless Hooks        | **100 Faceless Hooks** (7 goals, numbered) as the hook library                                                                          | FCS's four hook formulas and caption template; its "Honest caption check"                                                                            |
| Faceless Content System ↔ 30-Day Plan               | **30-Day Plan** for launch calendars; **FCS** for the ongoing weekly cadence                                                            | 30-Day per-format how-tos and accessibility checklist; FCS's six formats and effort column                                                           |
| "Money & Operations Kit" ↔ Side Income Money System | **Doesn't exist.** **Side Income Money System** for records, set-aside and thresholds; the **90-Day plan's** real-hourly-return formula | SIMS log schemas, receipt naming, threshold watch; Client Paperwork Kit's 5-step invoice reminders (downloadable only)                               |

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
