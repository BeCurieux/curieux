# Funnel report and seven-day sales dashboard

## 1. The numbers today (FACT, read-only query of the Supabase project, 25 Oct 2026)

Every event in the database came from the founder's own testing on the preview on 23 Oct 2026. No public traffic has reached Studio: it isn't public yet.

| Funnel step                            | Value               | What the value means                                                                                                             |
| -------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Website visitors (herlittleempire.com) | **Not tracked**     | The website's analytics aren't connected to Studio, and the site couldn't be reached from here. **Unknown, not zero**            |
| Studio visitors (page views)           | 5                   | 4 landing and 1 pricing view, **all founder testing**                                                                            |
| Fit Check users                        | **Not tracked yet** | The `/fit-check` page and its events aren't deployed (branch unpushed). Gumroad's free-download count is in Gumroad (UNVERIFIED) |
| Income Fit Test page views             | **Not tracked yet** | `/income-fit-test` isn't deployed                                                                                                |
| Checkout starts                        | **Not tracked yet** | The buy-button click events aren't deployed; Gumroad's own checkout steps aren't visible to Studio                               |
| Verified purchases                     | **Not tracked**     | Gumroad isn't connected. **This is not zero sales:** any sales are on Gumroad and visible only in Gumroad's dashboard            |
| Refunds                                | **Not tracked**     | Same                                                                                                                             |
| Purchases in Studio's database         | 0                   | A real zero for Studio's table, but **only because nothing can arrive yet**                                                      |

**Rule:**

- **Not tracked:** the measurement doesn't exist yet.
- **Not tracked yet:** built, not deployed.
- **0:** measured, and nothing happened.

Only the last is a real zero.

## 2. The seven-day sales dashboard (built, `/admin`)

`/admin` (founder only) now opens with **"Last seven days: Income Fit Test and Fit Check"**: one column per day, a 7-day total, and a **status for every row**.

| Row                                      | Source                                                                                                            | Status logic                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| herlittleempire.com visitors             | —                                                                                                                 | Always **Not tracked** (website analytics not connected)                                                          |
| Page views on Studio's public pages      | `landing_viewed`, `pricing_viewed`, `fit_landing_viewed`, `fit_check_viewed`, `calculator_viewed`, `offer_viewed` | Tracked                                                                                                           |
| Unique visitors (who accepted analytics) | Distinct anonymous ids                                                                                            | **Partly tracked** (undercounts: only consenting visitors)                                                        |
| Fit Check: clicks to get it              | `offer_clicked` path `fit-check` or `fit-check-pdf`                                                               | **Partly tracked** (Gumroad's completed downloads are in Gumroad)                                                 |
| FIT Finder completed                     | `fit_completed`                                                                                                   | Tracked                                                                                                           |
| Email follow-up: consents                | `email_consent_given`                                                                                             | **Not tracked** while the opt-in is off                                                                           |
| Income Fit Test page views               | `offer_viewed` path `income-fit-test`                                                                             | Tracked                                                                                                           |
| Checkout starts (clicks to Gumroad)      | `offer_clicked` path `income-fit-test`                                                                            | **Partly tracked** (clicks, not Gumroad's checkout steps)                                                         |
| Verified purchases                       | `purchase_verified`                                                                                               | **Not tracked** until Gumroad's token, ping secret and the Income Fit Test's product id are all set; then Tracked |
| Refunds                                  | `purchase_refunded`                                                                                               | Same                                                                                                              |

**Untracked rows show "–" in every cell, never 0,** with a note saying why. For sales: "This is not the same as zero sales: check Gumroad's own dashboard."

**Tests:**

- unit (`tests/unit/marketing.test.ts`): counts, day windows, unique visitors, and untracked rows never showing a number;
- browser (`tests/e2e/marketing.spec.ts`): the founder's view shows "Not tracked" for verified purchases on a set-up without Gumroad.

## 3. Reading it during the seven-day campaign

Each day, record from three places:

1. **`/admin`:** the seven-day table.
2. **Gumroad:** Income Fit Test sales and refunds, and Fit Check free downloads.
3. **Instagram Insights:** reach, shares, saves, profile visits, link taps.

Copy these into the weekly report (`docs/marketing/WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md`). Write "Not tracked" where the dashboard says so.

**Conversion rates to watch:**

- Income Fit Test page views → checkout starts;
- checkout starts → verified purchases (once tracked);
- Fit Check clicks → Income Fit Test page views.

Under 5 sales, the house rule applies: not enough evidence yet, either way.
