# Payments (Stripe)

SPEC.md → Access tiers and Stripe, as built in step 5.

## How a purchase works

1. **`/checkout/[product]`** (signed in) shows what she'll pay, in AUD if
   her country is Australia or unknown, otherwise USD. It shows the Module 0
   credit if she has Module 0, and the founding places left. Nothing she
   already has, or her tier includes, can be bought.
2. **"Continue to secure payment"** works it all out again on the server and
   creates a Stripe Checkout Session:
   - the product's price in her currency;
   - on Module 0, the benchmark pack as an optional item (the bump), unless
     she has it;
   - on the course or founding, for a Module 0 owner, a one-use coupon for
     the full Module 0 price (course = A$201 / US$141);
   - founding refused once 30 places are sold;
   - no tax settings: no GST is charged or itemised.
3. **She pays on Stripe.** Stripe then sends `checkout.session.completed` to
   **`/api/webhooks/stripe`** and returns her to **`/checkout/success`**.
   Both record the purchase from Stripe's own copy of the session, through
   the same idempotent database function (`record_purchase`). Her access is
   there when the page loads, and a retried webhook changes nothing.
4. If the 30th founding place went while she was paying, nothing is
   recorded and she's refunded in full automatically. The success page says
   so.

Receipts and the onboarding emails arrive with step 7.

## Refunds

- **`/account`**, within 14 days of purchase: "Refund this purchase", then
  one button. No reason asked. It refunds on Stripe, then records the refund
  at once (`record_refund`): order refunded, its access revoked (the bump's
  pack too), a founding place given back. The `charge.refunded` webhook that
  follows changes nothing.
- **After 14 days** the button becomes an email link to `SUPPORT_EMAIL`. The
  admin page (step 8) can still refund at any time, using the same
  `refundOrder`.
- A refund made in the Stripe dashboard reaches the app through
  `charge.refunded`. Partial refunds don't end access.

## Setting it up

1. **Stripe account, test mode.** Developers → API keys → the secret key
   (`sk_test_…`) into `STRIPE_SECRET_KEY` (`.env.local`, and Vercel's Preview
   environment).
2. **Products and prices:** `npm run stripe:setup`. It creates one product
   per tier with an AUD and a USD price from the `products` table and writes
   the price ids back. Run it again after changing a price in the table: a
   new Stripe price takes over (Stripe prices can't be edited).
3. **Webhook:** Developers → Webhooks → add an endpoint
   `https://<your domain>/api/webhooks/stripe` for the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded` and
   `charge.refunded`. Its signing secret goes into `STRIPE_WEBHOOK_SECRET`.
   Locally:
   `stripe listen --forward-to localhost:3300/api/webhooks/stripe` prints a
   secret to use.
4. **`SUPPORT_EMAIL`**: where refund requests go after 14 days.
5. **Tax:** leave Stripe Tax off. Nothing in the app adds tax.
6. **Going live:** switch to the live secret key, add the live webhook
   endpoint and its secret, and run `npm run stripe:setup` once with the live
   key and production's Supabase values.

### A real test-mode purchase, by hand

With test keys set and `stripe listen` running: sign in, open
`/checkout/module-0`, pay with card `4242 4242 4242 4242` (any future
expiry, any CVC), tick the benchmark pack. You land on "You're in", and
`/account` shows the order with a refund button.

## How it's tested

The automated tests can't reach Stripe, so `tests/e2e/fake-stripe.ts` stands
in for the API calls the app makes. The app talks to it through the real
Stripe SDK. Its "Pay" button sends a properly signed webhook, and refunds
send `charge.refunded`. The Playwright tests (`tests/e2e/commerce.spec.ts`)
buy Module 0 with the bump, check the entitlement and refund it. They also
cover the A$201 credit, USD, the founding cap and its race, the 14-day email
fallback and forged webhooks. `npm run stripe:setup` runs against it too.
What only real Stripe can show (its hosted page and card handling) is the
hand check above.
