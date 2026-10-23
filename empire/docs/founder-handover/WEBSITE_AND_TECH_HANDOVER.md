# Website and tech handover

**Prepared 23 October 2026 for strategic review (ChatGPT and the founder).** Documentation only: nothing was changed, deployed or merged to produce it.

**Labels:**

- **FACT**: checked in a file, a repository or a connected service, with how.
- **ESTIMATE**: reasoned, not checked.
- **UNVERIFIED**: couldn't be checked from this session.

Secrets, keys and customer details are deliberately left out.

## 1. Two different things share the name

|                      | **herlittleempire.com** (the public website)                                                                                                                                                                                                       | **Empire Studio** (`studio.herlittleempire.com`, planned)                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| What it is           | The brand's public site                                                                                                                                                                                                                            | A signed-in web app: FIT Finder, Shopify Launch Studio, the new Ads calculator, later the course                    |
| Source code          | **UNVERIFIED: not in the repository this session can see.** `BeCurieux/curieux` holds nine unrelated apps plus `empire/` (`DEPLOYS.md`)                                                                                                            | **FACT:** `BeCurieux/curieux`, folder `empire/`                                                                     |
| Hosting              | **UNVERIFIED.** Not on the connected Shopify account (that store is PATONGA, another business). Not among the Vercel projects named in `DEPLOYS.md`                                                                                                | **FACT:** Vercel project `empire-studio`, root directory `empire`, Hobby plan, region `iad1` (`empire/vercel.json`) |
| Reachable from here? | **No.** The fetch returned "ENOTFOUND" and the proxy returned 403 (23 Oct 2026); this session's network blocks outside sites. That doesn't mean the site is down                                                                                   | Preview only (below)                                                                                                |
| Pages, navigation    | **UNVERIFIED.** The only evidence is indirect: the founder says the promise and supporting line "come from the website" (`src/content/brand.ts`), and the brand book says the website already follows print style v2 (`content/CORRECTIONS.md` §5) | §3 below                                                                                                            |

**To close the website gap:**

- the founder names the platform (her admin panel or DNS registrar shows it) and shares the homepage and key pages as screenshots or an export;
- or she grants a later session read access to the platform.

Until then, no statement about the website's pages, speed, SEO, analytics or integrations is evidence-based.

## 2. URLs

| URL                                                                                | What                                                             | Status                                                                                          |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| https://herlittleempire.com                                                        | Public website                                                   | UNVERIFIED (unreachable from here)                                                              |
| https://studio.herlittleempire.com                                                 | Planned home of Empire Studio (`docs/ENVIRONMENT.md`, `APP_URL`) | **Not set up** (FACT: no DNS step done; `APP_URL` example only)                                 |
| https://empire-studio-git-claude-exciti-301668-hello-40583210s-projects.vercel.app | Vercel preview of PR #68's branch                                | FACT: deployed (GitHub status "Deployment has completed", 23 Oct 2026); founder signed in on it |
| Empire Studio production (`main`)                                                  | —                                                                | **None.** FACT: `main` (last commit 7 Oct 2026) has no `empire/` folder until PR #68 merges     |
| https://herlittleempireco.gumroad.com                                              | Gumroad store (handle confirmed by founder)                      | UNVERIFIED live                                                                                 |
| …/l/income-fit-test                                                                | Income Fit Test listing                                          | Founder-supplied, 22 Oct 2026; UNVERIFIED live                                                  |
| …/l/fit-check                                                                      | Free 5-Question Fit Check                                        | Founder-supplied permalink; UNVERIFIED live                                                     |
| https://github.com/BeCurieux/curieux/pull/68                                       | Empire Studio pull request                                       | FACT: open, mergeable, checks green                                                             |

## 3. Empire Studio: pages, layout and functionality

Screenshots of a **local build** (mock data, local backend, branch `hle-ads`) are in [`screenshots/`](screenshots/); index in §9.

**Layout (all public pages):**

- **Header:** the "Empire STUDIO" wordmark (text only, no image logo), then Pricing, Sign in and a "Start free" button.
- **Footer:** "Her Little Empire — Make your own money. Know what you're getting into." and "Big plans. Real life."; links to Pricing, Terms and refunds, Privacy, herlittleempire.com; the imprint "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com" and the refund sentence.
- **Cookie choice banner:** Accept / No thanks.

