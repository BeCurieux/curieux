# Funnel measurement

What Her Little Empire can measure reliably, where each number comes from, and what it **can't** measure. **No follower, reach or Meta campaign data exists in this project, and none is invented here.**

Labels:

- **BUILT**: in the code, tested on the local backend.
- **BLOCKED**: needs a decision, an account or the live website.
- **MANUAL**: read from Instagram or Gumroad by a person.

## 1. The funnel, step by step

| Step                              | Metric                                                                                          | Source                                                                                                       | Status                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Seen on Instagram (non-followers) | Reach, non-follower reach, plays                                                                | Instagram Insights                                                                                           | MANUAL                                               |
| Engaged                           | Shares, saves, comments, average watch time                                                     | Instagram Insights                                                                                           | MANUAL                                               |
| Profile visit → follow            | Profile visits, follows                                                                         | Instagram Insights                                                                                           | MANUAL                                               |
| Link tap                          | Link-in-bio taps                                                                                | Instagram Insights (where shown; UNVERIFIED for this account); our landing views with `utm_source=instagram` | MANUAL + BUILT                                       |
| Landing                           | `fit_check_viewed`, `fit_landing_viewed`, `calculator_viewed`, `offer_viewed`, `landing_viewed` | Empire Studio events, `/admin` → Marketing funnel by source                                                  | BUILT                                                |
| Start                             | `offer_clicked` with `path=fit-finder` (start FIT Finder) or `fit-check` (to Gumroad)           | Studio events                                                                                                | BUILT                                                |
| Completion                        | `fit_completed` (FIT Finder finished)                                                           | Studio events                                                                                                | BUILT                                                |
| Explicit email consent            | `email_consent_given`; `email_signups` rows with the exact wording and version                  | Studio (server-side, after a successful opt-in)                                                              | BUILT; **opt-in switched off** until a sender exists |
| Fit Check download (free)         | Gumroad free "sales" of the Fit Check                                                           | Gumroad dashboard                                                                                            | MANUAL                                               |
| Checkout started                  | Gumroad product views or checkouts                                                              | Gumroad analytics (UNVERIFIED which figures it shows)                                                        | MANUAL                                               |
| Verified purchase                 | `purchase_verified` (sale looked up with Gumroad)                                               | Studio, once Gumroad is connected                                                                            | BUILT; BLOCKED on Gumroad setup                      |
| Refund                            | `purchase_refunded`                                                                             | Studio (notice or daily recheck)                                                                             | BUILT; BLOCKED on Gumroad setup                      |
| Unsubscribe                       | `email_unsubscribed`                                                                            | Studio                                                                                                       | BUILT                                                |
| Contribution profit               | Contribution per sale minus ad spend                                                            | The Ads Profitability Calculator, with Gumroad's real figures                                                | BUILT (tool); MANUAL (inputs)                        |

## 2. Campaign tags (UTM convention)

Every link we control carries tags, so `/admin` can group by source:

| Placement             | Tags                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| Instagram bio link    | `?utm_source=instagram&utm_medium=bio&utm_campaign=evergreen`                        |
| Reel or carousel CTA  | `?utm_source=instagram&utm_medium=post&utm_campaign=<franchise>-<yyyymmdd>`          |
| Meta ad (if approved) | `?utm_source=meta&utm_medium=paid&utm_campaign=<brief-id>&utm_content=<creative-id>` |
| Website button        | `?ref=website`                                                                       |
| Email                 | `?utm_source=email&utm_medium=welcome&utm_campaign=email-<n>`                        |

**Recorded:**

- `utm_source` (or `ref`), `utm_medium` and `utm_campaign` travel with page-view events. Each is capped at 40 characters, and only letters, numbers and `._-:/` are kept.
- The opt-in stores source, medium and campaign with the consent record.
- `utm_content` isn't stored yet; it's a small change if ad creatives need comparing.
- Only the source is remembered in a cookie, after analytics consent, to credit a later sign-up.

## 3. Attribution limitations (read before trusting any number)

1. **Gumroad purchases arrive without campaign data.**
   - Someone who clicks an Instagram link, then buys on Gumroad, shows in `/admin` as a purchase under "(none recorded)".
   - Gumroad's own analytics shows referrers (UNVERIFIED which).
   - Whether Gumroad passes URL tags through to the sale (e.g. a `url_params` field on the ping) is **UNVERIFIED**; check before relying on it.
2. **Instagram and Meta numbers stay in Instagram and Meta.** Nothing in Studio reads them: no API connection, by design.
3. **Without analytics consent, visits aren't linked to each other,** so one person's visits can't be joined into a path. Counts are still right; paths aren't.
4. **In-app browsers** (Instagram's) may drop tags or open links differently: UNVERIFIED. Check by tapping our own bio link.
5. **Small numbers.** Under 5 sales (the house rule), there isn't enough evidence to judge a campaign either way. Treat it as "not enough evidence yet".
6. **Followers aren't the goal metric.** 100,000 is an ambition, not a forecast. The weekly report tracks the steps that lead to sales.

## 4. Advertising cookies and audience tracking: BLOCKED (by design until verified)

There's **no Meta pixel, Conversions API or Google tag**. The privacy page says so. Before any is added:

| Requirement                                                                                                                       | Why                                                                                  | Status                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| Know the live website's platform and what it already loads                                                                        | A pixel on Studio alone would miss the website, and the site may already have tags   | BLOCKED (website unavailable) |
| A separate, unticked **advertising** consent choice in the banner (today it's analytics only)                                     | Advertising cookies need their own opt-in in many places (verify for target markets) | Not built; design in §5       |
| Verify Meta's current rules for this business category (income-related offers have extra ad policies)                             | Ads could be rejected or the account restricted                                      | UNVERIFIED                    |
| Decide which events to send (e.g. `Lead` on consent, `Purchase` on a verified sale only) and test them in Meta's test-events tool | Wrong events mislead optimisation                                                    | BLOCKED                       |
| Update the privacy notice with the exact data shared                                                                              | Transparency                                                                         | After the decision            |
| Professional privacy check                                                                                                        | Compliance                                                                           | Founder                       |

## 5. Consent design for later (not built)

- **Banner:** two independent choices, "Analytics (our own)" and "Advertising (Meta)", both off until chosen. "No thanks" is as prominent as "Accept".
- **Loading:** advertising scripts load **only** after the advertising choice is "yes". The choice is stored for 12 months, and changeable from a "Cookie choices" footer link.
- **Server-side events** (Conversions API) are sent only for people who said yes, and only `Lead` and verified `Purchase`, with hashed email only if the privacy review allows.
- **Tests:** no Meta request before consent; no Meta request after "No"; events after "Yes"; the choice can be withdrawn.

## 6. The dashboard (`/admin`, founder only)

**BUILT:**

- "Marketing funnel by source (last 90 days)": a table of the funnel events above, by source;
- email sign-ups, active and unsubscribed;
- the existing figures: signups by source, paying customers, refunds.

Not shown, on purpose: followers, reach, ad spend, ROAS. Those come from Instagram and Ads Manager and go into the weekly report by hand.

## 7. Contribution profitability

For any paid test, use the calculator (`/ads/tools/calculator`) with real figures. Hypothetical example, Income Fit Test: US$19 with Gumroad's fee 10% + US$0.50 (FACT, Oct 2026) keeps US$16.60 before card processing (UNKNOWN) and refunds. Then:

- **Break-even cost per sale:** about US$16.60.
- **Break-even ROAS:** about 1.14.

A lead (opt-in) has no proven value until the nurture flow has sold enough to measure. Until then a cost per opt-in can't be judged against profit, only against a test budget the founder sets.
