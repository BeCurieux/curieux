# Seven-day sales campaign: Income Fit Test and Fit Check

**Goal:** turn the existing audience into paying customers. The free Fit Check is the entry; the Income Fit Test (US$19) is the offer.

**Status:** ready to schedule, **not started**. It starts only after:

- the pages are live on `studio.herlittleempire.com`;
- Gumroad is connected (so sales can be counted);
- the founder approves.

Paid ads are a separate, optional plan: AD_TEST_PLAN.md (A$15/day maximum, not active).

## 1. Landing pages (one per product)

| Product                     | Page                    | What it does                                                                                                                                    | Built and tested                  |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 5-Question Fit Check (free) | `/fit-check`            | How it works, red flags, a **no-sign-up** download (direct PDF once supplied; otherwise the free Gumroad listing), the optional email follow-up | Yes (e2e, desktop and phone, axe) |
| Income Fit Test (US$19)     | `/income-fit-test`      | Real screenshots, a full sample report, contents, method, limits, FAQs, refund sentence, buy button (Gumroad, same tab)                         | Yes                               |
| FIT Finder (free)           | `/fit`                  | Free top three, then the Income Fit Test                                                                                                        | Yes                               |
| Ads calculator (free)       | `/ads/tools/calculator` | For asset 4                                                                                                                                     | Yes                               |

**URLs:**

- All four work on the local build and are tested.
- They work at `https://studio.herlittleempire.com/...` **after** the merges and the domain are approved. Until then, no public URL serves them. Branch `hle-ads` isn't pushed.
- The Gumroad listings (`herlittleempireco.gumroad.com/l/income-fit-test`, `/l/fit-check`) are founder-supplied and UNVERIFIED live.

## 2. Tagged links

`utm_campaign` carries the day, because that's the tag Studio stores and shows in `/admin`.

| Use                                | Link                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Instagram bio (all week)           | `https://studio.herlittleempire.com/fit-check?utm_source=instagram&utm_medium=bio&utm_campaign=sales7`                 |
| Day 1 story link sticker           | `https://studio.herlittleempire.com/fit-check?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d1`            |
| Day 2 story link sticker           | `https://studio.herlittleempire.com/fit?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d2`                  |
| Day 3 story link sticker           | `https://studio.herlittleempire.com/income-fit-test?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d3`      |
| Day 4 story link sticker           | `https://studio.herlittleempire.com/ads/tools/calculator?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d4` |
| Day 5 story link sticker           | `https://studio.herlittleempire.com/income-fit-test?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d5`      |
| Day 6 story link sticker           | `https://studio.herlittleempire.com/fit-check?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d6`            |
| Day 7 story link sticker           | `https://studio.herlittleempire.com/income-fit-test?utm_source=instagram&utm_medium=story&utm_campaign=sales7-d7`      |
| Email follow-up (when switched on) | `…?utm_source=email&utm_medium=welcome&utm_campaign=sales7-email<n>`                                                   |
| Website buttons                    | `…?ref=website`                                                                                                        |

## 3. Day by day

| Day | Post (feed)                                                              | Story (with link sticker)                                    | Primary CTA     | Measured by (in `/admin`)                           |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------- | --------------------------------------------------- |
| 1   | Asset 1: "Ten minutes. Five questions."                                  | "Free, ten minutes, no sign-up" → d1 link                    | Fit Check       | `fit_check_viewed`; Fit Check clicks (`sales7-d1`)  |
| 2   | Asset 2: "Which side income fits your real week?"                        | "Twenty questions, free top three" → d2 link                 | FIT Finder      | `fit_landing_viewed`; `fit_completed`               |
| 3   | Asset 5: "What US$19 gets you"                                           | "What's inside, and what it won't do" → d3 link              | Income Fit Test | `offer_viewed`; checkout starts; verified purchases |
| 4   | Asset 4: "A ROAS above 1 can still be a loss"                            | Poll: "Have you ever boosted a post?" then → d4 link         | Calculator      | `calculator_viewed`                                 |
| 5   | Asset 3: "Day 14: not enough evidence"                                   | "Decide on evidence" → d5 link                               | Income Fit Test | `offer_viewed`; checkout starts; verified purchases |
| 6   | Reshare Asset 1 to Stories, no new feed post                             | "The free Fit Check, in case you missed it" → d6 link        | Fit Check       | Fit Check clicks (`sales7-d6`)                      |
| 7   | Carousel from the calendar (Day 29 or the US$19 maths), founder's choice | "Questions about the Income Fit Test? Reply here." + d7 link | Income Fit Test | `offer_viewed`; replies (Instagram)                 |

The post copy is in SOCIAL_ASSETS.md. The Income Fit Test is offered on days 3, 5 and 7, and every mention of the price carries "Full refund within 14 days of purchase, no questions asked."

## 4. Measurable conversion events

| Step              | Event                                                                                                         | Status                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Landing           | `fit_check_viewed`, `fit_landing_viewed`, `offer_viewed`, `calculator_viewed` (with source, medium, campaign) | Built                                                       |
| Fit Check taken   | `offer_clicked` path `fit-check` or `fit-check-pdf`                                                           | Built (a click; completed Gumroad downloads are in Gumroad) |
| Email follow-up   | `email_consent_given`                                                                                         | Built; **switched off** until a sender exists               |
| Checkout start    | `offer_clicked` path `income-fit-test`                                                                        | Built (a click to Gumroad; Gumroad's own steps not visible) |
| Verified purchase | `purchase_verified`                                                                                           | Built; **not tracked until Gumroad is connected**           |
| Refund            | `purchase_refunded`                                                                                           | Built; **not tracked until Gumroad is connected**           |

## 5. After the week

Fill in `docs/marketing/WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md` from `/admin`'s seven-day view, Instagram Insights and Gumroad. Rows marked "Not tracked" are recorded as not tracked, never as zero.
