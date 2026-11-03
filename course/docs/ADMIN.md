# Admin

`/admin` (SPEC.md → Admin), as built in step 8. Only accounts in the
`admins` table can open it. The server checks on every load and in every
action, and anyone else gets a plain 404. To make yourself an admin, sign in
once, then run `npm run admin:add -- you@example.com`, or use the SQL in
`scripts/add-admin.ts` against production.

All reads go through row level security as you ("admins read all"). The
two writes are server actions that check the admins table again before
using the service role.

| Tab          | What's there                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyers**   | Everyone who has bought anything: email, current tier, country, and each purchase with its date and amount. Search by email. **Refund** works on any paid order at any time, not just the first 14 days. It refunds on Stripe, revokes access at once, gives back a founding place, and sends the refund email, exactly as the customer's own refund does. |
| **Leads**    | The newest 500 leads, with source (`product check`, `hype check`, `waitlist`, `keyword`), waitlist interests, first seen, and whether they signed in or bought. **Export CSV** downloads them all.                                                                                                                                                         |
| **Cohort**   | Founding places sold (of 30) and each founding member. Under each member are the verdicts she has sent for review, with their reasons. Write the review in the box (markdown works) and press **Send review**: it appears on her verdict page and she gets the "review is ready" email. A review can't be overwritten once sent.                           |
| **Verdicts** | Every saved verdict: product, colour, who, when, and whether it's waiting for or has a review.                                                                                                                                                                                                                                                             |
| **Numbers**  | Today and the last 7 days, Sydney time.                                                                                                                                                                                                                                                                                                                    |

## Numbers

| Row                                | Counts                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Leads                              | Leads first seen in the period                                                                     |
| Module 0 / course / founding sales | Orders made in the period. A sale later refunded still counts here and shows under Refunds         |
| Refunds                            | Orders refunded in the period                                                                      |
| Lead → buyer                       | Of the period's leads, how many now have Module 0 or more (the benchmark pack alone doesn't count) |

The definitions are tested in `tests/unit/admin.test.ts`.

## The leads CSV

`/admin/leads.csv`: email, source, first_seen, interests, has_account,
bought. Every field is quoted. Anything that starts like a spreadsheet
formula (`=`, `+`, `-`, `@`) is prefixed with `'` so Excel or Sheets
shows it rather than running it.
