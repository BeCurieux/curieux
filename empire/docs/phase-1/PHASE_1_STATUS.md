# Phase 1 status: verified commercial launch

**23 October 2026.** The goal is **one verified end-to-end sale** of the Income Fit Test, before any new feature work.

**Founder decisions in force:**

- The Income Fit Test (US$19) is the first paid offer.
- The 5-Question Fit Check is the primary free lead magnet.
- The Ads Profitability Calculator is a secondary free tool.
- Gumroad stays as checkout; Empire Studio is the app.
- No overlapping products, Academy or Shopify migration.

## 1. PR #68 and `hle-ads`: changes since the 23 October audit

| Item                        | Now (FACT, GitHub and git, checked this session)                                                                         | Change since the audit |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| PR BeCurieux/curieux#68     | Open, not merged; mergeable "clean"; head `80d3595`; checks `check` ✅ and Vercel preview ✅                             | **None**               |
| `main`                      | `17327de` (7 Oct 2026), no `empire/`                                                                                     | None                   |
| `hle-ads` (local, unpushed) | 5 commits on `80d3595`: Ads course plan; calculator and Module 1; launch prep; founder handover; **Phase 1 (this step)** | +1 commit (Phase 1)    |
| Merge dry run               | In a temporary copy: #68 into `main` merges cleanly, then `hle-ads` on top merges cleanly                                | New check              |

**Prepared, awaiting approval** (nothing merged or pushed):

1. **You merge #68** on GitHub. This creates the production deployment of `main`.
2. **Approve the push of `hle-ads`** as a new PR. This creates a Vercel preview.
3. CI runs. **You merge** when it's green.

## 2. What this phase changed (development only, branch `hle-ads`)

| Change                                                                                                                                                                                                                                                                                                                                                                                  | Files                                                                                                                                             | Tests                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Launch Pack dead end fixed (proposal, implemented behind configuration).** It's only offered for sale when its Gumroad product URL and id are both set. Otherwise pricing says "Not on sale yet", the home page says it isn't on sale, the account page shows no buy card, and studio upsells go to `/pricing`. Setting the two variables later turns it back on, with no code change | `src/lib/billing/on-sale.ts`, `src/app/pricing/page.tsx`, `src/app/page.tsx`, `src/app/account/page.tsx`, `src/components/studio/module-view.tsx` | e2e A4                                      |
| **Public FIT Finder page** `/fit`: what's free, what the Income Fit Test adds, what it won't do, the Fit Check for ten-minute visitors                                                                                                                                                                                                                                                  | `src/app/fit/page.tsx`                                                                                                                            | e2e A1, axe                                 |
| **Back to the page you came from after sign-in** (e.g. `/fit` → sign-in → `/studio/fit`). Allow-listed paths only; a 1-hour cookie for emailed links, so Supabase's allowed return address isn't changed                                                                                                                                                                                | `src/lib/auth/next-path.ts`, `src/proxy.ts`, `src/app/sign-in/*`, `src/app/auth/callback/route.ts`                                                | unit (11 bad paths refused), e2e A1–A2      |
| **Free tools in every footer** (Free FIT Finder, Free ads calculator)                                                                                                                                                                                                                                                                                                                   | `src/components/shell/site-header.tsx`                                                                                                            | e2e A3                                      |
| **Gumroad id helper**: read-only script and pure matcher; a safety check that no id is listed twice                                                                                                                                                                                                                                                                                     | `scripts/gumroad-products.ts`, `src/lib/billing/gumroad-match.ts`                                                                                 | unit                                        |
| Events `fit_landing_viewed`; `offer_clicked` now records which page                                                                                                                                                                                                                                                                                                                     | `src/lib/analytics/track.ts`, `src/app/api/events/route.ts`, `src/components/ads/offer-link.tsx`                                                  | —                                           |
| Welcome emails point to `/fit` and mention the interactive report                                                                                                                                                                                                                                                                                                                       | `content/emails/welcome-sequence.md`                                                                                                              | unit (guard, refund, sync with LAUNCH_COPY) |

**Checks run:**

- lint, types and format: pass;
- **142 unit tests**: pass;
- production build: pass;
- **48 Playwright tests** (desktop and phone, axe): pass;
- the RLS suite wasn't needed (no database change).

## 3. Deliverables

| Document                                                           | What it settles                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [PUBLIC_WEBSITE_REQUIREMENTS.md](PUBLIC_WEBSITE_REQUIREMENTS.md)   | The website's platform and source are **unavailable**; an integration spec of links only, plus the DNS record |
| [INCOME_FIT_TEST_CORRECTIONS.md](INCOME_FIT_TEST_CORRECTIONS.md)   | Live-listing checks; line-by-line fixes per kit file; safe file replacement                                   |
| [GUMROAD_CONNECTION_CHECKLIST.md](GUMROAD_CONNECTION_CHECKLIST.md) | Product ids, token, ping, refunds, with secrets kept in Vercel only                                           |
| [CUSTOMER_JOURNEY_TEST_PLAN.md](CUSTOMER_JOURNEY_TEST_PLAN.md)     | Consent map, access rules, 12 automated and 12 manual acceptance tests                                        |
| [LAUNCH_COPY.md](LAUNCH_COPY.md)                                   | Income Fit Test landing copy, Fit Check landing copy, five emails, the listing line                           |
| [LAUNCH_BUDGET.md](LAUNCH_BUDGET.md)                               | ~US$20/month required (ESTIMATE); ~US$45 with Supabase Pro                                                    |

