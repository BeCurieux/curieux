# Customer journey test plan

What each part of the purchase journey asks of the customer, what the system does, and the acceptance tests that prove it end to end.

**Status labels:**

- **AUTOMATED**: covered by tests in this repo, run 23 Oct 2026, local backend.
- **MANUAL**: needs a person in production.
- **BLOCKED**: can't run until a dependency is done.

## 1. Consent map

| Point                                 | What's collected                                                                | Consent / basis                                                                                   | Where it's stated                        | Verify                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Any Studio page                       | A page-view event without an identifier; campaign name (`?ref=`) with the view  | No cookie before consent. The banner offers "No thanks" as easily as "Accept"                     | Cookie banner; `/privacy`                | AUTOMATED (campaign cookie only after consent; unit and e2e) |
| Banner "Accept"                       | A random identifier (`empire_anon`); campaign cookie (`empire_source`, 30 days) | Opt-in                                                                                            | Banner; `/privacy`                       | MANUAL: DevTools shows no `empire_source` before Accept      |
| Ads calculator                        | Nothing typed (computed in the browser)                                         | n/a                                                                                               | Calculator page; `/privacy`              | AUTOMATED (no request carries typed numbers)                 |
| Sign-in (FIT Finder, buyers)          | Email address (account)                                                         | Needed to provide the service; **not** marketing consent                                          | Sign-in page; `/privacy`                 | AUTOMATED (local); MANUAL (production emails)                |
| Return-to-page cookie (`empire_next`) | The page to return to (e.g. `/studio/fit`), up to 1 hour                        | Strictly necessary for the sign-in she started                                                    | Code comment; can be added to `/privacy` | AUTOMATED (path allow-list)                                  |
| Free Fit Check on Gumroad             | Email, collected by Gumroad                                                     | Gumroad's checkout and its own opt-in wording (**UNVERIFIED**: check the free listing's checkout) | Gumroad                                  | MANUAL                                                       |
| Welcome sequence                      | Email (from Gumroad, or a mailing service)                                      | **Only people who opted in to updates.** Every email has an unsubscribe link                      | `content/emails/welcome-sequence.md`     | MANUAL; legal check (Spam Act 2003; others where targeted)   |
| Purchase                              | Email, product, sale id, refund status (from Gumroad)                           | Contract (to deliver what was bought)                                                             | `/privacy`                               | MANUAL                                                       |

**Professional verification still required** (not given here): whether the Australian Privacy Principles apply; cookie consent for EU/UK visitors; email-consent wording.

## 2. Access rules (built)

| Situation                                                                               | What she gets                                                                             |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Not signed in                                                                           | `/fit`, the calculator, pricing, privacy, terms                                           |
| Signed in, owns nothing                                                                 | FIT Finder top three, with one line on why each fits; the free Studio preview             |
| Owns the Income Fit Test, the Empire Bundle or The Whole Empire (verified with Gumroad) | The full FIT Finder report: calculator, country rules, dated 14-day plan, Day 14 verdicts |
| Purchase refunded                                                                       | Back to the free top three; saved answers kept; purchase record kept                      |
| Bought with a different email                                                           | "Look for purchases made with my email" or paste the licence key on `/account`            |
| Launch Pack (not configured)                                                            | Pages say "Not on sale yet"; no buy button                                                |

## 3. Acceptance tests

### Automated (this repo, run on every change)

