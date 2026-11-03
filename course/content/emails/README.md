# Email copy

One markdown file per email (SPEC.md → Email). The founder's copy replaces
these placeholders; each is `draft: true` until then.

Frontmatter: `subject`, `preview` (the line inboxes show), `kind`
(`transactional` or `marketing`: marketing emails get an unsubscribe link and
stop when someone unsubscribes), `draft`, and optionally `button` and
`button_url`.

Tokens, filled in when the email is sent: `{{first_name}}`, `{{learn_url}}`,
`{{lesson_0_2_url}}`, `{{account_url}}`, `{{verdict_url}}`, `{{pricing_url}}`,
`{{check_url}}`, `{{magic_link}}` (lead_welcome only), `{{product}}`,
`{{amount}}`, `{{date}}` (receipts and refunds), `{{verdict}}` and
`{{next_step}}` (verdict_meaning), `{{product}}` also in review_ready, `{{support_email}}`, and the prices:
`{{price:module-0}}`, `{{price:course}}` and so on.

No earnings language: a unit test checks these files.
