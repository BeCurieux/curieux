# Her Little Empire: comprehensive project audit

**Date:** 23 October 2026 · **Scope:** the `BeCurieux/curieux` repository, the connected Supabase project, the connected Shopify account, and pull request BeCurieux/curieux#68 · **Mode:** audit only. Nothing was changed, committed, deployed or published, except that these eight files were written.

Every finding cites a file or a check. Labels follow Her Little Empire's house rule: **FACT** (checked, with the date), **EST** (a reasoned estimate) or **UNKNOWN / UNVERIFIED** (not checked).

## Companion documents

| File                                                           | What it covers                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md)                   | Every page, route, component group, data table, integration and content asset    |
| [GAP_ANALYSIS.md](GAP_ANALYSIS.md)                             | Broken, incomplete, duplicated and missing functionality; technical risks        |
| [BRAND_AND_CONVERSION_AUDIT.md](BRAND_AND_CONVERSION_AUDIT.md) | Phases 2 and 4: the customer journey, the brand and positioning                  |
| [PRODUCT_READINESS.md](PRODUCT_READINESS.md)                   | Phase 3: the nine products in the brief, plus everything already on sale         |
| [RECOMMENDED_ARCHITECTURE.md](RECOMMENDED_ARCHITECTURE.md)     | Phase 5: options A, B and C compared, with costs                                 |
| [PRIORITISED_BUILD_PLAN.md](PRIORITISED_BUILD_PLAN.md)         | Phase 6: P0 to P3, each item with status, evidence, cost and acceptance criteria |
| [SEVEN_DAY_LAUNCH_PLAN.md](SEVEN_DAY_LAUNCH_PLAN.md)           | What can honestly launch in seven days, day by day                               |

## 1. The most important finding: the website isn't in this repository

**herlittleempire.com's code is not in this repository.** The repository holds nine independent products side by side (`haunted`, `lattice`, `mavya`, `ordinary-tuesday`, `qotidia`, `shopfront`, `tildie`, `waterline`, `empire`; see `DEPLOYS.md`). The only Her Little Empire project is **`empire/`, Empire Studio**: a Next.js web app for the members' tools and the software side, designed to run at `studio.herlittleempire.com` (`docs/ENVIRONMENT.md`, `APP_URL`).

**The live site and store couldn't be inspected from this session** (FACT, 23 Oct 2026). From this sandbox, `herlittleempire.com`, `www.herlittleempire.com`, `herlittleempireco.gumroad.com` and `gumroad.com` all fail: "CONNECT tunnel failed, 403" from curl and "ENOTFOUND" from the web fetcher. That's the session's network policy, not evidence the sites are down. So:

- the public website's platform, pages, navigation, copy, speed, SEO and policies are **UNVERIFIED**;
- the live Gumroad listings, their prices, sales and reviews are **UNVERIFIED**. The catalogue figures in this audit come from the founder's `catalog.py`, as copied into `src/content/catalogue.ts` and `docs/CATALOGUE.md` (22 Oct 2026).

**To close this gap:** export the website (or give a later session read access to its platform) and screenshot the Gumroad dashboard's product list. The website half of Phases 1 and 2 needs one of these.

## 2. Phase 1: technical audit (Empire Studio)

### Stack and deployment (FACT, from `package.json` and the build, 23 Oct 2026)

| Layer            | What's used                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16.4.2 (App Router, Turbopack, `proxy.ts` instead of middleware), React 19.3, TypeScript 6                                                                                                   |
| Styling          | Tailwind CSS 4; brand tokens in `src/app/globals.css`; self-hosted fonts (`public/fonts`, 9 files, 304 KB)                                                                                           |
| Validation       | Zod 4; environment validated at start-up (`src/env.ts`)                                                                                                                                              |
| Data and sign-in | Supabase: Postgres 17, magic-link Auth, Storage. Project "Empire Studio" (`zdsrkrgbxzhmqkqoruep`, us-east-1, free plan, ACTIVE_HEALTHY). A local JSON backend for development, refused in production |
| AI               | Anthropic SDK behind `runGeneration` (limits, budget, validation, claims guard, ledger). The default provider is `mock` (offline)                                                                    |
| Payments         | Gumroad: licence verification, sale lookup, ping, daily refund recheck (`src/lib/billing/`, `docs/PAYMENTS.md`)                                                                                      |
| Hosting          | Vercel project `empire-studio` (root `empire`), **Hobby plan**; daily cron in `vercel.json`                                                                                                          |
| Tests            | Vitest (115 unit tests), Playwright (20 tests, desktop and 390 px, axe checks), a Postgres RLS suite (`scripts/rls-test.sh`)                                                                         |
| CI               | `.github/workflows/empire.yml`                                                                                                                                                                       |

### Git status (FACT, 23 Oct 2026)

- **PR BeCurieux/curieux#68 is open and not merged.** Its merge state is "clean"; head `80d3595`, 9 commits, 208 files.
- **`main` has no `empire/` folder**, so the Vercel production deployment fails. Only the preview deployment of the PR branch works.
- **The local branch `hle-ads` has 2 commits that aren't pushed**: `e243d79` (the Ads course audit, architecture and plan) and `8f01358` (the calculator engine and Module 1). They're held back until #68 merges, as decided on 23 Oct 2026.
- The working tree was clean before this audit. These eight files are its only change, and they're **not committed**.

