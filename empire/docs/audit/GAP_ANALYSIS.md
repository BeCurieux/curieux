# Gap analysis

What's broken, incomplete, duplicated or missing, as of 23 October 2026. Each item says how it was found. Nothing here was fixed (audit only).

## 1. Broken

| #   | Issue                                                                                                          | Evidence                                                                                         | Impact                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| B1  | **Vercel production deployment fails**: `main` has no `empire/` folder                                         | PR #68 unmerged (GitHub, 23 Oct 2026); earlier failed production builds                          | No production URL; only the preview works                                                                 |
| B2  | **Library matching can't work**: every `gumroadProductIds` list is empty                                       | `src/content/catalogue.ts`                                                                       | Past buyers signing in won't see their purchases; Income Fit Test owners won't unlock the full FIT report |
| B3  | **The Launch Pack can't be bought**: no Gumroad product, no `GUMROAD_*` variables                              | `docs/ENVIRONMENT.md`; variables set on the preview so far (founder, 23 Oct 2026)                | The software has no checkout                                                                              |
| B4  | **Gumroad handle inconsistency**: examples use `herlittleempire.gumroad.com`; the store is `herlittleempireco` | `docs/ENVIRONMENT.md` (`GUMROAD_PRODUCT_URL` example) vs `docs/CATALOGUE.md`, Instagram decision | A copied example URL would 404                                                                            |

No code defects were found: lint, types, format, 115 unit tests, the build, 20 e2e tests and the RLS suite all pass (see AUDIT_REPORT §3).

## 2. Incomplete

| #   | Item                     | What's done                                                                  | What's missing                                                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| I1  | Ads That Actually Sell   | Plan, architecture, Module 1, calculator engine (branch `hle-ads`, unpushed) | Modules 2–10, toolkit, member area, reader, progress, sales page, diagnostic, Gumroad product                    |
| I2  | Profitability calculator | Engine and 19 hand-computed tests                                            | Page, inputs, saved scenarios, CSV, print                                                                        |
| I3  | Real AI output           | Anthropic provider, budget and guard built                                   | Key not set; no real generation reviewed for tone, accuracy or cost (QA "Not yet verified" item 2)               |
| I4  | Sidekick prompts         | 10 prompts, labelled interim                                                 | Not tried in real Shopify themes (QA item 3); no HLE Shopify method exists                                       |
| I5  | Legal pages              | Terms with the exact refund wording; a short privacy page                    | Legal review; privacy omits Supabase/Vercel as processors, US data location, cross-border transfer and retention |
| I6  | Accessibility            | axe passes everywhere tested                                                 | Manual VoiceOver/NVDA pass (QA item 6)                                                                           |
| I7  | Founder's PDFs           | Fixes written (`content/CORRECTIONS.md`, two report patches)                 | Applying them to the PDFs and Gumroad files (founder)                                                            |
| I8  | Open founder items       | Listed in `content/REGISTER.md` §3                                           | 30-Day Plan Day 13; Price It Right's own example; old generators in `source/`                                    |

## 3. Duplicated or overlapping

| #   | Overlap                                                                                                               | Evidence                                              | Recommendation                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D1  | Two free lead magnets: the 5-Question Fit Check and the planned "First Sale Checklist" / "Business Reality Check"     | `docs/CATALOGUE.md`; brief                            | Make the **FIT Finder free tier** the one front door; it already exists, is interactive and is honest |
| D2  | Planned "Digital Product Starter Kit" vs Your Little Offer Kit (US$19) and Etsy Digital Downloads Starter Kit (US$29) | `docs/HLE_EXISTING_ASSETS_AUDIT.md` §2                | Bundle or reposition existing kits rather than write a fourth                                         |
| D3  | Planned "First 100 Sales System" vs First 5 Customers (US$7) and 90-Day Grow Plan (US$24)                             | same                                                  | Don't build; "100 sales" reads as a results promise                                                   |
| D4  | Pricing calculator (planned from Price It Right) vs the Ads profitability calculator                                  | `docs/BACKLOG.md` item 5; `src/lib/ads/calculator.ts` | Share one money engine: the ads calculator already has fees, GST and refunds                          |
| D5  | Two currencies: catalogue in US$, Ads course in AUD                                                                   | `src/content/catalogue.ts`; AD-8                      | Founder decision: one display currency per audience, or show both                                     |

## 4. Missing

| #   | Gap                                             | Why it matters                                                                                                                                                            |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Email list and welcome sequence**             | No way to capture a visitor who isn't ready to buy, or to tell past buyers about anything new                                                                             |
| M2  | **Abandoned-checkout follow-up**                | Gumroad's own options are UNKNOWN (dashboard not visible here); nothing in the app                                                                                        |
| M3  | **Custom SMTP for sign-in emails**              | Supabase's built-in mailer is heavily rate-limited (`docs/SERVICES.md`); a launch day could lock people out                                                               |
| M4  | **Paid plans**: Vercel Pro, Supabase Pro        | Hobby is non-commercial; free Supabase pauses when idle and has no backups                                                                                                |
| M5  | **Public SEO basics** for any public sales page | No sitemap, robots, Open Graph images or page descriptions                                                                                                                |
| M6  | **Conversion tracking for ads**                 | No Meta pixel or Conversions API. Deliberate (privacy), but the Ads course will teach it; HLE's own ads would be unmeasurable. Founder decision                           |
| M7  | **Testimonials**                                | None exist anywhere (correctly: none invented). Needs a real-permission collection process                                                                                |
| M8  | **Error reporting**                             | No Sentry or equivalent; errors only in Vercel logs                                                                                                                       |
| M9  | **The website itself in version control**       | herlittleempire.com can't be audited, reviewed or rolled back from here                                                                                                   |
| M10 | Products named in the brief                     | School-Hours Business Kit, Business Reality Check, Digital Product Starter Kit, First 100 Sales System, Academy dashboard, membership: **none exist** (PRODUCT_READINESS) |

## 5. Unused

- `content/source/` holds only a README; the founder's old generators (`cards.py`, `quickstart.py`) are outdated (REGISTER §3) and shouldn't be used.
- 100 hooks imported (`content/hooks/hooks.json`) with no page that shows them.
- `/admin` funnel exists but has almost no data (8 analytics events in Supabase).

## 6. Risks

| Risk                                                            | Likelihood | Mitigation                                                                                                    |
| --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Brand split three ways (kits, software, course) confuses buyers | High       | One front door and one ladder (BRAND_AND_CONVERSION_AUDIT §4)                                                 |
| Founder credentials used in a way that implies legal practice   | Medium     | Approved wording, checked against the Bar Standards Board rules for unregistered barristers (UNKNOWN: verify) |
| Meta interface facts in Module 2 go stale                       | High       | AD-10: dated sources, launch blocked while UNKNOWN remains                                                    |
| AI cost overrun                                                 | Low        | Allowance, hourly limit, daily budget ceiling already built                                                   |
| Over-building before evidence (Academy, membership)             | High       | P3 only after paid demand (PRIORITISED_BUILD_PLAN)                                                            |
