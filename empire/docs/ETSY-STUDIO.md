# Etsy Studio — future implementation plan

**Build only when** Shopify Studio shows repeatable value (Phase C: sellers
use and re-use the assets) or there's clear demand (waitlist signups,
requests). Until then, don't.

## What changes, what doesn't

Reused unchanged: accounts, business profile, Brand Blueprint, versions,
editor, export, billing, analytics, claims guard, uploads.

New, as modules (each its own schema, generator and editor — the existing
pattern in `src/lib/domain/modules.ts`):

| Module                  | Output                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `etsy_listing`          | Title within Etsy's limit, 13 tags (max 20 characters each), description, attributes checklist, materials field — validated by schema |
| `etsy_shop_setup`       | Shop announcement, About section, policies checklist, shop sections                                                                   |
| `etsy_photo_briefs`     | Etsy's image ratios and listing-video brief (reuse `image_briefs` with an Etsy preset)                                                |
| `etsy_launch_checklist` | Etsy-specific tasks (billing, shop policies, processing times) as deterministic data                                                  |

Etsy-specific rules to put in the guard: no "handmade" claim unless true
under Etsy's policy; production-partner disclosure; no off-platform
contact prompts.

## Data model

Add `platform` (`shopify` | `etsy`) to `business_profiles` with a default of
`shopify`, and new module keys in the `generations.module` check. No new
tables.

## Pricing

A separate one-time "Etsy Launch Pack", or add Etsy to a future Studio
subscription — decide from Phase C data, not up front.

## Later: Etsy API

Etsy's Open API v3 (OAuth, listing drafts) follows the same approval-first
pattern as `SHOPIFY-INTEGRATION.md`: read with permission, create drafts,
never publish without explicit approval.

## Effort

About 1–2 weeks once Shopify modules are stable: schemas and prompts,
mock generators and tests, checklist data, a platform switch in onboarding.
