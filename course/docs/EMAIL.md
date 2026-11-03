# Email

SPEC.md → Email, as built in step 7. Sent through Resend; the words are in
`content/emails/*.md` (placeholders until the founder's copy arrives), and
the layout is the React Email component in `emails/layout.tsx`.

## What's sent, and when

| Email                           | When                                                                                              | Kind          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- |
| `lead_welcome`                  | Straight away, on /check or the Hype Check's email: the sign-in link plus "start with lesson 0.2" | transactional |
| `nudge_1`, `nudge_2`, `nudge_3` | Days 2, 5 and 9 after a lead signs up, unless she buys Module 0 or more                           | marketing     |
| `receipt`                       | Straight away, for every purchase                                                                 | transactional |
| `founding_welcome`              | Straight away, for a founding place: how to send the verdict for review                           | transactional |
| `onboarding_1` … `onboarding_5` | Days 0, 2, 5, 10 and 14 after her first Module 0+ purchase, while she still has it                | marketing     |
| `refund`                        | Straight away, on a refund (from her account, the admin page or the Stripe dashboard)             | transactional |
| `verdict_meaning`               | When she marks lesson 0.8 done: what her verdict means, with the next step for its colour         | transactional |

- **Straight away** means the purchase, refund, sign-up or lesson triggers
  it. The **daily run** (`/api/cron/email`, Vercel cron at 23:07 UTC, about
  9 or 10 am in Sydney) sends the timed sequences and anything a straight-away
  send missed.
- **Exactly once:** every send claims a row in `email_events` first, unique
  per recipient and occasion (`receipt:<order id>`, `onboarding_2`,
  `nudge_1`, …). A retried webhook, the success page and the cron can all
  try; only one sends. A failed send gives up its claim, so the next run
  retries.
- **One per day:** if the cron misses days, she gets the next onboarding or
  nudge email tomorrow, not a pile at once. Receipts and refunds more than a
  week old aren't chased.
- **Marketing** emails (nudges, onboarding) carry an unsubscribe link and
  the one-click `List-Unsubscribe` header. Unsubscribing (from the link,
  which asks first, or from `/account` → Email preferences) adds the address
  to `email_suppressions`. Transactional emails still go.

## Setting it up

1. **Resend:** add and verify the sending domain, then put an API key in
   `RESEND_API_KEY`.
2. `EMAIL_FROM`, e.g. `Her Little Empire <hello@herlittleempire.com>` (on
   the verified domain), and `EMAIL_REPLY_TO` if replies should go elsewhere.
3. `CRON_SECRET`: any long random string. Vercel sends it to the cron route
   automatically once it's set in the project.
4. `EMAIL_TOKEN_SECRET`: any long random string. It signs unsubscribe links,
   so changing it breaks links already sent.
5. Supabase's own sign-in email (for /login) still goes through Supabase's
   SMTP settings (docs/AUTH.md); point those at Resend too.

Without `RESEND_API_KEY`, outside production, emails are logged instead of
sent, and /check falls back to Supabase's plain sign-in email.

## Before launch

- The founder's copy replaces every `draft: true` file in `content/emails`.
- Sending nudges and onboarding emails to people who gave their email for
  the free check is the founder's call under the Spam Act. Every one
  identifies the sender and has a working unsubscribe.

## How it's tested

`tests/unit/email.test.ts` covers the schedule (`src/lib/email/plan.ts`),
unsubscribe signing, and every template rendering with its tokens filled.
`tests/e2e/email.spec.ts` runs against a stand-in Resend server
(`tests/e2e/fake-resend.ts`):

- the receipt and first onboarding email on purchase, once each even though
  two paths record it;
- the founding email and the refund confirmation;
- the cron: it refuses a wrong secret, sends a day-2 nudge once, and stops
  after unsubscribing;
- onboarding email 2 on day 2;
- the lesson 0.8 email by colour, once;
- the account page's email preference.
