# Customer journey: landing to verified access

**One path for launch**, built only from what exists: herlittleempire.com → a free tool → permission-based email → the Income Fit Test on Gumroad → checkout → delivery → verified access in Empire Studio. Status as of 23 Oct 2026; ✅ built and tested, 🟡 needs founder setup, ⬜ not built.

```
herlittleempire.com ──► Free tool ─────────────► Email (opt-in) ──► Paid offer ──► Gumroad checkout
  (brand entry)          │ Ads Calculator           Gumroad free        Income Fit     │
                         │ /ads/tools/calculator    Fit Check           Test US$19     ▼
                         └ FIT Finder free tier     → welcome 1–5                    Gumroad delivers PDFs
                           /studio/fit (sign-in)                                     + ping → /api/billing/gumroad
                                                                                         ▼
                                                                  Sign in with the same email → full FIT report
```

## Step by step

| #   | Step                   | Where                                                       | What the customer sees                                                                                             | Consent and data                                                                        | Event                                      | Status                                         |
| --- | ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| 1   | Arrive                 | herlittleempire.com                                         | The brand promise; two free tools; the Income Fit Test                                                             | The website's own (UNVERIFIED)                                                          | Website's own; add `?ref=website` to links | 🟡 links to add (PLATFORM_INTEGRATION_PLAN §1) |
| 2a  | Free tool: calculator  | `studio.herlittleempire.com/ads/tools/calculator`           | Break-even cost per sale, break-even ROAS, a real period vs break-even, plain-English readings, limits, CSV, print | **Nothing typed leaves the browser** (e2e-tested); cookie banner for analytics          | `calculator_viewed`                        | ✅                                             |
| 2b  | Free tool: FIT Finder  | `/studio/fit` (sign-in by emailed link)                     | 20 questions → top three ideas with one line each                                                                  | Account email (for sign-in only, not marketing)                                         | `signup_completed`, `fit_completed`        | ✅                                             |
| 3   | Email, with permission | Gumroad free product: 5-Question Fit Check (`/l/fit-check`) | Gumroad's checkout for a free product, then the download                                                           | Gumroad records the email and its own opt-in (exact wording UNKNOWN: check the listing) | `offer_clicked` path `fit-check`           | 🟡 listing exists; confirm opt-in              |
| 4   | Welcome sequence       | Gumroad emails to customers, or the chosen email service    | Five emails over 10 days (`content/emails/welcome-sequence.md`), guard-tested                                      | Only to people who opted in; unsubscribe on every email                                 | The service's own                          | 🟡 copy ready; load it                         |
| 5   | Paid offer             | Gumroad `/l/income-fit-test`                                | Listing with what's in it, who it isn't for, US$19, the exact refund sentence                                      | —                                                                                       | `offer_clicked` path `income-fit-test`     | 🟡 corrections to apply                        |
| 6   | Checkout               | Gumroad                                                     | Gumroad's checkout                                                                                                 | Gumroad handles card details; we never see them                                         | —                                          | ✅ (Gumroad)                                   |
| 7   | Delivery               | Gumroad receipt and library                                 | The kit's files                                                                                                    | —                                                                                       | —                                          | ✅ (Gumroad)                                   |
| 8   | Purchase recorded      | Gumroad ping → `/api/billing/gumroad?token=…`               | Nothing yet                                                                                                        | Sale looked up with Gumroad before it counts; idempotent on sale id                     | `purchase_verified`                        | 🟡 ping, token, product ids                    |
| 9   | Verified access        | Sign in with the same email → `/studio/fit`                 | The full Income Fit Report: calculator, country rules, dated 14-day plan, Day 14 verdicts, saved                   | Purchases matched by email at sign-in, or "Look for purchases made with my email"       | —                                          | ✅ code, 🟡 needs step 8                       |
| 10  | Refund                 | Gumroad refund                                              | Gumroad refunds; the full report locks after the next recheck; their saved answers stay                            | Recheck daily (`/api/billing/recheck`, `CRON_SECRET`)                                   | `purchase_refunded`                        | 🟡 cron secret                                 |

## Where it loses people today, and the fix

| Friction                                                                         | Fix                                                                                                        | When |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| The website doesn't link to the free tools (assumed; site not visible here)      | Two links on the homepage and in the footer (PLATFORM_INTEGRATION_PLAN §1)                                 | P0   |
| A Gumroad buyer doesn't know the interactive report exists                       | One line on the Income Fit Test listing and in its receipt: "Sign in to Empire Studio with the same email" | P0   |
| After sign-in, the FIT Finder link lands on `/studio`, not back on `/studio/fit` | Return to the page you came from after sign-in (small auth change, needs a test)                           | P1   |
| No email capture inside the calculator                                           | Use the Gumroad Fit Check at launch; an in-app opt-in only when an email service is chosen                 | P1   |
| Studio's home page (`/`) talks only about Shopify                                | Link the free tools from `/`; keep the Shopify pitch for the Launch Pack                                   | P1   |

## What "one verified end-to-end sale" means

1. A real buyer, or a test buyer using a second email address, finds the Income Fit Test from the website or the calculator.
2. They buy it on Gumroad and receive the files.
3. The ping is received and the sale is looked up with Gumroad and recorded once: `purchases` row with status `paid`, plus an entitlement `library:income-fit-test`.
4. Signing in with the same email unlocks the full FIT Finder report.
5. `/admin` shows `purchase_verified`.
6. For the test buyer: a refund in Gumroad locks the report after the recheck, and `purchase_refunded` appears.

The step-by-step procedure is in [PLATFORM_INTEGRATION_PLAN.md §3](PLATFORM_INTEGRATION_PLAN.md#3-genuine-test-purchase-and-refund).
