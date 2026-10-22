# Data model

Migrations: `supabase/migrations/`. The local backend (`src/lib/data/local.ts`)
stores the same shapes in one JSON file. Domain types: `src/lib/domain`.

| Table               | Brief's model                  | Key columns                                                                                                                                                                                                                             | Who can write                                             |
| ------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `auth.users`        | User                           | id, email, created_at                                                                                                                                                                                                                   | Supabase Auth                                             |
| `business_profiles` | BusinessProfile + BrandProfile | facts (brand_name, category, audience, products_summary, personality, visual_style, colours, market, currency, goal, stage, fulfilment, verified_claims, prohibited_claims), `brand` (the Brand Blueprint, jsonb), logo_path, `version` | the owner                                                 |
| `profile_versions`  | (version history)              | profile_id, version, facts, brand, note                                                                                                                                                                                                 | trigger only (read-only to the owner)                     |
| `products`          | Product                        | name, category, materials, dimensions, colour_options, benefits, intended_use, customer_problem, price, care, shipping, verified_claims, image_notes, image_paths                                                                       | the owner                                                 |
| `generations`       | Generation                     | module, product_id, `version`, status, source (ai/mock/edit/restore), section, input_snapshot, output, warnings, error, model_version, profile_version                                                                                  | the owner for edits/restores; the server for model output |
| `launch_tasks`      | LaunchTask                     | task_key, category, label, status, notes                                                                                                                                                                                                | the owner                                                 |
| `purchases`         | (payment record)               | provider, external_purchase_id (unique), product_type, email, user_id, status, licence key, amounts                                                                                                                                     | server only; invisible to customers                       |
| `entitlements`      | Entitlement                    | product_type (`launch_pack` or `library:<slug>`), payment_provider, external_purchase_id (unique), status, expires_at                                                                                                                   | server only; read-only to the owner                       |
| `usage_ledger`      | UsageLedger                    | generation_id, module, operation, tokens, estimated_cost                                                                                                                                                                                | server only; read-only to the owner                       |
| `analytics_events`  | (analytics)                    | name, user_id, anonymous_id, props                                                                                                                                                                                                      | server only; invisible to customers                       |

## Rules the database enforces

- **Ownership.** Every customer row has `user_id`; RLS shows and changes only
  rows where `user_id = auth.uid()`.
- **No cross-tenant links.** Products, generations, tasks and history use a
  composite foreign key `(profile_id, user_id)` → `business_profiles(id,
user_id)`, so nothing can point at another customer's profile even if the
  API is called directly.
- **Versions.** `business_profiles.version` is bumped by trigger on every
  save, and a snapshot written to `profile_versions` with `last_note`.
  Generation versions are assigned by trigger per asset (profile, module,
  product) under an advisory lock.
- **Photos** must live under the owner's own storage folder.
- **At most five profiles** per account, whatever the app allows.
- **Deleting a login** cascades to everything she owns. Purchases keep the
  payment record with `user_id` set to null.

## Assets and versions

An asset is (profile, module, product?). Its current state is its highest
successful version. Edits, regenerations (whole or one section) and
restores each add a version; nothing is overwritten. Each generation keeps
the input snapshot that produced it — her profile and product facts, the
options, and which methodology version — and the profile version it read,
so the studio can say "made from older business details" and let her choose
whether to regenerate.

## Changing the schema

Add a new migration file (never edit an applied one), update this document,
then run `npm run test:rls`.
