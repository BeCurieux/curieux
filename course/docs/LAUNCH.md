# Launch checklist

Build step 9 (SPEC.md → Build order). Work down this page once, top to
bottom, before real customers arrive. The order matters: Supabase first,
then Stripe and Resend (they need the production address), then Vercel,
then the gate.

## 0. The gate: `npm run launch:check`

It refuses to pass until everything below is done. With production's
values pulled down from Vercel:

```sh
vercel env pull .env.production.local --environment=production
npm run launch:check        # reads .env.production.local if it's there
rm .env.production.local    # don't leave live keys lying around
```

It checks four things and exits 1 if any fail:

| Area        | Passes when                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content     | No file in `content/pages` or `content/emails` is `draft: true`; `content/hype/rubric.json` isn't the starter list; no lesson or module file says "placeholder"                                        |
| GST and tax | GST appears nowhere in content, emails or code, and nothing sets a Stripe tax option                                                                                                                   |
| Environment | Every variable in the table below is set; Stripe keys are live; `APP_URL` and the Supabase URL are public https addresses; no test stand-ins (`STRIPE_API_BASE`, `RESEND_API_BASE`, `re_fake`) are set |
| Database    | Every paid product has its AUD and USD Stripe price ids, someone is an admin, and lessons are seeded                                                                                                   |

`npm run launch:check -- --content` checks only content and GST, with no
keys needed. **Today it lists 26 placeholder files**: the eight pages, the
fourteen emails, the Hype Check word lists, and Module 0's summary and two
placeholder lessons.
Those are the founder's.

What the test suite already proves on every push (CI):

- **Signed out, every gated page and route refuses on the server**
  (`tests/e2e/launch.spec.ts`): `/learn`, lessons, `/tools`, `/verdict`,
  `/account`, every `/checkout`, `/admin`, `/admin/leads.csv` and the
  download route all send a signed-out request to sign in, with nothing of
  the page in the response; the cron, webhook and unsubscribe routes refuse
  without their secret or signature.
- **Each of those files makes its own server check**, not only the proxy
  (`tests/unit/launch.test.ts` reads every page, route and server action).
- **No GST anywhere**: every public page in A$ and US$, checkout, the
  payment Stripe is asked for (no tax options), the receipt email, the
  account page and the course pages.

**Running the scripts against production.** `content:seed`, `stripe:setup`
and `admin:add` read `.env.local`, which holds local values. Variables
already in the environment win, so load production's first:

```sh
set -a; . ./.env.production.local; set +a
npm run content:seed
```

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production**. Preview deployments get test-mode Stripe keys
and, ideally, their own Supabase project (docs/AUTH.md → Preview
deployments).

| Variable                               | Where it comes from                                                        | Notes                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API → Project URL                            | `https://….supabase.co`                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key                   | Safe in the browser                                                        |
| `SUPABASE_SECRET_KEY`                  | Supabase → Project Settings → API Keys → Secret key                        | **Secret.** Bypasses row level security                                    |
| `APP_URL`                              | The production address, e.g. `https://course.herlittleempire.com`          | No trailing slash                                                          |
| `STRIPE_SECRET_KEY`                    | Stripe (live mode) → Developers → API keys → Secret key                    | **Secret.** `sk_live_…` (or a restricted `rk_live_…`)                      |
| `STRIPE_WEBHOOK_SECRET`                | Stripe (live mode) → Developers → Webhooks → the endpoint → Signing secret | **Secret.** `whsec_…`, from step 3 below                                   |
| `SUPPORT_EMAIL`                        | An inbox someone reads                                                     | After 14 days the refund button becomes a mailto here                      |
| `RESEND_API_KEY`                       | Resend → API Keys (sending access)                                         | **Secret.** `re_…`                                                         |
| `EMAIL_FROM`                           | e.g. `Her Little Empire <hello@herlittleempire.com>`                       | On the domain verified in Resend                                           |
| `EMAIL_REPLY_TO`                       | Optional                                                                   | If replies should go somewhere other than `EMAIL_FROM`                     |
| `EMAIL_TOKEN_SECRET`                   | `openssl rand -base64 48`                                                  | **Secret.** Signs unsubscribe links; changing it breaks links already sent |
| `CRON_SECRET`                          | `openssl rand -base64 32`                                                  | **Secret.** Vercel sends it to `/api/cron/email`                           |
| `BUNNY_STREAM_LIBRARY_ID`              | Bunny → Stream → the library → API → Library ID                            | Only if lesson videos are on Bunny                                         |
| `BUNNY_STREAM_TOKEN_KEY`               | Bunny → Stream → the library → Security → Embed view token authentication  | Optional: signs embed URLs                                                 |

