# Platform integration plan

**Strategy (founder, 23 Oct 2026):**

- **herlittleempire.com** is the brand entry point.
- **Gumroad** is the payments system.
- **Empire Studio** at `studio.herlittleempire.com` is the signed-in tools and course experience.
- **No Shopify migration.**

Nothing in this plan has been done to a live system. Every step marked **Vee** needs her login. Every step marked **approval** waits for her explicit yes.

**Never put a secret in this repository, a chat or a screenshot.** Every token goes straight into Vercel → Project → Settings → Environment Variables (marked Sensitive). The app only ever reads them on the server.

## 1. The public website

**Status:** its source and hosting are **not available**, and that's flagged (FACT, 23 Oct 2026):

- herlittleempire.com isn't in this repository: nine unrelated apps plus `empire/` (`DEPLOYS.md`).
- The site couldn't be fetched: this session's network blocks outside sites (DNS lookup fails; proxy returns 403).
- No connector shows it. The only connected Shopify store is PATONGA, another business; Google Drive needs authorising.

**Least disruptive integration, which changes nothing about the site's design or platform:**

| Step | What                                                                                                                                                                                                         | Who                                 | Approval     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------ |
| 1a   | Tell us the platform (Squarespace, Wix, WordPress, Shopify, Carrd, other). Its admin panel names it; or look up the domain's DNS records at the registrar                                                    | Vee                                 | —            |
| 1b   | Add a DNS record so `studio.herlittleempire.com` points at Vercel (the exact record is shown in Vercel → Domains when the domain is added). The main site is untouched                                       | Vee                                 | **approval** |
| 1c   | Add two links on the homepage (and footer): "Free: Ads Profitability Calculator" → `https://studio.herlittleempire.com/ads/tools/calculator?ref=website` and "Free: FIT Finder" → `…/studio/fit?ref=website` | Vee, or a later session with access | **approval** |
| 1d   | Keep the site's existing Gumroad buttons as they are                                                                                                                                                         | —                                   | —            |
| 1e   | Later: export the site or give read access, so it can be audited (`docs/audit/RECOMMENDED_ARCHITECTURE.md` §5)                                                                                               | Vee                                 | —            |

`?ref=website` is recorded with the page view. After cookie consent it's also remembered, so a later sign-up is credited to the website.

## 2. Gumroad integration checklist

The code exists and is unit-tested against a fake Gumroad (`src/lib/billing/`, `docs/PAYMENTS.md`). What's missing is configuration.

### 2a. Product ids (in the repo, not secret)

Each product's id is on its Gumroad edit page (or `GET /v2/products` with the token). Paste them into `gumroadProductIds` in `src/content/catalogue.ts`. **Today every list is empty**, so no purchase can be matched.

| Priority | Product (slug)                                      | Why                                                                                  |
| -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Must** | `income-fit-test`                                   | First offer; unlocks the full FIT Finder report                                      |
| **Must** | `empire-bundle`, `the-whole-empire`                 | Bundles contain the Income Fit Test, so their buyers unlock it too                   |
| Should   | `fit-check-freebie`                                 | Shows the free download in the library                                               |
| Later    | The other 16 products and `faceless-content-bundle` | Library display only                                                                 |
| Not now  | Launch Pack (`GUMROAD_PRODUCT_ID`)                  | Not the first offer; leave `GUMROAD_PRODUCT_URL` unset so the app doesn't ask for it |

### 2b. Settings and secrets (Vercel only, never in the repo)

| Variable                                     | What it is                                                                                 | How to make it                                                                         | Needed for the first sale? |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------- |
| `GUMROAD_ACCESS_TOKEN`                       | Seller API token: lets the app look up a sale before trusting it, and find buyers by email | Gumroad → Settings → Advanced → Applications → create an app → "Generate access token" | **Yes**                    |
| `GUMROAD_PING_SECRET`                        | 24+ random characters that prove a ping came to our URL                                    | `openssl rand -base64 32` on her own computer                                          | **Yes**                    |
| `CRON_SECRET`                                | 24+ random characters for the daily refund recheck                                         | Same                                                                                   | **Yes** (for refunds)      |
| `APP_URL`                                    | `https://studio.herlittleempire.com`                                                       | —                                                                                      | Yes                        |
| `GUMROAD_PRODUCT_ID` / `GUMROAD_PRODUCT_URL` | The Launch Pack's                                                                          | —                                                                                      | No                         |

### 2c. Ping and refund notifications

1. Gumroad → Settings → Advanced → **Ping**: `https://studio.herlittleempire.com/api/billing/gumroad?token=<GUMROAD_PING_SECRET>`. Pings cover every product on the account.
2. **Refund and dispute notifications:** subscribe the same URL to the `refund` and `dispute` resources (`PUT /v2/resource_subscriptions`, with the access token). This is a one-off request a build session can make once the token is in Vercel, without displaying it. Until then the daily recheck catches refunds from the last 45 days.
3. The ping is never trusted on its own: the app looks the sale up with Gumroad, records it once per sale id, and only then grants access (`docs/PAYMENTS.md`).

### 2d. Listing copy (Vee, **approval**; doesn't change price or product)