### Live services (FACT, read-only checks, 23 Oct 2026)

- **Supabase:** all 4 migrations applied; 10 tables, all with row level security on. Security advisors:
  - `purchases` and `analytics_events` have RLS on but no policies (INFO). That's intentional: only the server, using the secret key, reads or writes them, so customers are denied by default (`docs/DATA_MODEL.md`).
  - "Leaked password protection disabled" (WARN). Not applicable: sign-in is passwordless magic link only.
- **Shopify:** the only store connected to this workspace is **PATONGA** (patonga.com.au, Basic plan, AUD), a different business. **Her Little Empire has no Shopify store connected** and no Shopify code in the app. `docs/SHOPIFY-INTEGRATION.md` is a later-phase plan.

### Security, accessibility and performance

| Area           | Finding                                                                                                                                                                                                                         | Evidence                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Data isolation | Strong. RLS on every customer table, a mutation-tested RLS suite, trigger functions not callable over the API, a cross-account e2e test                                                                                         | `supabase/migrations`, `docs/SECURITY.md`, `docs/QA-REPORT.md`  |
| Payments       | Access only from a verified Gumroad sale (signed `empire_ref`, ping secret, idempotent on sale id), never from a redirect                                                                                                       | `src/lib/billing/gumroad.ts`                                    |
| Secrets        | No real secrets committed. A search for key patterns found only a fake `sk-ant-xyz` inside a test                                                                                                                               | `git grep`, 23 Oct 2026                                         |
| Accessibility  | axe (serious and critical) passes on the landing, pricing, sign-in, studio and FIT Finder pages at both widths; skip link, labelled fields, focus rings. **No manual screen-reader pass yet**                                   | `tests/e2e`, `docs/QA-REPORT.md`                                |
| Mobile         | The whole e2e suite runs at 390 px. Long editors (Brand Blueprint) are long on a phone                                                                                                                                          | `playwright.config.ts`, QA report                               |
| Performance    | **Not measured** (no Lighthouse; the preview isn't reachable from here). All routes' client JavaScript together is 944 KB uncompressed (largest chunk 230 KB). Fonts are self-hosted, so there are no third-party font requests | `.next/static/chunks`, 23 Oct 2026                              |
| SEO            | No `sitemap`, `robots`, Open Graph image or per-page descriptions, apart from titles. Acceptable for a logged-in app; not acceptable if `/ads` becomes a public sales page                                                      | `src/app/layout.tsx`, search of `src/app`                       |
| Privacy        | The privacy page names Anthropic and Gumroad, but not Supabase or Vercel, where data is stored (US East), cross-border transfer, or how long data is kept. A legal review is still outstanding                                  | `src/app/privacy/page.tsx`, QA report "Not yet verified" item 5 |

## 3. Validation run (Phase 7)

| Check                                   | Result (23 Oct 2026, branch `hle-ads` at `8f01358`)                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ESLint (`--max-warnings=0`)             | Pass                                                                                                                     |
| TypeScript (`tsc --noEmit`)             | Pass                                                                                                                     |
| Prettier                                | Pass                                                                                                                     |
| Unit tests (Vitest)                     | **115 / 115 pass** (13 files)                                                                                            |
| Production build (`next build`)         | Pass; 34 routes                                                                                                          |
| Playwright e2e (local backend, mock AI) | **20 / 20 pass** (10 desktop, 10 at 390 px, including axe checks)                                                        |
| RLS suite (local Postgres 16)           | **All checks pass.** The first run failed only because the local Postgres service wasn't running; it passed once started |
| Supabase advisors                       | 2 INFO (intended), 1 WARN (not applicable)                                                                               |

**Limits of this validation:**

- Every test ran on the local backend with the offline mock generator.
- No real Gumroad purchase, no real Claude output and no real sign-in email were tested in this session. The founder confirmed sign-in works on the preview (23 Oct 2026).
- The live website wasn't tested at all (§1).

## 4. Summary verdict

- **Empire Studio is well-engineered** and close to sellable. What blocks it is configuration and accounts, not code.
- **The brand's commercial engine is the Gumroad catalogue**: 19 products and 3 bundles in US$ (status from `catalog.py`; live state UNVERIFIED).
- **Of the nine products in this brief, none is finished and launch-ready.** One is substantially built: the calculator engine. One is partly built: the Ads course, 1 of 10 modules. One exists in a related form: the FIT Finder's free tier as a lead magnet. The rest don't exist yet.
- **Biggest commercial risk: the brand is split three ways.** Gumroad kits in US$, Shopify-launch software, and an AUD ads course, with no single front door or email list tying them together.

The end-of-audit summary (excellent / complete / broken / missing / first-sale blockers / top 10 / seven-day launch / next step) is in [PRIORITISED_BUILD_PLAN.md §5](PRIORITISED_BUILD_PLAN.md#5-summary).
