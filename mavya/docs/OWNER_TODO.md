# Ovyko — the owner's to-do list

Things only the owner of Ovyko can do (accounts, money, legal, people).
Kept up to date as items are done. Never put passwords or keys in this file.

## Now

- [x] Database changes 24 to 41 run in Supabase and merged (6 October 2026).
- [x] "Try it yourself" (database change 42) run and merged; checked live on
      7 October 2026.

- [ ] **See Ovyko's totals.** After the database changes: sign up in
      Ovyko with your own email, then in the Supabase SQL editor run
      (with your email):
      `insert into public.platform_admins (user_id) select id from public.users where email = 'you@example.com';`
      Then sign in, set up two-step sign-in with an authenticator app, and
      open `/platform`.

- [ ] **Get a real export from the pilot school**, once they agree to the
      pilot: their students, balances and make-up credits as CSV files from
      their current system (iClassPro, SimplySwim, Class Manager or
      similar). Share them with Claude only with the school's permission,
      or try them yourself on "Move your school in" with a test school.
      Ovyko reads many systems' column names and lets you match the rest,
      but the first real export is the real test (`docs/M6_MIGRATION_PILOT.md`,
      M6h).

## Business and legal

- [ ] ASIC approval of the business name "Ovyko" (lodged; manual review).
      Uses the virtual office address and ABN 38 813 430 864.
- [x] Buy ovyko.com.au and ovyko.com (5 October 2026). Still optional:
      .au, .online and .store (if bought, turn off auto-renew for .online
      and .store).
- [ ] **Point the domains at Ovyko.** Done in Vercel (6 October 2026):
      `www.ovyko.com.au` is the main address and `ovyko.com.au` redirects
      to it. Still to do:
  - At VentraIP (DNS Management for each domain), add the records Vercel
    shows under "View DNS configuration", and remove any old "parking"
    A or CNAME records for the same names. Then press Refresh in Vercel
    until each says Valid Configuration (minutes, sometimes a few hours).
  - Optional: in Vercel, Edit `ovyko.com` and `www.ovyko.com` to redirect
    to `www.ovyko.com.au`, so there's one site, not two.
  - Set `APP_URL=https://www.ovyko.com.au` in Vercel. In Supabase
    (Authentication → URL Configuration) set the Site URL to
    `https://www.ovyko.com.au` and add `https://www.ovyko.com.au/**` to the
    redirect URLs, so sign-in and invite links use the new address.
- [x] Google Workspace for hello@ovyko.com.au, with Gmail's MX, SPF and DKIM
      records (7 October 2026; SPF and DKIM pass).
- [ ] **Email deliverability.** Add the DMARC record where the SPF record is:
      TXT, name `_dmarc`, value
      `v=DMARC1; p=none; rua=mailto:hello@ovyko.com.au`. Then send a test
      email to a personal address and check "Show original" shows SPF, DKIM
      and DMARC all PASS. A new domain can still land in spam for a few days:
      mark it "Not spam", and send a few everyday emails before writing to
      schools.
- [ ] Trademark search for "Ovyko".
- [ ] Privacy lawyer review (privacy policy, school data agreement, parent
      notice).
- [x] Decide pricing: A$399 a month per location, 30 days free
      (4 October 2026; `docs/SUBSCRIPTIONS.md`). Ask the accountant
      whether to charge GST on it, and set the Stripe price to match.
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
      `charge.refunded`, `charge.refund.updated`, `refund.failed`,
      `charge.dispute.closed`, `account.application.deauthorized`,
      `payment_intent.succeeded`, `payment_intent.processing`,
      `payment_intent.payment_failed` (the last three are for
      instalments). Put its signing secret (starts `whsec_`) in Vercel
      as `STRIPE_WEBHOOK_SECRET`.
- [ ] Ovyko's plan in Stripe: Product catalogue → add a product "Ovyko"
      with a monthly price of A$399 (per unit). Put its id (starts
      `price_`) in Vercel as `STRIPE_SCHOOL_PRICE_ID`. Settings →
      Billing → Customer portal: turn it on (update payment details,
      invoices, cancel). Add a second webhook endpoint, "Events on your
      account", same address, events `customer.subscription.created`,
      `.updated`, `.deleted`, `.paused`, `.resumed`; add its signing
      secret to `STRIPE_WEBHOOK_SECRET` after the first, separated by a
      comma.
- [ ] Confirm Ovyko's fee: 0.5% of each online payment (from the business
      plan). Tell Claude if it should be different.

## Product decisions waiting

- [ ] Fee reminders (M7c): Claude chose a week before, on the day, then a
      week and two weeks after, at 9am, off until each school turns them
      on. Change any of that if you'd like.
- [x] Xero: kept out until after the pilot (4 October 2026).
- [x] Instalments (M7c part 2): 2 or 4 a term, no extra fee, each school
      turns them on (4 October 2026).

- [ ] Before sharing the waitlist page (`/founding`): decide the offer,
      area and dates and tell Claude (they go in `src/lib/site/founding.ts`;
      nothing shows until they're set), add a privacy policy page, and send
      Claude your founder note if you want one on the page. Sign-ups show
      on `/platform`.
- [ ] Follow the 90-day selling plan in `docs/LAUNCH_90_DAYS.md`, with the
      messages in `docs/OUTREACH.md` and the waitlist page in
      `docs/WAITLIST_PAGE.md`. Decide the founding-schools offer first.
- [ ] Talk to 10 swim school owners in the next 6–8 weeks (the outreach kit
      has the email, demo script and questions). Ask what tools they use
      and which annoys them most, and add the five questions in
      `docs/STRATEGY.md` ("Questions to ask in the owner interviews").
