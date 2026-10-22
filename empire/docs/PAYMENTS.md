# Payments

## Recommendation: Gumroad for the MVP, behind an interface

The business already sells on Gumroad, buyers already trust it, and it
handles sales tax/VAT as merchant of record. Gumroad's API is enough to
verify purchases reliably **if we never trust the ping itself**:

- **Licence verification** (`POST /v2/licenses/verify`) needs only the
  product id. Enable "Generate a unique license key per sale" on the Launch
  Pack product.
- **Sale lookup** (`GET /v2/sales/:id`, `GET /v2/sales?email=`) needs a
  seller access token (`GUMROAD_ACCESS_TOKEN`). It also finds purchases of
  older products that never issued keys — that's how existing customers'
  libraries are found.

Friction to accept: Gumroad's fee is higher than Stripe's, pings are
unsigned, and refund notifications need a resource subscription. The daily
recheck covers missed notifications.

**Switch to Stripe Checkout when** subscriptions launch (Stripe Billing
handles renewals, cancellation and dunning far better) or fees start to
matter. Everything that grants access goes through `BillingProvider`
(`src/lib/billing/provider.ts`) and the generic `purchases` /
`entitlements` tables, so adding `StripeProvider` doesn't touch the studio.

## How a purchase becomes access

1. Signed-in customer clicks **Buy on Gumroad** → `/api/billing/checkout`
   sends her to Gumroad with her email and a signed `empire_ref`.
2. Gumroad pings `/api/billing/gumroad?token=…`. We look the sale up with
   Gumroad (or verify its licence key, which must belong to that sale id),
   record the purchase (idempotent on sale id), attach it to the account
   named by `empire_ref` (or later by email), and mirror its status onto an
   entitlement.
3. If the ping is missed: signing in claims purchases made with her email;
   "Look for purchases made with my email" asks Gumroad directly; or she
   pastes her licence key.

## Refunds

The existing 14-day no-questions policy applies. A refund (from a ping, a
refund resource subscription, or the daily `/api/billing/recheck`, which
re-verifies purchases from the last 45 days) flips the entitlement to
`refunded`. Generation and export stop; saved work stays viewable and
editable. The purchase record is kept.

## Setup checklist

1. Create the Launch Pack product on Gumroad; turn on licence keys.
2. Set `GUMROAD_PRODUCT_ID`, `GUMROAD_PRODUCT_URL`.
3. Gumroad → Settings → Advanced → Ping: `https://<APP_URL>/api/billing/gumroad?token=<GUMROAD_PING_SECRET>`.
4. Create a Gumroad application for an access token → `GUMROAD_ACCESS_TOKEN`;
   subscribe the same URL to `refund` and `dispute` resources via the API
   (`PUT /v2/resource_subscriptions`).
5. Set `CRON_SECRET` (Vercel uses it for the daily recheck in `vercel.json`).
6. Fill `gumroadProductIds` in `src/content/catalogue.ts` for existing
   products so earlier buyers see their library.
7. Make a real purchase and a refund with a test account (`QA-REPORT.md`).

## Future subscriptions

Not built. If a Studio plan (US$29/month) launches after repeat usage is
proven: a `studio_monthly` product type with `expires_at`, a monthly
generation allowance reset by period, clear renewal and cancellation terms
on the pricing page and receipts, and cancellation from the account page.
A Pro tier waits for real automation (see `SHOPIFY-INTEGRATION.md`).