| Route                           | Access       | What it does                                                                                                                                         | Status (FACT unless marked)                                                                              |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                             | Public       | Shopify Launch Studio landing: "Your Shopify launch, written, planned and ready to paste."                                                           | Built, on preview                                                                                        |
| `/pricing`                      | Public       | Free studio US$0 vs Shopify Launch Pack US$49 one time; "Already bought a Her Little Empire download?"                                               | Built; **"Get the Launch Pack" is a dead end** (no Gumroad product configured: it returns to `/account`) |
| `/ads/tools/calculator`         | Public       | Free Ads Profitability Calculator                                                                                                                    | Built and tested on `hle-ads`; **not on the preview** (branch unpushed)                                  |
| `/sign-in`                      | Public       | Magic-link sign-in                                                                                                                                   | Working on preview (founder, 23 Oct 2026)                                                                |
| `/privacy`, `/terms`            | Public       | Privacy notice; terms and refunds                                                                                                                    | Updated on `hle-ads`, pending founder and professional review                                            |
| `/studio/fit`                   | Signed in    | FIT Finder: 20 questions → free top three; full report for Income Fit Test owners                                                                    | Built and tested; full report needs Gumroad product ids                                                  |
| `/studio/new`, `/studio/[id]/…` | Signed in    | Shopify Launch Studio: profile, Brand Blueprint, theme brief and Sidekick prompts, product writer, photo briefs, marketing, launch checklist, export | Built and tested on mock AI; real AI not configured                                                      |
| `/account`                      | Signed in    | Account, library of past Gumroad purchases, data export and deletion                                                                                 | Built                                                                                                    |
| `/admin`                        | Founder only | Funnel, usage, cost, signup sources                                                                                                                  | Built                                                                                                    |

## 4. Tech stack (FACT, `empire/package.json` and build, 23 Oct 2026)

- **App:** Next.js 16.4, React 19.3, TypeScript 6, Tailwind CSS 4, Zod 4. Fonts are self-hosted: Bodoni Moda, Lora, Inter, Caveat.
- **Data and sign-in:** Supabase project "Empire Studio" (us-east-1, free plan). Postgres 17 with row level security on all 10 tables; magic-link Auth; private Storage bucket.
- **AI:** Anthropic, through one guarded path (`runGeneration`), with limits, a daily budget, validation and a claims guard. **Currently the offline mock.** The API key hasn't been added (founder action pending).
- **Tests:** 135 unit tests, 38 Playwright tests (desktop and phone, with axe accessibility checks) and a database-security suite. All passed on 23 Oct 2026.
- **CI:** GitHub Actions `.github/workflows/empire.yml`.

## 5. Roles of each platform

| Platform      | Role                                                                                                                                                                                                                        | Status                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Gumroad**   | Checkout, file delivery and receipts for every Her Little Empire product (19 products, 3 bundles, 1 freebie in the founder's `catalog.py`). Empire Studio checks purchases with Gumroad's API and unlocks matching features | Store live per founder (UNVERIFIED). Integration code built and unit-tested; **not configured** (no product ids, token or ping) |
| **Shopify**   | **None for Her Little Empire.** Empire Studio _teaches customers_ to launch Shopify stores (prompts, briefs); it doesn't use Shopify itself                                                                                 | FACT: only connected store is PATONGA (unrelated)                                                                               |
| **Supabase**  | Empire Studio's database, sign-in and file storage                                                                                                                                                                          | FACT: active; 1 account (the founder's test); 0 purchases                                                                       |
| **Vercel**    | Hosts Empire Studio; runs the daily refund recheck                                                                                                                                                                          | FACT: preview works; production waits for PR #68; Hobby plan (non-commercial)                                                   |
| **Anthropic** | Writes Studio content when a customer generates                                                                                                                                                                             | Not configured                                                                                                                  |

## 6. Payments, domain and marketing integrations

- **Payments:** Gumroad only (`src/lib/billing/`, `docs/PAYMENTS.md`).
  - Access is granted only after a sale is looked up with Gumroad.
  - It's recorded once per sale id; refunds are rechecked daily.
  - Missing: product ids (all empty in `src/content/catalogue.ts`), the access token, the ping secret, the ping URL and the cron secret.
