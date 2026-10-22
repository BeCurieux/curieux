# Future Shopify integration — architecture

**Not built in version one, on purpose.** The brief: no broad permissions,
no automatic theme publication. This is the shape it should take when real
customers have proven the copy-and-paste version (brief Phase E).

## Principles

1. **Least privilege.** Request only the scopes a feature needs, at the
   moment it's needed.
2. **Draft, then approve.** Every write is prepared as a draft the merchant
   reviews in Empire Studio and approves explicitly. Nothing is published
   automatically.
3. **Reversible.** Keep what was there before each change so it can be
   restored.
4. **Clean exit.** Uninstalling revokes tokens and deletes Shopify data we
   hold; the `app/uninstalled` and GDPR webhooks are implemented on day one.

## Phased scopes

| Phase | Feature                                         | Scopes                                                                                         |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| E1    | Import products into Product Writer             | `read_products`                                                                                |
| E2    | Save listings back as drafts (description, SEO) | `write_products`, applied only to fields she approves                                          |
| E3    | Prepare theme copy (homepage text)              | `read_themes`, `write_themes` — **only on an unpublished duplicate theme**, never the live one |

## Components

```
Empire Studio ─ OAuth (Shopify app, embedded optional)
   │
   ├─ shopify_connections (user_id, shop_domain, encrypted access token, scopes, installed_at, revoked_at)
   ├─ shopify_change_requests (id, user_id, generation_id, target: product|theme, payload, before_snapshot,
   │                          status: draft|approved|applied|failed|reverted, approved_at, applied_at)
   └─ worker: applies approved requests via the Admin GraphQL API; stores before_snapshot; logs result
```

- Tokens encrypted at rest (pgsodium/Vault or KMS), service-role access only,
  RLS on both tables.
- Change requests are created from a generation version, so every applied
  change traces back to the exact copy and its input snapshot.
- Rate-limit aware worker with retries; failures surface on the request.
- Approval UI shows a before/after diff per field.

## Distribution

Research separately before building: public App Store listing requirements
(review, GDPR webhooks, billing through Shopify for app charges) versus a
custom/unlisted app. Shopify's app billing rules may affect how the Pro tier
is charged.

## Pro tier

Only once E1–E2 save merchants real time, measured. A US$99/month Pro needs
substantive automation (sync, bulk drafts, reporting), not a prompt library.