On the Income Fit Test listing and receipt, add: "Bought this? Sign in to Empire Studio with the same email to use it as an interactive report: studio.herlittleempire.com/studio/fit". Apply `content/CORRECTIONS.md` §1–2 first.

## 3. Genuine test purchase and refund

Run on production after §2, with Vee present. It costs one real US$19 sale, refunded; Gumroad's fee on a refunded sale isn't returned (EST: check Gumroad's refund policy).

| #   | Step                                                                                        | Pass when                                                                                     |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Use a **second email address** Vee controls (not the seller account)                        | —                                                                                             |
| 2   | From `/ads/tools/calculator`, click **See the Income Fit Test** and buy it with a real card | Gumroad receipt arrives with the files                                                        |
| 3   | Wait a minute. In Supabase (Table editor, read-only), `purchases` has one row for the sale  | Status `paid`, product `library:income-fit-test`, not linked to an account yet                |
| 4   | Sign in to Studio with the second email                                                     | `/account` lists the Income Fit Test under "Your Her Little Empire library"                   |
| 5   | Open `/studio/fit`, take the quiz                                                           | The **full** report shows: calculator, country rules, dated plan                              |
| 6   | `/admin` (as Vee)                                                                           | `purchase_verified` counted                                                                   |
| 7   | Re-send the ping from Gumroad (if offered), or buy nothing more                             | Still exactly one `purchases` row (idempotent)                                                |
| 8   | Refund the sale in Gumroad                                                                  | Gumroad confirms                                                                              |
| 9   | Wait for the refund notification, or the next daily recheck (09:17 UTC, `vercel.json`)      | `purchases.status` = `refunded`; the report shows the free top three only; saved answers stay |
| 10  | `/admin`                                                                                    | `purchase_refunded` counted                                                                   |

If any step fails, stop and record what you saw. Don't retry with real money until it's fixed.

## 4. Email

| Option                                                          | Cost (EST)                 | Fit                                                                                                                                                                                                     |
| --------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gumroad's own customer emails** (launch)                      | US$0                       | The Fit Check is already a free Gumroad product, so its downloaders are Gumroad customers. Whether Gumroad's automated emails can send a timed five-email sequence: **UNKNOWN**, check Gumroad → Emails |
| A mailing service with a free tier (MailerLite, Kit or similar) | US$0 to ~1,000 subscribers | Needed if Gumroad can't sequence, or for opt-in inside the calculator. Adds a privacy-notice line and an integration                                                                                    |

**Sign-in emails** are separate: they need custom SMTP in Supabase Auth (Resend or similar, free tier EST), because Supabase's built-in mailer is heavily rate-limited.

## 5. Privacy and terms

Development-only changes made now, for founder review:

| Gap (audit)                                                     | Change                                                                                                                                                | File                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| No seller identity on the privacy page                          | "Who we are": name, ABN, contact, and how to request access, correction or deletion                                                                   | `src/app/privacy/page.tsx`                                |
| Processors and location missing                                 | Supabase (US), Vercel, Anthropic, Gumroad, the email service; "stored and processed outside Australia, mainly in the United States"                   | same                                                      |
| Retention unclear                                               | What account deletion removes, and what's kept unlinked (purchases for tax; usage events), matching the database rules                                | same                                                      |
| Marketing email                                                 | Only with opt-in; every email has a way to stop                                                                                                       | same                                                      |
| Calculator data                                                 | "Worked out in your browser; not sent or saved", verified by an e2e test                                                                              | same                                                      |
| **Campaign cookie set before consent** (found during this work) | `empire_source` is now set only after analytics consent; the campaign name travels with the page view instead. The banner no longer says "one cookie" | `src/components/beacon.tsx`, `src/components/consent.tsx` |
| No terms for free tools                                         | "Free tools": estimates, no prediction, not financial, tax or legal advice                                                                            | `src/app/terms/page.tsx`                                  |
| Refund rule for Gumroad downloads not on the terms page         | The exact house sentence plus the consumer-rights sentence                                                                                            | same                                                      |

**Still needs a professional review** (not legal advice from this session):

- whether the Privacy Act 1988 (Australian Privacy Principles) applies to Her Little Empire, given the small-business exemption: UNKNOWN;
- APP 8 cross-border disclosure wording;
- EU and UK visitors (GDPR, PECR) if they're targeted;
- the Australian Consumer Law wording.

**Not done yet:** a defined retention period for usage events. That's a founder decision, followed by a scheduled delete (a code change).

## 6. Hosting configuration (all **approval**)

1. Merge PR BeCurieux/curieux#68 → `main` contains `empire/` → production deploys.
2. Vercel Pro before taking money (LAUNCH_COSTS.md).
3. Add `studio.herlittleempire.com` in Vercel → Domains; set `APP_URL`.
4. Supabase → Authentication → URL configuration: Site URL and redirect allow-list to the custom domain; add custom SMTP.
5. The variables in §2b.
6. Supabase Pro before the first **paid Studio or course** customer. For the Income Fit Test path, the free plan works but has no backups: LAUNCH_COSTS.md says when to switch.
