# Implementation checklist, in order, with acceptance tests

Work top to bottom. Each step's acceptance test must pass before the next step starts. 🔒 = needs Vee's explicit approval before it's done. ✅ = done in this step (development only).

## Phase A: development (done, awaiting review)

| #   | Step                                        | Acceptance test                                                                                                                                                                                        | Status                      |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| A1  | Calculator page at `/ads/tools/calculator`  | Signed out, it opens with Module 1's example and shows A$41.83 and −A$36.34; editing the price recalculates; a 150% refund rate names the field; e2e on desktop and phone                              | ✅                          |
| A2  | Guardrails                                  | Example A shows "Below break-even" and "Not enough evidence yet, either way"; 3 sales from A$140 shows "A ROAS above 1 can still be a loss"; no reading uses predictive or promising words (unit test) | ✅                          |
| A3  | Privacy-safe calculator                     | e2e: no request body contains the typed numbers                                                                                                                                                        | ✅                          |
| A4  | CSV and print                               | e2e: `ads-profitability.csv` downloads; formulas in cells are neutralised (unit)                                                                                                                       | ✅                          |
| A5  | Consent: campaign cookie only after consent | No `empire_source` cookie set before "Accept" (manual check in DevTools on the preview)                                                                                                                | ✅ code; manual check at B3 |
| A6  | Privacy and terms                           | axe clean on `/privacy` and `/terms`; the privacy page names Supabase, Vercel, Anthropic and Gumroad, and data location (e2e)                                                                          | ✅                          |
| A7  | Welcome sequence                            | Five emails; the claims guard finds nothing; exact refund sentence wherever a price appears; unsubscribe line on each (unit)                                                                           | ✅                          |
| A8  | Full suite                                  | lint, types, format, 135 unit, build, 38 e2e: all pass                                                                                                                                                 | ✅                          |

## Phase B: review and merge

| #   | Step                                                                       | Acceptance test                                                                      | Status                              |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| B1  | 🔒 Vee merges PR BeCurieux/curieux#68                                      | `main` contains `empire/`; Vercel production deployment for `empire-studio` succeeds | ✅ merged 25 Oct; deploy UNVERIFIED |
| B2  | 🔒 Rebase `hle-ads` on `main`, push, open its PR                           | CI `check` green; Vercel preview builds                                              | ✅ PR #69 (stacked, not rebased)    |
| B3  | Vee reviews on the preview: calculator, privacy, terms; emails in the repo | Her written sign-off, or a list of changes (which go into the same PR)               | ⬜                                  |
| B4  | 🔒 Merge the `hle-ads` PR                                                  | `/ads/tools/calculator` loads on production                                          | ✅ merged 25 Oct; page UNVERIFIED   |

## Phase C: hosting

| #   | Step                                                         | Acceptance test                                                      | Status |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------- | ------ |
| C1  | 🔒 Vercel Pro                                                | Plan shows Pro                                                       | ⬜     |
| C2  | 🔒 DNS: `studio.herlittleempire.com` → Vercel; set `APP_URL` | The domain serves the app over HTTPS; the main site is unchanged     | ⬜     |
| C3  | 🔒 Supabase: Site URL and redirect allow-list; custom SMTP   | A sign-in email from the custom sender signs in on the custom domain | ⬜     |
| C4  | Decide when to move to Supabase Pro (LAUNCH_COSTS §2)        | Decision recorded                                                    | ⬜     |

## Phase D: Gumroad

| #   | Step                                                                                           | Acceptance test                                                                                                                   | Status |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D1  | Vee copies the product ids: Income Fit Test, Empire Bundle, The Whole Empire, Fit Check        | Ids in `gumroadProductIds` (a small PR); unit test: each id maps to its slug                                                      | ⬜     |
| D2  | 🔒 `GUMROAD_ACCESS_TOKEN`, `GUMROAD_PING_SECRET`, `CRON_SECRET` set in Vercel (Sensitive)      | App starts on production; no secret in the repo (`git grep` for the values finds nothing; checked by Vee, never pasted into chat) | ⬜     |
| D3  | 🔒 Ping URL in Gumroad                                                                         | Gumroad's "send test ping", if available, returns 200 (or wait for D/F's real sale)                                               | ⬜     |
| D4  | 🔒 Refund and dispute resource subscriptions                                                   | `GET /v2/resource_subscriptions` lists both, pointing at the ping URL                                                             | ⬜     |
| D5  | Vee: CORRECTIONS §1–2 and report patches on the Income Fit Test; the listing line about Studio | Listing and files say 20 questions, v1.4, and the exact refund sentence                                                           | ⬜     |

## Phase E: verified test sale (PLATFORM_INTEGRATION_PLAN §3)

| #   | Step                                                                           | Acceptance test                                                                                       | Status |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------ |
| E1  | 🔒 Buy the Income Fit Test from the calculator page's link with a second email | Gumroad delivers the files                                                                            | ⬜     |
| E2  | Purchase recorded once                                                         | One `purchases` row, `paid`, `library:income-fit-test`                                                | ⬜     |
| E3  | Verified access                                                                | Signing in with that email shows it in the library and unlocks the full FIT report                    | ⬜     |
| E4  | 🔒 Refund                                                                      | After the notification or recheck: status `refunded`; report back to the free top three; answers kept | ⬜     |
| E5  | Funnel                                                                         | `/admin` shows `calculator_viewed`, `offer_clicked`, `purchase_verified`, `purchase_refunded`         | ⬜     |

## Phase F: open the front door

| #   | Step                                                         | Acceptance test                                                      | Status |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------- | ------ |
| F1  | 🔒 Two links on herlittleempire.com with `?ref=website`      | Clicking each opens the tool; `/admin` signup sources show `website` | ⬜     |
| F2  | 🔒 Load the welcome sequence (Gumroad or the chosen service) | A test opt-in receives email 1 immediately and email 2 on day 2      | ⬜     |
| F3  | First real sale                                              | A non-test `purchase_verified` in `/admin`, with access confirmed    | ⬜     |

**Only after F3:** Ads course M2 (member area) onward, the Launch Pack checkout, the Academy.