- **Domain:** Empire Studio expects `studio.herlittleempire.com`. No DNS has been changed. The main domain's DNS and registrar are UNVERIFIED.
- **Sign-in email:** Supabase's built-in mailer; heavily rate-limited, so custom SMTP is needed before launch.
- **Marketing integrations in the app:**
  - first-party analytics only (§7);
  - **no** Meta pixel, Google Analytics, mailing-list service, social scheduler or ad platform;
  - website integrations are UNVERIFIED.
- **Instagram:** handle **@herlittleempire.co** (founder-confirmed; `content/CORRECTIONS.md` §9). Posts and metrics aren't available to this session.

## 7. Analytics

First-party events in Supabase (`docs/ANALYTICS.md`): landing, pricing and calculator views; sign-ups; profile and FIT Finder completion; generations; copies and downloads; checkout starts; verified purchases and refunds; and next-step clicks from the calculator.

**Real data (FACT, read-only count, 23 Oct 2026, all from the founder's own testing):** 4 landing views, 1 pricing view, 1 profile completed, 1 generation, 0 purchases.

**Known gap:** a sign-up is only counted if the first successful sign-in comes within 10 minutes of the account being created. The founder's first link failed (since fixed), so her sign-up wasn't counted.

## 8. Working, broken, missing, unverified

| Working (FACT)                                                                                         | Broken (FACT)                                                                                                   | Missing (FACT)                                                                                   | Unverified                                                                                    |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Preview deploy; sign-in on preview; FIT Finder free tier; Studio on mock AI; data isolation; all tests | No production deploy (PR #68 unmerged); "Get the Launch Pack" dead end; past-purchase matching (no product ids) | Custom domain; custom SMTP; Gumroad configuration; email list; real AI; Vercel Pro; Supabase Pro | Everything about herlittleempire.com; live Gumroad listings and sales; Vercel dashboard state |

## 9. Screenshot index (local build, mock data, 23 Oct 2026)

| File                                                                                   | Shows                                                                                                |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [01-studio-home.png](screenshots/01-studio-home.png)                                   | Empire Studio landing: Shopify launch promise, eight outputs, how it works, "The honest bit", footer |
| [02-pricing.png](screenshots/02-pricing.png)                                           | Free vs Launch Pack US$49; "one time" explained; past-buyer note                                     |
| [03-ads-calculator.png](screenshots/03-ads-calculator.png)                             | Free Ads Profitability Calculator with Module 1's hypothetical example (a loss, on purpose)          |
| [04-sign-in.png](screenshots/04-sign-in.png)                                           | Sign-in page (local backend; production uses emailed links)                                          |
| [05-privacy.png](screenshots/05-privacy.png), [06-terms.png](screenshots/06-terms.png) | Updated privacy and terms (pending review)                                                           |
| [07-fit-finder-start.png](screenshots/07-fit-finder-start.png)                         | FIT Finder question 1 of 20, under the brand promise                                                 |
| [08-ads-calculator-phone.png](screenshots/08-ads-calculator-phone.png)                 | Calculator at phone width                                                                            |

**No screenshots of herlittleempire.com exist in the project.**

## 10. Where the code and docs live

| Path (in `empire/`)                             | Contents                                             |
| ----------------------------------------------- | ---------------------------------------------------- |
| `src/app/`                                      | Pages and API routes                                 |
| `src/lib/billing/`, `docs/PAYMENTS.md`          | Gumroad integration                                  |
| `src/lib/fit/`                                  | FIT Finder engine (port of the Income Fit Report)    |
| `src/lib/ads/`                                  | Ads calculator engine and page logic                 |
| `src/content/catalogue.ts`, `docs/CATALOGUE.md` | Product catalogue and Gumroad product ids (empty)    |
| `src/content/brand.ts`, `src/app/globals.css`   | Promise, tagline, colours, type                      |
| `supabase/migrations/`, `docs/DATA_MODEL.md`    | Database and security rules                          |
| `docs/ENVIRONMENT.md`, `docs/SERVICES.md`       | Settings and costs                                   |
| `content/`                                      | Product register, corrections, course module, emails |
| `docs/audit/`, `docs/launch/`                   | The audit and the launch plan                        |

**Branch note:** everything after `80d3595` (the Ads course, the calculator page, privacy and terms updates, the audit and launch docs, this handover) is on the local branch `hle-ads`, **not yet pushed**. PR #68 holds the rest.
