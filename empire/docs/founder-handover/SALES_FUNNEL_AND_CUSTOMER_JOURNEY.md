# Sales funnel and customer journey

**Prepared 23 October 2026.** Labels per step:

> **Status update, 25 October 2026:** PR BeCurieux/curieux#68 and PR BeCurieux/curieux#69 (`hle-ads`) are merged into `main`, and the email sign-up migration (`20261024000005`) is applied to the Supabase project. Studio still isn't public on `studio.herlittleempire.com` (Vercel Pro and DNS pending) and Gumroad isn't connected. The rest of this document describes the date above.

- **VERIFIED WORKING**: seen working in a real environment (or covered by an automated test against real code, as stated).
- **BUILT BUT UNTESTED**: code exists but hasn't run against the real service.
- **BROKEN**.
- **NOT BUILT**.
- **UNKNOWN**: couldn't be checked from this session.

## 1. The journey, step by step

| #   | Step                                     | How it works                                                                                                                        | Status                                                                                                                 | Evidence                                                       |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Discovery: Instagram @herlittleempire.co | Posts and bio link                                                                                                                  | **UNKNOWN**                                                                                                            | Not in the project; no connector                               |
| 2   | Discovery: search                        | herlittleempire.com SEO; Gumroad Discover                                                                                           | **UNKNOWN**                                                                                                            | Website unreachable from here                                  |
| 3   | Website                                  | herlittleempire.com → Gumroad buttons (assumed)                                                                                     | **UNKNOWN**                                                                                                            | Website source and hosting unavailable                         |
| 4a  | Free lead magnet: 5-Question Fit Check   | Free Gumroad product (`/l/fit-check`); Gumroad collects the email                                                                   | **UNKNOWN** (founder says it's live)                                                                                   | Founder, 22 Oct 2026                                           |
| 4b  | Free tool: FIT Finder free tier          | Sign in by emailed link → 20 questions → top three                                                                                  | **VERIFIED WORKING** on preview for sign-in (founder); quiz e2e-tested on the local backend                            | Founder; `tests/e2e/fit.spec.ts`                               |
| 4c  | Free tool: Ads Profitability Calculator  | Public page, computed in the browser                                                                                                | **BUILT BUT UNTESTED** live (e2e-tested locally; branch unpushed)                                                      | `tests/e2e/calculator.spec.ts`                                 |
| 5   | Email capture with permission            | Gumroad's free-product checkout (Fit Check); no capture inside Studio                                                               | **UNKNOWN** for Gumroad's opt-in wording; **NOT BUILT** in Studio                                                      | —                                                              |
| 6   | Welcome sequence                         | Five drafted emails                                                                                                                 | **NOT BUILT** (copy only; no sending service set up)                                                                   | `content/emails/welcome-sequence.md`                           |
| 7   | Paid offer page: Income Fit Test         | Gumroad listing                                                                                                                     | **UNKNOWN** live; corrections pending                                                                                  | `content/CORRECTIONS.md`                                       |
| 8   | Checkout and payment                     | Gumroad                                                                                                                             | **UNKNOWN** (Gumroad's own; presumed working for existing sales)                                                       | —                                                              |
| 9   | Payment confirmation and delivery        | Gumroad receipt with files; Gumroad library                                                                                         | **UNKNOWN**                                                                                                            | —                                                              |
| 10  | Purchase reaches Empire Studio           | Gumroad ping → `/api/billing/gumroad?token=…` → sale looked up with Gumroad → recorded once → entitlement `library:income-fit-test` | **BUILT BUT UNTESTED** (unit-tested against a fake Gumroad); **BROKEN in practice**: no product ids, token or ping set | `src/lib/billing/`; `src/content/catalogue.ts` (all ids empty) |
| 11  | Studio access                            | Sign in with the purchase email → purchases claimed by email → full FIT report unlocks                                              | **BUILT BUT UNTESTED** live (e2e-tested with the local "give yourself the Income Fit Test" button)                     | `src/lib/auth/after-sign-in.ts`; `tests/e2e/fit.spec.ts`       |
| 12  | Refund                                   | Gumroad refund → notification or daily recheck → access locks, saved work stays                                                     | **BUILT BUT UNTESTED** (needs `CRON_SECRET` and the token)                                                             | `vercel.json` cron; `docs/PAYMENTS.md`                         |
| 13  | Follow-up email after purchase           | Gumroad receipt only                                                                                                                | **NOT BUILT** beyond Gumroad's receipt                                                                                 | —                                                              |
| —   | Launch Pack purchase (Studio software)   | Pricing → "Get the Launch Pack" → `/account` → checkout                                                                             | **BROKEN**: dead end (no Gumroad product configured; returns to `/account`). No money can be taken                     | `src/app/api/billing/checkout/route.ts`                        |

## 2. Where people are likely to drop off

| Point                                                     | Why                                                                                   | Fix                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Instagram or website → anything free                      | No verified link from the website to the free tools                                   | Two links with `?ref=website` (founder, website admin)                            |
| Studio home (`/`) for a side-income visitor               | It talks only about Shopify                                                           | Link the free tools from `/` (later change)                                       |
| FIT Finder → sign-in                                      | An account is needed; after sign-in you land on `/studio`, not back on the FIT Finder | Return to the page you came from (small change)                                   |
| Free tool → no email                                      | No opt-in inside Studio; only the Gumroad freebie collects emails                     | Use the Fit Check at launch; an in-app opt-in once a mailing service is chosen    |
| Gumroad buyer → never learns about the interactive report | Nothing on the listing or receipt mentions Studio                                     | One line on the listing and receipt                                               |
| Bought, signs in with a different email                   | Purchases match by email                                                              | "Look for purchases made with my email" and licence-key entry exist on `/account` |
| Pricing → "Get the Launch Pack"                           | Dead end                                                                              | Configure the product, or hide the button until it's for sale (founder decision)  |

## 3. How Gumroad connects to Empire Studio

1. **Product ids** (not secret) go into `gumroadProductIds` in `src/content/catalogue.ts`. **All are empty today.** First: Income Fit Test, The Empire Bundle (`empire-bundle`), The Whole Empire (`the-whole-empire`), and the Fit Check.
2. **Settings** go into Vercel only, never the repo or chat:
   - `GUMROAD_ACCESS_TOKEN` (looks sales up before trusting them);
   - `GUMROAD_PING_SECRET` (24+ characters);
   - `CRON_SECRET` (daily refund recheck);
   - `APP_URL`.

   Launch Pack only: `GUMROAD_PRODUCT_ID`, `GUMROAD_PRODUCT_URL`.

3. **Gumroad settings:** the ping URL `https://studio.herlittleempire.com/api/billing/gumroad?token=…`, and refund and dispute resource subscriptions.
4. **Safety:**
   - a ping is never trusted alone; it's looked up with Gumroad, and access is granted only for a real, unrefunded sale;
   - each sale is recorded once;
   - a signed reference (`empire_ref`) ties checkouts started inside Studio to the account.

Full checklist: `docs/launch/PLATFORM_INTEGRATION_PLAN.md` §2.

## 4. Analytics, email capture and conversion tracking

- **First-party events** (`docs/ANALYTICS.md`):
  - `landing_viewed`, `pricing_viewed`, `calculator_viewed`, `preview_started`;
  - `signup_completed` (with source), `profile_completed`, `fit_completed`;
  - `generation_*`, `asset_copied` / `asset_downloaded` / `pack_exported`;
  - `checkout_started`, `purchase_verified`, `purchase_refunded`;
  - `offer_clicked` (which next step was chosen from the calculator).

  Only coarse properties are recorded, never text a customer typed. A visitor identifier is set only after cookie consent.

- **Real counts (FACT, 23 Oct 2026, founder's testing only):** 4 landing views, 1 pricing view, 1 profile completed, 1 generation, 0 purchases.
- **Known gap:** `signup_completed` only counts a first successful sign-in within 10 minutes of the account being created.
- **Not tracked:**
  - clicks that leave for Gumroad from the website (UNKNOWN);
  - Gumroad conversion rates (in Gumroad's own analytics, UNVERIFIED);
  - any ad-platform conversions (no pixel, by design).
- **Email capture:** Gumroad only (Fit Check and buyers). No mailing service is connected.

## 5. End-to-end test plan (needs a genuine purchase)

Run after PR #68 is merged, Vercel Pro is on, the custom domain is set and the Gumroad settings in §3 are in place. Do it with the founder present. It costs one real US$19 sale, which is then refunded; whether Gumroad returns its fee on a refund is UNVERIFIED.

| #   | Action                                                                           | Pass when                                                                                             |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | On a phone, from Instagram's bio link (or the website), open the free calculator | Page loads on the custom domain                                                                       |
| 2   | Click "See the Income Fit Test"                                                  | Gumroad listing opens with US$19 and the exact refund sentence                                        |
| 3   | Buy it with a real card and a **second email** the founder controls              | Payment succeeds                                                                                      |
| 4   | Check the email                                                                  | Gumroad receipt with working download links; the files open; version says v1.4, 20 questions          |
| 5   | Within a few minutes, check the Studio database (read-only) or `/admin`          | One purchase, status `paid`, product `library:income-fit-test`; `purchase_verified` counted           |
| 6   | Sign in to Studio with that email                                                | `/account` shows the Income Fit Test in the library                                                   |
| 7   | Take the FIT Finder                                                              | The **full** report appears (calculator, country rules, dated plan); progress survives a reload       |
| 8   | Refund the sale in Gumroad                                                       | Gumroad confirms                                                                                      |
| 9   | After the refund notification or the next daily recheck (09:17 UTC)              | Status `refunded`; report back to the free top three; saved answers kept; `purchase_refunded` counted |
| 10  | Record each result, with the time                                                | A written log; any failure stops the test until it's fixed                                            |
