# Reelkit

*Working name.* Paste an Etsy or Shopify product link, get three short video
ads (a scroll-stopper, a gift angle, a close-up on details) made from the
seller's own photos and words, ready for Reels, TikTok and Facebook.

## What works today

1. **Import.** Shopify product links on any domain (`/products/<handle>`) read
   the store's public `.json`, plus the page for the currency. Etsy listings
   use the Etsy Open API when `ETSY_API_KEY` is set; without it Etsy usually
   blocks the request and the seller gets the manual form. Any other product
   page is read from its JSON-LD and meta tags. Manual entry (type details,
   upload photos) always works.
2. **Write.** Three ad scripts: hook, 2–4 captions, call to action. Claude
   drafts them when `ANTHROPIC_API_KEY` is set; templates write them
   otherwise. Every draft is checked against the listing (`src/script/check.ts`)
   and replaced by a template if it mentions a number or a claim word
   ("handmade", "best-seller", "free shipping", …) the listing doesn't contain.
3. **Preview, edit, download.** Live canvas previews, editable copy, three
   shapes (9:16, 4:5, 1:1). Videos are encoded **in the seller's browser**
   (WebCodecs via `mediabunny`): H.264 MP4 in Chrome, Edge and Safari, VP9
   WebM as a fallback elsewhere. No server render cost, and uploaded photos
   never leave the device.

4. **Accounts and credits.** Sign in with an emailed code (no passwords).
   New accounts get 3 free credits; one credit buys one AI-written set of
   three ads, and it is given back if the AI produced nothing usable.
   Downloads are always free. More credits come in one-off packs through
   Stripe Checkout: Starter 20 for $9, Shop 60 for $19, Studio 200 for $49
   (`src/billing/packs.ts`). No subscriptions; credits don't expire.

## Not yet

- Saved projects and ad history.
- Subscriptions, a receipts page, and refunds of purchased credits (refund in
  the Stripe dashboard for now; credits are not taken back automatically).
- Voiceover and music: videos are silent. Needs a TTS provider decision.
- AI avatars and AI-generated clips (phase 2).
- Proving the seller owns the listing they import.

## Run it

```sh
pnpm install
cp .env.example .env.local   # all optional locally
pnpm dev                     # http://localhost:3000
pnpm test && pnpm typecheck
```

`tests/db.test.ts` runs the credit functions against a real Postgres. It is
skipped unless `REELKIT_TEST_DATABASE_URL` points at a server it can create a
scratch database on (CI provides one).

`pnpm smoke` drives a real browser through manual entry → ads → download
against a running server (see `scripts/e2e-smoke.ts`). It is not in CI,
because it needs a browser that can encode video.

## Configuration

| Variable | Needed | What happens without it |
|---|---|---|
| `IMAGE_PROXY_SECRET` | production | Throws on Vercel. Locally, a per-process secret is generated. |
| `ANTHROPIC_API_KEY` | no | Ads come from templates. |
| `ETSY_API_KEY` | no | Etsy links mostly fall back to manual entry. Register an app at developers.etsy.com and use `keystring:shared_secret`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | for accounts | No accounts. Locally, ads are free. **In production, AI drafting stays off** and every seller gets template ads, because an AI endpoint with no sign-in in front of it is an open tab on the Anthropic bill. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | for payments | Sellers keep their free credits but can't buy more. |
| `APP_URL` | recommended | Return links use the request's own address. |

## Setting up accounts and payments

**Supabase**

1. Create a project. Apply `supabase/migrations/` (Supabase CLI: `supabase db push`,
   or paste the file into the SQL editor).
2. Settings → API keys: copy the project URL, the publishable key and a secret
   key into the three Supabase variables.
3. Authentication → URL Configuration: set Site URL to `APP_URL`, and add
   `APP_URL/auth/confirm` to the redirect allow-list.
4. Authentication → Emails → "Magic Link" template: sellers sign in with a
   code, so the email must contain it. Replace the body with:

   ```html
   <h2>Your Reelkit sign-in code</h2>
   <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
   <p>Or <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">tap here to sign in</a>.</p>
   <p>If you didn't ask for this, you can ignore it.</p>
   ```

   Use the same body for the "Confirm signup" template. Supabase's built-in
   mailer only sends a few emails an hour; connect your own SMTP
   (Authentication → Emails → SMTP settings) before launch.

**Stripe**

1. Developers → API keys: put the secret key in `STRIPE_SECRET_KEY` (test
   mode first).
2. Developers → Webhooks → Add endpoint: `APP_URL/api/billing/webhook`, events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Buy a pack with card `4242 4242 4242 4242` and check the balance goes up.
   Then repeat with live keys and a live webhook endpoint.

Prices are in `src/billing/packs.ts`. The free allowance is
`public.free_credits()` in the migration and `FREE_CREDITS` beside the packs;
change both together, in a new migration.

## Layout

```
src/product/   link → Product. fetch.ts is the only file that touches the network;
               guard.ts refuses private addresses on every hop.
src/script/    Product → three AdScripts. claude.ts is the only file that calls a model.
src/render/    AdScript → frames (pure timeline, layout, draw) → video (encode.ts, browser only).
src/billing/   packs, the credit rules, Stripe. stripe.ts is the only file that calls Stripe.
src/server/    request handlers with injected dependencies; routes in src/app/api are one line.
               supabase.ts is the only file that talks to Supabase; auth.ts is sign-in.
supabase/      migrations: accounts, the credit ledger, and the functions that change it.
src/app/       the single-page studio.
```
