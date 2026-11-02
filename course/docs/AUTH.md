# Sign-in (Supabase Auth, magic link)

No passwords. She types her email at `/login`, Supabase emails a link, the
link lands on `/auth/confirm`, which verifies it on the server and sets the
session cookie. The page she was heading for comes back from a short-lived
cookie (`hle_next`), checked by `safeNext` so it can only be one of our
signed-in pages.

## Why the email template is changed

Supabase's default magic-link email links to `…?code=…`. A code can only be
exchanged in the browser that asked for it. She will often ask on one device
and open the email on another, or tap it inside Instagram's or Gmail's
in-app browser, and a code link fails there.

`supabase/templates/magic_link.html` links to
`/auth/confirm?token_hash=…&type=email` instead. A token hash verifies in
any browser. `/auth/confirm` still accepts `?code=` so a project left on the
default template signs people in where it can rather than failing outright.

The local stack uses the template automatically (`supabase/config.toml`).
The hosted project needs it set by hand.

## Hosted project settings

Supabase dashboard → Authentication:

1. **URL Configuration**
   - Site URL: the production address, e.g. `https://course.herlittleempire.com`.
     The link in the email is built from it.
   - Redirect URLs: `https://course.herlittleempire.com/auth/confirm`, plus
     `http://localhost:3300/auth/confirm` if you sign in to production data
     locally (you usually shouldn't).
2. **Email Templates → Magic Link** and **→ Confirm signup**: subject
   "Your sign-in link for Her Little Empire", body from
   `supabase/templates/magic_link.html`. Both, because her very first link
   comes from the Confirm signup template.
3. **Sign In / Providers → Email**: enabled. "Confirm email" can stay on;
   tapping the link confirms her.
4. **SMTP Settings**: a custom sender (Resend). Supabase's built-in sender is
   for testing only: a few emails an hour, and only to addresses on the
   project's team. Without this, nobody else can sign in.
5. **Rate Limits**: the default emails-per-hour limit rises once custom SMTP
   is on; set it to cover a launch-day spike (e.g. 100/hour).

## Preview deployments

The emailed link always points at the Site URL, so signing in on a Vercel
preview URL lands on production. Test sign-in locally or on production. If
previews ever need their own sign-in, give them their own Supabase project.

## Known limitation

Some corporate mail filters open every link in an email to scan it, which
uses up a one-time link before she taps it. She then sees "That link has
expired or has already been used" and asks for another. Consumer inboxes
(Gmail, iCloud, Outlook.com) don't do this. If it becomes a problem, the fix
is a confirm button on `/auth/confirm` so a bare GET doesn't sign in.
