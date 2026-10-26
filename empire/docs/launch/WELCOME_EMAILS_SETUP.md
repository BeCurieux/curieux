# Welcome emails: switching them on

**26 October 2026.** The five welcome emails (`content/emails/welcome-sequence.md`) are sent by Empire Studio through **Resend**:

- **Email 1** goes out as soon as someone ticks the box on `/fit-check`.
- **Emails 2 to 5** go out on days 2, 4, 7 and 10, from a daily job (`/api/email/welcome`, 21:41 UTC, `vercel.json`).
- At most one email per person per day, and at least 20 hours apart.
- Every email has a one-click unsubscribe link and the headers that let Gmail and Apple Mail show their own "Unsubscribe" button. Unsubscribing stops the sequence at once.
- Studio links in the emails carry `utm_source=email&utm_campaign=welcome-<n>`, so `/admin` shows which email brought a visit.

**Secrets rule:** the Resend API key goes only into Vercel, marked **Sensitive**. Never into the repository, a chat, a screenshot or an email.

## Order matters

1. 🔒 **Apply migration `20261026000006_welcome_emails`** to the Supabase project before the code is deployed. Without it, sign-ups still work, but no welcome email can be recorded or sent.
2. 🔒 Merge the pull request.
3. Do the Resend steps below.
4. 🔒 Switch the opt-in on.

## Resend (about 20 minutes, plus DNS waiting time)

1. Create an account at resend.com.
2. **Domains → Add domain:** `herlittleempire.com`.
3. Resend lists DNS records (DKIM, plus SPF and MX records for a sending subdomain). Add them exactly as shown wherever `herlittleempire.com`'s DNS is managed. Which provider that is: UNVERIFIED from here.
4. If the domain has no DMARC record yet, add a TXT record named `_dmarc` with the value `v=DMARC1; p=none;`. Gmail and Yahoo expect one from bulk senders.
5. Wait until Resend shows the domain as **Verified**.
6. **API Keys → Create:** permission **Sending access**, limited to `herlittleempire.com`.

## Vercel → `empire-studio` → Settings → Environment Variables (Production)

| Variable                    | Value                                                         |
| --------------------------- | ------------------------------------------------------------- |
| `RESEND_API_KEY`            | the key from step 6 (**Sensitive**)                           |
| `EMAIL_FROM`                | `Vee at Her Little Empire <hello@herlittleempire.com>`        |
| `EMAIL_REPLY_TO` (optional) | where replies should go; default `hello@herlittleempire.com`  |
| `CRON_SECRET`               | if not already set: `openssl rand -base64 32` (**Sensitive**) |
| `EMPIRE_EMAIL_OPTIN` 🔒     | `on`, last of all                                             |

Then redeploy production. With `EMPIRE_EMAIL_OPTIN=on`, the app refuses to start in production unless the key, the sender and `CRON_SECRET` are all set.

## Test (5 minutes)

1. On your phone, open `/fit-check`, enter your own email, tick the box and send.
2. Email 1 should arrive within a minute. Check the sender name, the links, and that it isn't in spam.
3. Tap the mail app's own "Unsubscribe" (Gmail shows it next to the sender), then open the email's unsubscribe link: the page should say you're already off the list.
4. In Resend → **Emails**, the message shows as delivered.

## Cost

Resend's free plan covers about 3,000 emails a month and 100 a day (ESTIMATE, from memory, October 2026; check resend.com/pricing). Each sign-up uses five emails over ten days, so the free plan fits roughly the first 600 sign-ups a month.