Never set `STRIPE_API_BASE` or `RESEND_API_BASE` outside the test suite.

## 2. Supabase (production project)

1. New project in Sydney (`ap-southeast-2`), beside Vercel's `syd1`.
2. Apply the migrations: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`.
3. Authentication settings, all five in docs/AUTH.md: Site URL and
   redirect URL, **both email templates** (required: sign-in links fail
   without them), email provider, **custom SMTP through Resend**
   (without it nobody outside the team can sign in), and the rate limit.
4. Seed content and calculators with production's values:
   `npm run content:seed`.

## 3. Stripe, going live

1. **Activate the account** (Stripe → Activate payments): business details,
   ABN, the bank account for payouts, a statement descriptor customers will
   recognise (e.g. `HERLITTLEEMPIRE`).
2. **Switch the dashboard to live mode.** Everything below is in live mode;
   test-mode products, prices and webhooks don't carry over.
3. **Tax: leave it off.** Settings → Tax: Stripe Tax not enabled, no tax
   rates. Nothing in the app adds or itemises tax (SPEC.md →
   Non-negotiables), and the launch check refuses code that does.
4. **Products and prices:** with the live secret key and production's
   Supabase values, run `npm run stripe:setup` once. It creates the four
   products with an AUD and a USD price each and writes the price ids back
   to `products`. The launch check confirms they're there.
5. **Webhook:** Developers → Webhooks → Add endpoint
   `https://<APP_URL host>/api/webhooks/stripe`, events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`
   and `charge.refunded`. Its signing secret is `STRIPE_WEBHOOK_SECRET`.
6. **Emails:** Settings → Customer emails → turn off "Successful payments"
   and "Refunds". The app sends its own receipt and refund confirmation;
   leaving Stripe's on sends two of each.
7. **Checkout branding** (Settings → Branding): logo, the accent colour,
   and the public business name.
8. **Payment methods:** cards are enough. Leave Link and wallets as Stripe
   suggests.
9. **One real purchase:** after deploying, buy Module 0 with your own card,
   check the "You're in" page, the receipt email and `/account`, then refund
   it from `/account` and check access is gone and the refund email came.
   Stripe → Payments shows both.

## 4. Resend

1. Add and verify the sending domain (the DNS records Resend lists).
2. Create an API key with sending access → `RESEND_API_KEY`.
3. SMTP for Supabase's sign-in emails (step 2.3): host `smtp.resend.com`,
   port 465, user `resend`, password an API key.

## 5. Vercel

1. New project from this repository, **Root Directory `course`**
   (`../DEPLOYS.md`). Framework Next.js; region `syd1` comes from
   `vercel.json`.
2. The environment variables from section 1, for Production.
3. The domain: add it in Vercel and point DNS at it. `APP_URL` and the
   Supabase Site URL must be this address.
4. The daily email run (`vercel.json` → crons, 23:07 UTC, about 10am in
   Sydney) starts on its own once `CRON_SECRET` is set. Vercel → Project →
   Cron Jobs shows it; "Run" fires it once to check.

## 6. After the first deploy

1. Sign in on the live site, then make yourself an admin:
   `npm run admin:add -- you@…` with production's values. `/admin` opens.
2. `npm run launch:check` again: everything ok.
3. The real purchase and refund in Stripe step 9.
4. `/check` with a fresh address: the welcome email arrives and its link
   opens the free lessons.
5. Open `/`, `/pricing` and a checkout on a phone, and from outside
   Australia if you can (a VPN), to see US dollars.

## Still with the founder

- The page copy, all fourteen emails, the legal pages (the placeholders are
  explicitly not legal text) and the Hype Check word lists.
- The Module 0 scripts and videos, to replace the two placeholder lessons.
- The calculator readings listed in docs/CALCULATORS.md.
- Whether the three lead nudges should be sent at all (docs/EMAIL.md).
