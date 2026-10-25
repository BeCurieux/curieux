# Executive summary: Her Little Empire handover

**23 October 2026.** For the founder and ChatGPT.

**Labels:**

- **FACT**: checked in files or connected services.
- **ESTIMATE**: reasoned, not checked.
- **UNVERIFIED**: couldn't be checked from this session.

No secrets or customer details are included.

**Documents in this folder:**

1. [WEBSITE_AND_TECH_HANDOVER.md](WEBSITE_AND_TECH_HANDOVER.md)
2. [COMPLETE_PRODUCT_INVENTORY.md](COMPLETE_PRODUCT_INVENTORY.md)
3. [BRAND_AND_CONTENT_HANDOVER.md](BRAND_AND_CONTENT_HANDOVER.md)
4. [SALES_FUNNEL_AND_CUSTOMER_JOURNEY.md](SALES_FUNNEL_AND_CUSTOMER_JOURNEY.md)
5. [LAUNCH_DECISION_PACK.md](LAUNCH_DECISION_PACK.md)
6. [Screenshots](screenshots/) of the Empire Studio local build.

## A. What exists today

- **A Gumroad catalogue** (founder's `catalog.py`; live state UNVERIFIED):
  - 19 products from US$4 to US$29, plus 3 bundles (US$29, US$39, US$99) and a free 5-Question Fit Check;
  - three more finished workbooks, unreleased.
  - All 68 supplied files were audited (`content/REGISTER.md`).
- **Empire Studio** (FACT): a Next.js web app in `BeCurieux/curieux/empire`, on Vercel (preview only) and Supabase. It contains:
  - the **FIT Finder**, the Income Fit Test as an interactive, tested tool;
  - the **Shopify Launch Studio** (US$49 Launch Pack, not yet sellable);
  - a new **free Ads Profitability Calculator**, built and tested but not yet pushed.

  135 unit tests and 38 browser tests pass.

- **Ads That Actually Sell:** a plan and Module 1 of 10.
- **The public website herlittleempire.com:** its source and hosting are **not in any repository or service this session can see**, and it couldn't be fetched (UNVERIFIED).

## B. What must be preserved

- The promise "Make your own money. Know what you're getting into." and the tagline "Big plans. Real life.".
- FACT/EST/UNKNOWN labelling with dates.
- "Not enough evidence" as a real verdict.
- The house rules, enforced by the claims guard: no income claims, fake urgency, fake reviews, PLR/MRR or MLM.
- Faceless but never anonymous, with the ABN and contact on every page.
- The exact refund sentence.
- The plain, dry, kind voice.
- Bodoni/Lora/Inter on warm cream.
- Data isolation and verified-purchase-only access.
- Every existing Gumroad product and every buyer's access.

## C. What is actually ready to sell

- **Ready:** the existing Gumroad products, as the founder states. The **Income Fit Test (US$19)** is the strongest: finished, flagship, and joined to working software. Its file corrections are written and waiting to be applied.
- **Not ready:**
  - the Launch Pack (no Gumroad product; real AI unreviewed);
  - the Ads course (1 of 10 modules);
  - the Diagnostic tool (plan only);
  - the School-Hours Business Kit, Digital Product Starter Kit, First 100 Sales System, Academy and membership (none of these exist).

## D. What is stopping a fully working sale

1. PR #68 isn't merged, so Empire Studio has no production site.
2. Vercel is on Hobby, which is non-commercial.
3. `studio.herlittleempire.com` and custom sign-in email aren't set up.
4. **Gumroad isn't connected to Studio:**
   - every product id is empty;
   - there's no access token, ping URL or cron secret.

   So purchases can't unlock the full FIT Finder report.

5. The Income Fit Test files need the corrections applied: version, question count, refund wording.
6. No email sequence is set up (copy is drafted).
7. The privacy and terms updates await founder approval and professional review.
8. No genuine test purchase has been run.

## E. What can launch in seven days

All of this uses existing assets, for about US$20/month (ESTIMATE, Vercel Pro):

- the Income Fit Test as the flagship offer;
- the Fit Check as the lead magnet;
- the free Ads calculator and FIT Finder as supporting tools;
- Studio in production on the custom domain;
- Gumroad purchases unlocking the full report;
- one genuine test purchase and refund verified;
- the welcome emails loaded;
- links from the website and Instagram.

Day-by-day owners, dependencies and acceptance tests are in `LAUNCH_DECISION_PACK.md` §3. **Not in seven days:** the full Ads course, the Diagnostic tool, the Launch Pack checkout, the Academy.

## F. What ChatGPT should review and decide (with the founder)

1. **Front door:**
   - Does herlittleempire.com lead with the Income Fit Test and the free Fit Check?
   - How does Empire Studio's Shopify-focused home page fit the side-income brand? Keep it separate, or lead with the free tools?
2. **Ladder:** confirm the Income Fit Test first, and no new overlapping products (Starter Kit, First 100 Sales, School-Hours kit).
3. **Founder presence:** a faceless About; whether to use the barrister and policy credentials, and how (needs the Bar Standards Board check; currently excluded by the founder's own rule).
4. **The welcome sequence** (`content/emails/welcome-sequence.md`) and the Instagram content plan that feeds it.
5. **The Launch Pack:** a separate audience to market later, or pause? And meanwhile, hide its buy button?
6. **The Ads course:** finish it next (P2), or after measuring the Income Fit Test funnel?
7. **Visual:** whether to add a restrained gold accent; currency (US$ vs AUD).
8. **Gumroad vs Shopify:** stay on Gumroad now; revisit with real sales data (`LAUNCH_DECISION_PACK.md` §2).

## G. Evidence gaps, and how to close them

| Gap                                                                     | How to close it                                                                                                                     | Who             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| herlittleempire.com: platform, hosting, pages, copy, analytics, SEO     | Name the platform (admin panel or DNS registrar); export the site or share screenshots of every page; or give a session read access | Founder         |
| Live Gumroad listings, prices, sales, refunds, ratings                  | Export from Gumroad (Products list; Sales CSV with personal details removed; Analytics)                                             | Founder         |
| Gumroad's email features (can it run a timed sequence?)                 | Check Gumroad → Emails / Workflows                                                                                                  | Founder         |
| Gumroad's opt-in wording on free products; tax handling for her account | Gumroad dashboard and current help pages                                                                                            | Founder         |
| Instagram: bio, posts, Reels, metrics                                   | Screenshots or an export from Instagram's professional dashboard                                                                    | Founder         |
| Logo files, photography, the brand book, carousel templates T01–T10     | Add them to `content/source/` locally (kept out of git) or share                                                                    | Founder         |
| The Income Fit Test video course (US$6)                                 | Supply the file for review                                                                                                          | Founder         |
| Vercel dashboard state (production, domains, plan)                      | Screenshot of the project's Deployments and Domains pages                                                                           | Founder         |
| Real AI output quality and cost (Launch Pack)                           | Add the Anthropic key on preview; generate for 3–5 real profiles                                                                    | Founder + Build |
| Compliance items                                                        | `LAUNCH_DECISION_PACK.md` §6                                                                                                        | Professionals   |

**Branch note:** this folder, the audit (`docs/audit/`), the launch plan (`docs/launch/`), the calculator and the privacy and terms updates are on the local branch `hle-ads`. They're **not pushed or merged**, pending the founder's approval.
