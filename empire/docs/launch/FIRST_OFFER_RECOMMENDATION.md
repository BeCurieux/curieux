# First offer recommendation

**Recommendation: The Income Fit Test (US$19, already on Gumroad) is the first offer to drive to one verified end-to-end sale.** No new product is created.

Evidence comes from the founder's `catalog.py` (as `src/content/catalogue.ts` and `docs/CATALOGUE.md`) and the content register built from all 68 product files (`content/REGISTER.md`, `content/register.json`, 22 Oct 2026). Live listings couldn't be checked from this session: the store is unreachable from here.

## 1. How the catalogue compares

| Candidate                 | Price | Complete?                                                                                                                                                                                                                                                | Joined to software?                                                                              | Problems                                                                                                                            | Verdict          |
| ------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **The Income Fit Test**   | US$19 | **Yes.** v1.4: offline report (20-question quiz, top three of 23 researched ideas, calculator, rules for five countries, dated 14-day plan, go/adjust/stop) + workbook, opportunity cards, AI shortcut system, 14-day test plan, scorecard, rules guides | **Yes.** Owning it unlocks the full FIT Finder report (`accessFrom`, `src/lib/billing/plans.ts`) | Version and question count stated differently across files (1.4 vs 1.3; 20 vs 19/17/15); fixes ready in `content/CORRECTIONS.md` §1 | **Recommended**  |
| The Empire Bundle         | US$39 | **No.** It includes the Video Course (US$6), which the register lists as "Entire course" missing                                                                                                                                                         | Yes (contains the Income Fit Test)                                                               | Can't sell honestly until the video course exists or is removed from the bundle                                                     | Later            |
| The Whole Empire          | US$99 | Includes the same video course and two products not yet on Gumroad                                                                                                                                                                                       | Yes                                                                                              | Same                                                                                                                                | Later            |
| Your Little Offer Kit     | US$19 | Yes                                                                                                                                                                                                                                                      | No                                                                                               | Narrower (one weekend product); overlaps the planned Starter Kit                                                                    | Second offer     |
| Price It Right            | US$5  | Yes                                                                                                                                                                                                                                                      | Planned calculator only                                                                          | Low price: Gumroad's fixed fee takes a big share                                                                                    | Add-on           |
| Empire Studio Launch Pack | US$49 | Software built                                                                                                                                                                                                                                           | Is the software                                                                                  | No Gumroad product yet, real AI output not reviewed, a different audience (Shopify)                                                 | After first sale |
| Ads That Actually Sell    | AUD   | 1 of 10 modules                                                                                                                                                                                                                                          | Partly                                                                                           | Not complete; building it is P2                                                                                                     | Not yet          |

## 2. Why the Income Fit Test

1. **It's complete and it's the flagship.** It's the most thoroughly audited product, and its engine is ported 1:1 and tested on 5,000 answer sets.
2. **It's the only paid product that unlocks software already built.** A buyer gets the PDFs from Gumroad **and** the full FIT Finder report in Empire Studio. That makes it the one offer where "verified access" can be tested end to end today.
3. **It sits right after both free tools.** The Fit Check's own last page upsells it (register: "Ends with a 14-day test outline and an upsell to the Income Fit Test"), and the calculator page links to it.
4. **It matches the positioning.** "Make your own money. Know what you're getting into." is literally what it does, including telling some buyers "not enough evidence yet".
5. **The price is low-risk** for a first purchase, and the refund rule is simple: "Full refund within 14 days of purchase, no questions asked."

The economics, using the course calculator, are a hypothetical with Gumroad's 10% + US$0.50 per direct sale (FACT, Oct 2026). Card processing isn't included (UNKNOWN), nor are refunds or Discover sales (30%):

- **US$16.60 kept per sale** (19 − 1.90 − 0.50; the same figure as the Little Offer Kit's fee table).
- A break-even ROAS of 1.14 if it's ever advertised.

## 3. Before driving traffic to it

| Item                                                                                                                       | Who         | Evidence                      |
| -------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------- |
| Apply CORRECTIONS §1 (20 questions, v1.4 everywhere) and §2 (refund wording) to the kit's files and listing                | Vee         | `content/CORRECTIONS.md`      |
| Apply the two report patches (Day 14 verdicts, unpaid hours) so the PDF report matches the app                             | Vee         | `content/corrections/*.patch` |
| Confirm the listing URL is still `herlittleempireco.gumroad.com/l/income-fit-test`                                         | Vee         | `src/content/catalogue.ts`    |
| Copy the Income Fit Test's Gumroad product id (and the bundles' ids) into `gumroadProductIds`                              | Vee → build | PLATFORM_INTEGRATION_PLAN §2  |
| Add a line to the listing: "Bought this? Sign in to Empire Studio with the same email to use it as an interactive report." | Vee         | `docs/MIGRATION.md`           |

**Not creating:** a School-Hours Business Kit, a Digital Product Starter Kit or a First 100 Sales System (all overlap existing products: `docs/audit/GAP_ANALYSIS.md` §3).