## 4. Verified, unverified, blocked

### Verified (FACT, this session)

- PR #68 status and checks.
- `main` unchanged.
- Merge dry run clean.
- Preview deployment completed.
- All automated tests listed above pass on `hle-ads`.
- The Launch Pack no longer shows a dead-end buy button when unconfigured (e2e).
- `/fit` → sign-in → `/studio/fit` works (e2e, local backend).
- The calculator sends nothing typed (e2e).
- The Gumroad integration rejects forged or borrowed pings and locks refunds (unit, fake Gumroad).

### Unverified (can't be checked from here)

- herlittleempire.com: platform, source, pages, copy.
- The live Income Fit Test and Fit Check listings: price, files, wording, product ids.
- Gumroad's free-product opt-in wording; whether Gumroad's emails can run a timed sequence; what happens to buyers' files when a product's files are replaced; whether Gumroad returns its fee on refunds.
- The Vercel dashboard (plan, domains, production state).
- Current Vercel and Supabase prices and terms.
- The return-to-page cookie with the **real Supabase emailed link** (tested only on the local backend).
- Compliance questions (`docs/founder-handover/LAUNCH_DECISION_PACK.md` §6).

### Blocked (waiting on founder approval or access)

| Action                                                                  | Blocked on                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Merge #68; push and merge `hle-ads`                                     | Founder approval                                                                  |
| Vercel Pro; Supabase Pro                                                | Founder approval and payment                                                      |
| `studio.herlittleempire.com`                                            | DNS access; approval                                                              |
| Gumroad product ids in the catalogue                                    | Ids from the founder's Gumroad account                                            |
| Gumroad token, ping secret, cron secret, ping URL, refund subscriptions | Founder (Vercel and Gumroad access); approval                                     |
| Corrected Income Fit Test files                                         | Source files (not in the repo); founder edits; approval to replace live downloads |
| Website links                                                           | Website access                                                                    |
| Welcome sequence loaded                                                 | Choice of sender (Gumroad or mailing service); approval                           |
| Genuine test purchase and refund                                        | All of the above                                                                  |

## 5. Final launch checklist (in order)

Each step's acceptance test must pass before the next. 🔒 = founder approval.

| #   | Step                                                                                               | Owner             | Done when                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| A   | Review this folder: copy, corrections, plan; and the privacy/terms drafts                          | Founder           | Written yes, or changes                                                                                           |
| B1  | 🔒 Merge #68                                                                                       | Founder           | Production deployment of `main` succeeds                                                                          |
| B2  | 🔒 Push `hle-ads` as a PR; 🔒 merge when green                                                     | Build → Founder   | CI green; `/fit`, `/ads/tools/calculator` live on production                                                      |
| C1  | 🔒 Vercel Pro                                                                                      | Founder           | Plan shows Pro                                                                                                    |
| C2  | 🔒 DNS `studio` record; `APP_URL`; Supabase Site URL and redirect list; custom SMTP                | Founder (+ Build) | An emailed sign-in from `/fit` lands back on `/studio/fit` on the custom domain (verifies the return cookie live) |
| C3  | 🔒 Supabase Pro (recommended before the first real customer)                                       | Founder           | Backups listed                                                                                                    |
| D1  | Verify the live listings; copy product ids (INCOME_FIT_TEST_CORRECTIONS §1)                        | Founder           | Price, files and ids recorded                                                                                     |
| D2  | Ids into the catalogue (small PR) 🔒                                                               | Build → Founder   | Unit test maps each id; CI green                                                                                  |
| D3  | 🔒 Token, ping secret, cron secret in Vercel; ping URL; refund subscriptions                       | Founder (+ Build) | GUMROAD_CONNECTION_CHECKLIST §7 ticked                                                                            |
| E   | 🔒 Apply the Income Fit Test and Fit Check corrections; replace files safely; add the listing line | Founder           | INCOME_FIT_TEST_CORRECTIONS ticked                                                                                |
| F   | 🔒 Genuine test purchase and refund                                                                | Founder + Build   | T1–T12 pass; log recorded                                                                                         |
| G   | 🔒 Website links (W1–W6); Instagram bio link; load the welcome sequence                            | Founder           | Clicks appear in `/admin` sources; a test opt-in gets email 1                                                     |
| H   | First real sale                                                                                    | —                 | A non-test `purchase_verified` with access confirmed                                                              |

**After H only:** the Ads course (M2 onward), the Launch Pack checkout, the Academy.
