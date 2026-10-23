# Feature inventory

Everything that exists for Her Little Empire in this repository, as of 23 October 2026. "Built" means code exists and is covered by tests; "configured" means it runs on the preview with real services. Status of live Gumroad listings is from the founder's `catalog.py` (22 Oct 2026), not checked live.

## 1. Pages and routes (`empire/src/app`, 34 routes in the production build)

### Public

| Route      | What it is                                                                                                                   | Status                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/`        | Empire Studio landing: what you walk away with, how it works, "The honest bit", free start CTA                               | Built, on preview                                      |
| `/pricing` | Free tier vs the one-time Launch Pack (US$49 default), what "one time" means, "Already bought a Her Little Empire download?" | Built; checkout not wired (no Gumroad product yet)     |
| `/sign-in` | Magic-link sign-in                                                                                                           | Built, **configured** (founder signed in, 23 Oct 2026) |
| `/terms`   | Terms and refunds (exact refund sentence + consumer-rights sentence)                                                         | Built; legal review outstanding                        |
| `/privacy` | Privacy summary                                                                                                              | Built; incomplete (see GAP_ANALYSIS)                   |

### Signed in

| Route                                         | What it is                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/studio`, `/studio/new`                      | Workspace list; onboarding (business profile)                                                         |
| `/studio/[profileId]`                         | Business dashboard                                                                                    |
| `…/brand`, `…/profile`                        | Brand Blueprint editor (Empire Studio's own method); profile edit with version history                |
| `…/theme`                                     | Shopify theme brief and 10 Sidekick prompts (labelled interim)                                        |
| `…/products`, `…/products/[id]`, `…/[module]` | Product Writer (titles, descriptions, specs, FAQ, SEO) and photo briefs per product                   |
| `…/marketing`, `…/m/[module]`                 | Launch announcement, 3 launch emails, social launch kit                                               |
| `…/launch`                                    | Launch checklist with saved progress (35 tasks)                                                       |
| `…/assets`, `…/mockups`, `…/export/print`     | Uploads, mockups, print view                                                                          |
| `/studio/fit`, `/studio/fit/[resultId]`       | **FIT Finder**: 20-question quiz; free top three; full Income Fit Report for owners                   |
| `/account`                                    | Account, billing, "Your Her Little Empire library" (past Gumroad purchases), data export and deletion |
| `/admin`                                      | Founder dashboard: funnel, usage, AI cost, signup sources (`ADMIN_EMAILS`)                            |

### API

`/api/billing/checkout`, `/api/billing/gumroad` (ping), `/api/billing/recheck` (daily cron), `/api/events` (first-party analytics), `/api/export/[profileId]` (ZIP), `/api/uploads/[...path]`, `/api/account/data`, `/auth/callback`, `/auth/sign-out`.

### Not yet built (planned in `docs/HLE_ARCHITECTURE_DECISIONS.md`)

`/ads`, `/ads/free`, `/ads/sample`, `/ads/learn`, `/ads/learn/[module]`, `/ads/toolkit`, `/ads/tools/calculator`, `/ads/tools/diagnose`.

## 2. Libraries and components (`empire/src/lib`, `empire/src/components`)

| Area          | Files                                              | Notes                                                                                                              |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| AI            | `lib/ai/` (provider, mock generators, guard)       | Every call through `runGeneration`; claims guard flags income claims, fake urgency, PLR/MRR, MLM, invented reviews |
| Billing       | `lib/billing/` (plans, gumroad, provider)          | Gumroad behind a `BillingProvider` interface (Stripe can be added without touching the studio)                     |
| FIT Finder    | `lib/fit/` (engine, data, questions, rules)        | 1:1 port of the shipped Income Fit Report v1.4, tested on 5,000 answer sets                                        |
| Ads course    | `lib/ads/calculator.ts`, `lib/ads/lesson.ts`       | **Branch `hle-ads`, not pushed.** Calculator engine and lesson parser                                              |
| Analytics     | `lib/analytics/`, `components/consent.tsx`         | First-party, consent-aware; no third-party trackers                                                                |
| Auth          | `lib/auth/`                                        | Magic link; origin-safe redirect                                                                                   |
| Shell / brand | `components/shell/imprint.tsx`, `content/brand.ts` | Seller footer on every page; promise and tagline constants                                                         |
| Catalogue     | `content/catalogue.ts`                             | 19 products + 3 bundles + Launch Pack; **all `gumroadProductIds` empty**                                           |
| Methods       | `content/methodology.ts`                           | Founder's methods used by the generators, each citing its source product                                           |

## 3. Data (Supabase, `empire/supabase/migrations`, FACT 23 Oct 2026)

10 tables, RLS on all: `business_profiles` (1 row), `profile_versions` (2), `products` (0), `generations` (1), `launch_tasks` (35), `purchases` (0), `entitlements` (0), `usage_ledger` (1), `analytics_events` (8), `fit_results` (0). Storage bucket for uploads. Planned: `ads_progress`, `ads_scenarios`.

## 4. Content and downloadable materials

| Asset                                                      | Where                                                   | Status                                              |
| ---------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| Content register (35 assets audited from 68 founder files) | `content/REGISTER.md`, `register.json`, `register.csv`  | Complete; source PDFs **not committed** (by design) |
| Method extractions, quoted and cited                       | `content/audit/*.md`                                    | Complete                                            |
| Fixes the founder's PDFs need                              | `content/CORRECTIONS.md`, `content/corrections/*.patch` | Ready; applying them to the PDFs is on the founder  |
| 23 income opportunities                                    | `content/fit/opportunities.json`                        | Live in FIT Finder                                  |
| 100 Faceless Hooks                                         | `content/hooks/hooks.json`                              | Imported word for word; no hook library page yet    |
| Ads course Module 1                                        | `content/ads/modules/01-the-numbers.md`                 | Written (~2,000 words), tested; branch `hle-ads`    |
| PDFs / product files                                       | Gumroad (not in repo)                                   | UNVERIFIED live                                     |

## 5. Products on sale (from `catalog.py`, US$; live state UNVERIFIED)

Income Fit Test 19 · Video Course 6 · First 5 Customers 7 · Get Found 7 · Price It Right 5 · 14-Day Tracker 4 · Brand-in-a-Box 9 · 100 Faceless Hooks 9 · Comment-to-DM Kit 12 · 30-Day Faceless Content Plan 17 · Your Little Offer Kit 19 · VA & OBM Starter Kit 29 · Etsy Digital Downloads Starter Kit 29 · Pinterest Manager Starter Kit 29 · Tutor & Lesson Starter Kit 29 · 90-Day Grow Plan 24 · Side Income Money System 19 · Client Paperwork Kit 19 (not yet on Gumroad) · AI Business Assistant Pack 12 (not yet on Gumroad). Bundles: Empire Bundle 39, Faceless Content Bundle 29, Whole Empire 99. Free: 5-Question Fit Check. Unreleased: Sell It Simply, Faceless Content System, Faceless & Not Anonymous.

## 6. Integrations

| Integration       | State                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Supabase          | **Configured** (preview), free plan                                                                     |
| Vercel            | **Configured** (preview), Hobby plan; production fails until #68 merges                                 |
| Gumroad           | Code built and unit-tested with a fake Gumroad; **no env vars, no Launch Pack product, no product ids** |
| Anthropic         | Code built; **not configured** (key pending with the founder); mock in use                              |
| Email (sign-in)   | Supabase built-in mailer (heavily rate-limited); no custom SMTP                                         |
| Email marketing   | **None**                                                                                                |
| Shopify           | **None for Her Little Empire.** The connected store is PATONGA, another business                        |
| Meta pixel / CAPI | **None** (deliberately: no third-party trackers)                                                        |
| Error reporting   | None (Sentry deferred until traffic, `docs/BACKLOG.md`)                                                 |
