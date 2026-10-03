# Ovyko — the owner's to-do list

Things only the owner of Ovyko can do (accounts, money, legal, people).
Kept up to date as items are done. Never put passwords or keys in this file.

## Now

- [ ] **Run the waiting database changes.** In the Supabase SQL editor, paste
      and run each file, in this order, then tell Claude "done":
  1. `supabase/migrations/20261007000024_family_privacy.sql`
  2. `supabase/migrations/20261008000025_terms.sql`
  3. `supabase/migrations/20261009000026_family_accounts.sql`
  4. `supabase/migrations/20261010000027_online_payments.sql`
- [ ] **Merge the pull request** (say "merge") once the above is done.

## Business and legal

- [ ] ASIC approval of the business name "Ovyko" (lodged; manual review).
      Uses the virtual office address and ABN 38 813 430 864.
- [ ] Buy the domains at VentraIP (.com.au, .com, .au, .online, .store) and
      turn off auto-renew for .online and .store.
- [ ] Google Workspace, bought directly from Google (hello@ovyko.com.au).
- [ ] Trademark search for "Ovyko".
- [ ] Privacy lawyer review (privacy policy, school data agreement, parent
      notice).
- [ ] Decide pricing (plan: A$349–449 a month per location; SimplySwim
      charges A$159–287).
- [ ] Ask an accountant whether lessons carry GST, before receipts become
      tax invoices.

## Services and settings

- [ ] Supabase: turn off public sign-ups; upgrade to Pro.
- [ ] Resend (sending email): create the account and verify the domain.
- [ ] Vercel environment variables: `EMAIL_TRANSPORT=resend`, `EMAIL_FROM`,
      `RESEND_API_KEY`, `APP_URL`, `CRON_SECRET`.
- [ ] Supabase Vault secrets: `ovyko_app_url`, `ovyko_cron_secret`.

## Stripe (card and direct-debit payments, M7b)

Card payments are built and tested against a stand-in for Stripe. Part A
lets Claude try them against real Stripe in test mode.

Part A, test mode (free, about 15 minutes):

- [ ] Create a Stripe account at stripe.com, country Australia, with the
      business email. Turn on two-step sign-in.
- [ ] Stay in **Test mode**. Under Developers → API keys, find the test keys.
- [ ] Add them to this cloud environment's settings (environment menu in
      the session title bar → Edit), **not** to a chat:
      `STRIPE_SECRET_KEY` (starts `sk_test_`). The publishable key isn't
      needed: parents pay on Stripe's own page.

Part B, going live (before the pilot school takes real payments):

- [ ] Activate payments: the owning business's legal name and ABN, address,
      industry "Software", website, description ("Software for children's
      swim and activity schools; schools collect lesson fees from
      families"), statement descriptor `OVYKO`, ID, payout bank account.
- [ ] Connect → Get started: platform; Stripe-hosted sign-up for schools;
      Stripe charges fees to each school and each school covers its own
      losses; Ovyko logo and colour. Screenshot anything unclear for Claude.
- [ ] Payment methods: cards, Apple Pay, Google Pay, BECS Direct Debit.
- [ ] Live keys go only into Vercel's environment variables
      (`STRIPE_SECRET_KEY`). Then in Stripe, Developers → Webhooks → Add
      endpoint: "Events on connected accounts", address
      `https://<the app's domain>/api/stripe/webhook`, events
      `account.updated`, `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`,
      `charge.refunded`. Put its signing secret (starts `whsec_`) in Vercel
      as `STRIPE_WEBHOOK_SECRET`.
- [ ] Confirm Ovyko's fee: 0.5% of each online payment (from the business
      plan). Tell Claude if it should be different.

## Product decisions waiting

- [ ] Talk to 10 swim school owners in the next 6–8 weeks (the outreach kit
      has the email, demo script and questions). Ask what tools they use
      and which annoys them most.
