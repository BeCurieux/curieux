# Marketing implementation plan: Instagram growth and Meta ads

**24 October 2026.**

- **The goal:** an ethical, profitable digital-product business, with growth toward 100,000 genuine Instagram followers. **100,000 is an ambition, not a forecast.** Nothing here predicts followers, reach or sales.
- **Built** means it's in the code, tested on the local backend, merged into `main` on 25 Oct 2026, **not yet public** on the custom domain.
- **Blocked** means the source or integration isn't available, or it needs a founder decision. Blocked items aren't counted as done.

**Documents:**

- [CONTENT_SYSTEM.md](CONTENT_SYSTEM.md): the five franchises and production rules.
- [30_DAY_CONTENT_CALENDAR.md](30_DAY_CONTENT_CALENDAR.md): 30 Reels and 13 carousels.
- [AD_CREATIVE_BRIEFS.md](AD_CREATIVE_BRIEFS.md): three Meta briefs.
- [FUNNEL_MEASUREMENT.md](FUNNEL_MEASUREMENT.md): what's measured, where, and the limits.
- [WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md](WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md).

## 1. Status of each requested item

| #   | Request                                                               | Status                                            | What exists / what blocks it                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Public Fit Check page with permission-based opt-in                    | **Built** (opt-in switched off)                   | `/fit-check`: how it works, the six red flags, the Gumroad download. Optional opt-in: unticked box, exact consent wording, versioned and stored with time and campaign names; a field bots fill in; one-click unsubscribe at `/unsubscribe`. **Opt-in stays off** (`EMPIRE_EMAIL_OPTIN=off`) **until a sender for the emails is chosen**, so nobody signs up for emails that can't be sent |
| 2   | Conversion tracking                                                   | **Built (first-party)**; Meta **blocked**         | Campaign tags (source, medium, campaign) on page views and on consent records; events for landing views, starts (`offer_clicked`), completions (`fit_completed`), `email_consent_given`, `purchase_verified`, `purchase_refunded`, `email_unsubscribed`. Limits in FUNNEL_MEASUREMENT §3: Gumroad purchases carry no campaign data                                                         |
| 3   | Testable 5-email nurture flow                                         | **Copy built and tested; sending blocked**        | `content/emails/welcome-sequence.md`: guard-tested, refund sentence checked, kept in sync with `docs/phase-1/LAUNCH_COPY.md`. Sending needs Gumroad's emails (if they can sequence; UNVERIFIED) or a mailing service (founder choice)                                                                                                                                                      |
| 4   | Offer page with real screenshots, contents, method, FAQs, limitations | **Built**                                         | `/income-fit-test`: four real screenshots of the interactive report (a test account named Sam, so no real customer's data), contents, how it decides, what it won't do, FAQs, exact refund sentence, seller identity. PDF-kit screenshots: unavailable (files not in the repo)                                                                                                             |
| 5   | Consent before optional advertising cookies; clear privacy policy     | **Privacy updated; ad consent blocked by design** | There are no advertising cookies, and the privacy page now says so (no Meta pixel, no Google Analytics, no audience building) and covers email sign-ups. A separate advertising-consent choice is designed (FUNNEL_MEASUREMENT §5) but **not built**, because no ad tracking is approved or verified                                                                                       |
| 6   | Internal marketing dashboard                                          | **Built**                                         | `/admin` → "Marketing funnel by source (last 90 days)" and email sign-ups (active, unsubscribed). No follower or Meta data, and it says why                                                                                                                                                                                                                                                |
| 7   | Content system with five franchises                                   | **Done (documents)**                              | CONTENT_SYSTEM.md                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | 30-day calendar, 7 Reels + 3 carousels a week                         | **Done (documents)**                              | 30 Reels and 13 carousels, each with an original script or slides, a faceless shot list, a caption and alt text. Every file in `docs/marketing/` is checked by the claims guard in a test                                                                                                                                                                                                  |
| 9   | Three Meta ad briefs                                                  | **Done (drafts); launch blocked**                 | AD_CREATIVE_BRIEFS.md. No campaign without founder budget approval; Meta policy check UNVERIFIED                                                                                                                                                                                                                                                                                           |
| 10  | Weekly experiment report template                                     | **Done**                                          | WEEKLY_EXPERIMENT_REPORT_TEMPLATE.md                                                                                                                                                                                                                                                                                                                                                       |

**Checks run on `hle-ads`:**

- lint, types and format: pass;
- **152 unit tests**: pass;
- production build: pass;
- **60 Playwright tests** (desktop and phone, axe): pass;
- RLS suite with the new `email_signups` table: pass.

## 2. Prioritised list of required changes

**P0 blocks any measured launch. P1 enables the nurture flow and paid tests. P2 is optional and later.** 🔒 = founder approval.

| Priority | Change                                                                                                                                                                  | Owner              | Depends on                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| P0       | ✅ Done 25 Oct 2026: PR #68 and the `hle-ads` PR (#69) merged (`/fit-check`, `/income-fit-test`, the dashboard and the opt-in, off)                                     | Founder → Build    | —                                                                 |
| P0       | ✅ Done 25 Oct 2026: migration `20261024000005_email_signups` applied to the Supabase project (RLS on, no policies, table empty)                                        | Founder → Build    | Merge                                                             |
| P0       | 🔒 Vercel Pro; `studio.herlittleempire.com` live (docs/phase-1/PHASE_1_STATUS.md)                                                                                       | Founder            | —                                                                 |
| P0       | Instagram bio link → `studio.herlittleempire.com/fit-check?utm_source=instagram&utm_medium=bio&utm_campaign=evergreen`                                                  | Founder            | Domain live                                                       |
| P0       | 🔒 Gumroad connected and one verified test sale (docs/phase-1/GUMROAD_CONNECTION_CHECKLIST.md)                                                                          | Founder + Build    | Domain live                                                       |
| P1       | ✅ Done 26 Oct 2026: email sender chosen (Resend)                                                                                                                       | Founder            | —                                                                 |
| P1       | Built 26 Oct 2026 (`src/lib/email/`). Left: 🔒 migration `20261026000006`, Resend setup, then 🔒 `EMPIRE_EMAIL_OPTIN=on` (docs/launch/WELCOME_EMAILS_SETUP.md)          | Build              | Sender chosen                                                     |
| P1       | Privacy and consent wording professionally reviewed (email consent: Spam Act 2003 in Australia; others where targeted)                                                  | Founder → Reviewer | —                                                                 |
| P1       | Start the 30-day calendar; fill in the weekly report every week                                                                                                         | Founder            | Bio link                                                          |
| P1       | 🔒 Budget for one ad brief (start with Brief 2 or 3 to UTM-tagged pages, with no pixel needed); check Meta's ad policies first                                          | Founder            | Domain live, policy check                                         |
| P2       | Store `utm_content` to compare ad creatives                                                                                                                             | Build              | Paid test approved                                                |
| P2       | Advertising-consent choice in the banner, then a Meta pixel or Conversions API (`Lead` on consent, `Purchase` on verified sale only), tested in Meta's test-events tool | Build              | Live website architecture known; privacy review; founder approval |
| P2       | Pass campaign tags through to Gumroad, if Gumroad supports it (UNVERIFIED), so purchases can be attributed                                                              | Build              | Verify Gumroad behaviour                                          |
| P2       | The same tags and links on herlittleempire.com                                                                                                                          | Founder            | Website platform known                                            |

## 3. Explicitly not done

- No paid campaigns created or launched.
- No Meta pixel, Conversions API or audience tracking.
- No follower, reach, engagement or campaign figures anywhere: none exist in the project.
- No testimonials, purchased engagement, giveaways that require follows, stock footage of people, or unlicensed audio in any brief or script.
- No change to the live website (its source isn't available).
- Nothing deployed or pushed.

## 4. Decisions for the founder

1. Who sends the emails: Gumroad or a mailing service.
2. When to switch the opt-in on, after the sender works and the wording is reviewed.
3. Whether, and with what total budget, to run one of the three ad briefs, after a Meta policy check.
4. Whether to add advertising tracking later (needs the website's architecture, a consent design and a privacy review).
5. Approve the content calendar's tone, especially The Audacity Department, before filming.
