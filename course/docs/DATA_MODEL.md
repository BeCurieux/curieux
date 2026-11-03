# Data model

The tables in `SPEC.md` → Data model, as built. Two migrations:
`20261103000001_foundation.sql` (profiles, admins) and
`20261103000002_schema.sql` (everything else). Row level security tests:
`tests/rls/rls.sql` and `tests/rls/schema.sql` (`npm run test:rls`).

Every table has `id uuid`, `created_at`, `updated_at` (kept by a trigger)
and row level security on. A test fails if a table is added without them.

## Who can do what

| Table             | Anyone (signed out)   | Her own rows (signed in)                                    | Admin            | Server (service role) writes  |
| ----------------- | --------------------- | ----------------------------------------------------------- | ---------------- | ----------------------------- |
| `profiles`        | —                     | read; update name, country, email opt-in                    | read all         | created by trigger            |
| `admins`          | —                     | read (whether she is one)                                   | read all         | `npm run admin:add`           |
| `products`        | read active           | read active                                                 | read all         | prices, Stripe ids, counter   |
| `orders`          | —                     | read                                                        | read all         | webhook, refunds              |
| `entitlements`    | —                     | read                                                        | read all         | webhook, refunds, hand grants |
| `modules`         | read                  | read                                                        | read             | seed script                   |
| `lessons`         | read the outline\*    | read the outline\*                                          | read the outline | seed script                   |
| `lesson_assets`   | read label and kind\* | read label and kind\*                                       | same             | seed script                   |
| `calculators`     | read                  | read                                                        | read             | seed script                   |
| `lesson_progress` | —                     | read; mark (lessons she can open); unmark                   | read all         | —                             |
| `calc_runs`       | —                     | read; save (calculators she can use); delete                | read all         | —                             |
| `verdicts`        | —                     | read; write and edit (module0+) until sent; send (founding) | read all         | the founder's review          |
| `leads`           | —                     | —                                                           | read all         | `/check`, `/hype`, waitlist   |
| `email_events`    | —                     | —                                                           | read all         | every send                    |

\* `lessons.video_id`, `lessons.script_md` and `lesson_assets.storage_path`
are closed to the API by column grants. A query must name its columns
(`select=id,title,…`); `select *` on these two tables is refused. The video
and script come from `lesson_content(lesson_id)`, which returns nothing
unless her tier reaches the lesson's. Downloads go through
`/api/assets/[id]` (step 3), which checks with `tier_of()` and signs a URL.

### Where this is narrower than the spec's one-line rule

The spec says users "read and write only their own rows". Taken literally,
she could write her own `entitlements` and `orders` and give herself the
course. So she reads those rows but only the server writes them. Likewise
the founder's review on a verdict (`review_md`, `reviewed_at`) is written by
the server, from the admin page, never through the API, even by an admin:
admin writes go through server actions that check `is_admin()` first.

## Entitlement resolution

| Function                      | Answers for | Callable by |
| ----------------------------- | ----------- | ----------- |
| `tier_of(user)`               | any user    | server only |
| `has_benchmark_pack_of(user)` | any user    | server only |
| `my_tier()`                   | the caller  | signed in   |
| `my_benchmark_pack()`         | the caller  | signed in   |
| `can_access(min_tier)`        | the caller  | signed in   |
| `lesson_content(lesson)`      | the caller  | signed in   |
| `is_admin()`                  | the caller  | signed in   |

- Tier order is the enum's order: `free < module0 < course < founding`. The
  effective tier is the highest entitlement with `revoked_at` null.
- Anyone signed in is at least `free` (the free tier is "email required").
  Nobody signed out has a tier.
- The benchmark pack is yes/no: her own `benchmark_pack` entitlement, or a
  tier of `course` or above, which includes it. The webhook doesn't need to
  grant a pack row with the course, and a course refund takes the included
  pack away with it.
- A refund sets `revoked_at` on the order's entitlements; the next request
  sees the lower tier. Rows are never deleted.
- Idempotency: one order per `stripe_session_id`; one entitlement per
  (order, tier); one live hand grant per (user, tier).

## Notes on columns

- **Not in the spec, added:** `lessons.slug` (the URL), `modules.hidden` and
  `lessons.example` (both from SPEC.md → Content loading),
  `calc_runs.currency` (from Calculator specs), `orders.refunded_at`,
  `email_events.recipient` (generated; makes "one send per recipient per
  template" a unique constraint).
- **Renamed:** the spec's `order` on modules and lessons is `position`
  (`order` is a reserved word in SQL).
- `lessons.number` is text, as the course numbers them: `"0.1"`.
- `email_events.template` names the occasion as well as the email where one
  can recur: `onboarding_2`, `nudge_5`, `receipt:<order id>`.
- `orders.user_id` becomes null if she deletes her account (it's a sales
  record); everything else of hers is deleted with it.
- `products.places_sold <= places_total` is a check constraint: the
  database refuses a 31st founding place even if the app's checks fail.
- No tax or GST column exists anywhere; a test checks.

## Products

Seeded by the migration, prices from SPEC.md → Access tiers, in cents:

| slug             | tier             | AUD   | USD     | places |
| ---------------- | ---------------- | ----- | ------- | ------ |
| `product-check`  | `free`           | 0     | —       |        |
| `module-0`       | `module0`        | 4900  | not set |        |
| `course`         | `course`         | 25000 | not set |        |
| `founding`       | `founding`       | 34900 | not set | 30     |
| `benchmark-pack` | `benchmark_pack` | 2900  | not set |        |

The spec gives no USD prices, so `price_usd_cents` is null until the founder
sets them (SQL editor: `update public.products set price_usd_cents = … where
slug = '…'`). Checkout (step 5) must refuse USD for a product with no USD
price rather than invent one.