| #   | Test                                                                                                                       | File                                                                     | Result 23 Oct 2026    |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------- |
| A1  | `/fit` public page → "Start the FIT Finder" → sign-in with `next` → back on `/studio/fit`, question 1 of 20                | `tests/e2e/phase1.spec.ts`                                               | Pass (desktop, phone) |
| A2  | A crafted `next` to another site falls back to the studio                                                                  | `tests/e2e/phase1.spec.ts`, `tests/unit/phase1.test.ts`                  | Pass                  |
| A3  | Footer links to both free tools on every page                                                                              | `tests/e2e/phase1.spec.ts`                                               | Pass                  |
| A4  | Launch Pack shows "Not on sale yet" with no buy link, when unconfigured                                                    | `tests/e2e/phase1.spec.ts`                                               | Pass                  |
| A5  | Without the Income Fit Test: top three, then an honest offer                                                               | `tests/e2e/fit.spec.ts`                                                  | Pass                  |
| A6  | With the Income Fit Test: full report, calculator, 14-day plan, saved across reload                                        | `tests/e2e/fit.spec.ts`                                                  | Pass                  |
| A7  | Gumroad pings: forged, borrowed licence keys, duplicate concurrent pings, refunds via recheck, cross-account claims        | `tests/unit/billing.test.ts`                                             | Pass                  |
| A8  | Bundles unlock their contents; library purchases never unlock the Launch Pack                                              | `tests/unit/billing.test.ts`, `tests/unit/plans.test.ts`                 | Pass                  |
| A9  | Gumroad id mapping suggestions, and no id under two products                                                               | `tests/unit/phase1.test.ts`                                              | Pass                  |
| A10 | Calculator: guardrails, CSV, nothing typed sent, axe                                                                       | `tests/unit/ads-calculator-view.test.ts`, `tests/e2e/calculator.spec.ts` | Pass                  |
| A11 | Accessibility (axe, serious and critical) on `/`, `/pricing`, `/sign-in`, `/privacy`, `/terms`, `/fit`, calculator, studio | `tests/e2e/*.spec.ts`                                                    | Pass                  |
| A12 | Launch copy and emails pass the claims guard, with the exact refund sentence wherever a price appears                      | `tests/unit/emails.test.ts`                                              | Pass                  |

### Manual, in production: the verified end-to-end sale

**BLOCKED until:**

- PR #68 and the `hle-ads` PR are merged;
- Vercel Pro is on;
- `studio.herlittleempire.com` is live;
- Gumroad is configured (GUMROAD_CONNECTION_CHECKLIST.md);
- the Income Fit Test corrections are applied.

Run with the founder, using a **second email address she controls**. Cost: one US$19 purchase, then refunded. Whether Gumroad keeps its fee on refunds is UNVERIFIED.

| #   | Step                                                                                          | Pass when                                                                                               |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T1  | On a phone, open herlittleempire.com (or the Instagram bio link)                              | The "Get the free Fit Check" button is visible and opens the Gumroad freebie                            |
| T2  | Get the Fit Check with the second email                                                       | Gumroad delivers the PDF; it says 20 questions and has the exact refund sentence                        |
| T3  | If the welcome sequence is loaded and she opted in                                            | Email 1 arrives with an unsubscribe link                                                                |
| T4  | Open `studio.herlittleempire.com/fit` → Start → sign in with the second email                 | Lands on the FIT Finder question 1; the top three shows after the quiz                                  |
| T5  | From the free result or `/fit`, click "See the Income Fit Test"                               | The Gumroad listing shows US$19 and the exact refund sentence                                           |
| T6  | Buy with a real card and the second email                                                     | Payment succeeds; the Gumroad receipt arrives with working downloads (corrected v1.4 files)             |
| T7  | Within a few minutes, check `/admin` (founder) and the Supabase table `purchases` (read-only) | Exactly one purchase, status `paid`, product `library:income-fit-test`; `purchase_verified` counted     |
| T8  | Back in Studio (same browser), reload the FIT Finder result                                   | The **full** report shows: calculator, country rules, dated 14-day plan                                 |
| T9  | Sign out; sign in again on another device                                                     | The library still shows the Income Fit Test; the full report still opens                                |
| T10 | Refund the sale in Gumroad                                                                    | Gumroad confirms the refund                                                                             |
| T11 | After the refund notice, or the next daily recheck (09:17 UTC)                                | Status `refunded`; the report shows the free top three; saved answers kept; `purchase_refunded` counted |
| T12 | Record everything with times and screenshots (no card details)                                | A dated log in `docs/phase-1/` (founder approval to commit it)                                          |

**Any failure stops the run.** Fix it, re-run the automated suite, then repeat from the failed step. Never retry with real money until it's fixed.

## 4. After the first real sale

- Confirm the buyer received the files (Gumroad shows delivery).
- Check `/admin` the next day: `purchase_verified` and no errors in the Vercel logs.
- Don't contact the buyer except through Gumroad's receipt or the opted-in sequence.
