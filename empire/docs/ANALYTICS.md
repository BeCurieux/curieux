# Analytics

First-party events in `analytics_events` (Postgres). No advertising
platforms, no third-party scripts. Properties are allow-listed in
`src/lib/analytics/track.ts` (module, source, plan, section, status, format,
reason, product type) — never brand names, product details or anything a
customer typed. Anonymous visitors get a random id only after accepting the
cookie banner; declining still counts events without linking them. Campaign
names (`utm_source` or `ref`, `utm_medium`, `utm_campaign`) are sent with the
page view itself; only the source is remembered in a cookie (for a later
sign-up), and only after consent. Purchases come from Gumroad without
campaign data, so they can't be attributed to a campaign.

| Brief metric                         | Event / source                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Landing page views                   | `landing_viewed`                                                                       |
| Free previews started                | `preview_started` (Start free)                                                         |
| Signup conversions                   | `signup_completed`                                                                     |
| Business profiles completed          | `profile_completed`                                                                    |
| Generation requests / successes      | `generation_requested`, `generation_succeeded`, `generation_failed`                    |
| Assets copied / downloaded           | `asset_copied`, `asset_downloaded`, `pack_exported`                                    |
| Paid checkout starts                 | `checkout_started`                                                                     |
| Verified purchases / refunds         | `purchase_verified`, `purchase_refunded`                                               |
| 7- and 30-day repeat usage           | computed from events (`src/lib/analytics/metrics.ts`)                                  |
| Free calculator views                | `calculator_viewed` (`/ads/tools/calculator`)                                          |
| Next-step clicks from free tools     | `offer_clicked` (`source`: calculator; `path`: fit-check, fit-finder, income-fit-test) |
| Fit Check page views                 | `fit_check_viewed` (`/fit-check`)                                                      |
| Offer page views                     | `offer_viewed` (`/income-fit-test`)                                                    |
| Explicit email consent               | `email_consent_given` (server-side, after a successful opt-in; campaign names only)    |
| Unsubscribes                         | `email_unsubscribed`                                                                   |
| Funnel by source                     | `/admin` → "Marketing funnel by source" (`funnelBySource`)                             |
| Acquisition source                   | `utm_source` / `ref` → `signup_completed.source`                                       |
| Average generation cost per customer | `usage_ledger.estimated_cost`                                                          |

`/admin` (emails in `ADMIN_EMAILS`) shows the funnel, use-versus-generation
ratio (copies + downloads per successful generation), repeat usage, cost and
signup sources.
