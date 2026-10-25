# Advertising test plan: Income Fit Test (US$19) and Fit Check

**Not active. No campaign has been created and no money has been spent.** The founder's written approval is needed before anything goes live.

**Maximum initial budget: A$15 a day.** Seven days at most, so **A$105 at most**. Labels: FACT (checked, with date), EST (estimate), UNVERIFIED.

## 1. Preconditions (all must be true before day 1)

| #   | Precondition                                                                                            | Why                                                                   | Status (25 Oct 2026)             |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| P1  | Studio is live on `studio.herlittleempire.com`, with `/income-fit-test` and `/fit-check` loading        | Ads need working landing pages                                        | Blocked (merge, Vercel Pro, DNS) |
| P2  | Gumroad is connected, and one verified test purchase and refund has passed                              | Without it, sales can't be counted. Missing tracking isn't zero sales | Blocked                          |
| P3  | The Income Fit Test files and listing carry the corrections (20 questions, v1.4, exact refund sentence) | Ads send people to the listing                                        | Founder                          |
| P4  | Meta's current ad policies checked for income-related offers                                            | Avoid rejection or account restrictions                               | UNVERIFIED                       |
| P5  | Founder approves the budget, the dates and the creatives                                                | No spend without approval                                             | Pending                          |

## 2. Break-even (calculator engine, hypothetical)

US$19 sale, Gumroad 10% + US$0.50 per direct sale (FACT, Oct 2026). Card processing isn't included (UNKNOWN).

| Refund rate | Kept per sale (US$) | Break-even ROAS | In A$ at US$1 = A$1.45 / 1.55 / 1.65 (EST rates) |
| ----------- | ------------------- | --------------- | ------------------------------------------------ |
| 0%          | 16.60               | 1.14            | 24.07 / 25.73 / 27.39                            |
| 5%          | 15.65               | 1.21            | 22.69 / 24.26 / 25.82                            |
| 10%         | 14.70               | 1.29            | about 21.3 / 22.8 / 24.3                         |

**Planning figure:** a break-even cost per sale of about **A$24**, using 5% refunds at A$1.55, an EST rate. Replace it with your payout's real rate.

- At A$15 a day, the daily spend breaks even with **1 sale a day**.
- The full A$105 breaks even with **5 sales** (A$105 ÷ A$24 = 4.4, rounded up).
- **Fewer than 5 sales is "not enough evidence yet"** (the house rule). A week can't prove the ads work unless sales clearly beat break-even.

**The Fit Check (free)** has no break-even yet: a download's value is unknown until downloads turn into sales. Its spend is judged against the founder's test budget only.

## 3. Test design

| Ad set    | Audience                                                                                                                                                                         | Creative (from SOCIAL_ASSETS.md)                   | Destination (tagged)                                                                                          | Daily budget |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| A         | **Warm:** people who engaged with @herlittleempire.co on Instagram (Meta builds this from on-platform activity; no pixel needed). Minimum audience size for delivery: UNVERIFIED | Asset 5 "What US$19 gets you" and Asset 3 "Day 14" | `https://studio.herlittleempire.com/income-fit-test?utm_source=meta&utm_medium=paid&utm_campaign=sales7-ad-a` | A$10         |
| B         | Same warm audience                                                                                                                                                               | Asset 1 "Ten minutes. Five questions."             | `https://studio.herlittleempire.com/fit-check?utm_source=meta&utm_medium=paid&utm_campaign=sales7-ad-b`       | A$5          |
| **Total** |                                                                                                                                                                                  |                                                    |                                                                                                               | **A$15/day** |

**Rules:**

- No new audiences in week 1. The brief is to convert the existing audience.
- No lookalikes or interest targeting, and no pixel-based retargeting: there's no pixel, and adding one needs advertising consent first.

## 4. Stop conditions (any one stops the test)

| #   | Condition                                                                             | Action                                                                           |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| S1  | Spend reaches **A$15 in a day** or **A$105 in total**, or 7 days pass                 | Stop (hard caps: set the campaign end date and a lifetime budget in Ads Manager) |
| S2  | Ad set A has spent **A$48 (2× break-even) with no verified sale**                     | Stop ad set A                                                                    |
| S3  | At the end, cost per verified sale is **above A$24**                                  | Don't continue; record as unprofitable at this price                             |
| S4  | Our landing views are **under half** of Ads Manager's link clicks for 2 days in a row | Pause; fix tracking or the landing page before spending more                     |
| S5  | An ad is rejected, or the account gets a policy warning                               | Stop all; review the copy against policy                                         |
| S6  | Refunds reach **20%** of verified sales from the test                                 | Stop; review what the ad promised against the product                            |
| S7  | Gumroad stops reporting (no `purchase_verified` while Gumroad shows sales)            | Pause; fix the integration first                                                 |

**Scaling** (any increase above A$15 a day) isn't part of this plan, and needs both:

- **5 or more verified sales** at a cost per sale **below A$24**;
- a new founder approval.

## 5. Measurement

**Daily:**

- **Ads Manager:** spend, impressions, link clicks.
- **`/admin` seven-day view:** Income Fit Test page views, checkout starts (clicks to Gumroad) and verified purchases (once Gumroad is connected); Fit Check clicks.
- **Gumroad:** sales and refunds, as a cross-check.

**Recording:** each day goes into `docs/marketing/WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md` §4.

**Attribution limits:**

- Gumroad purchases arrive without campaign data. The test's sales are inferred from timing and Gumroad's referrers, so treat them as estimates.
- Ads Manager's own conversion figures are unavailable: there's no pixel.
