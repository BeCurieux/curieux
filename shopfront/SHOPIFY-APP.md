# The Shopify app

A design for the installable version: OAuth, the GraphQL Admin API and webhooks,
so a merchant's catalogue stays current without anybody pasting a URL.

**Status: design, plus a small offline core that is built and tested.** No app
exists. Nothing here has been run against Shopify. The parts that could be
written and tested without a network were written and tested and are listed in
"What is built" at the end; everything else is a proposal.

---

## 0. The position this document takes

Three things are decided up front, because the rest only makes sense in their
light.

**The app is an upgrade path, not a replacement.** `pnpm ingest` reads a public
`/products.json` with no credentials, and that is not a stopgap standing in
until OAuth arrives. It is what lets a shop be built for a merchant who has
agreed to nothing, which is the entire kill-test motion and the entire sales
motion. A design that deletes it, or that makes the public path the degraded
one, is the wrong design. Everything below is arranged so that the public path
stays first-class: same output type, same tables, same renderer, and an
app-backed store that loses its token **falls back to the public feed** rather
than going dark.

**The app is not the front door.** OAuth-first inverts the kill test — you
cannot show a merchant their own shop until they install, and "install this app
and then I'll show you something" is a different and much worse conversation
than "here is your shop, want it live?". Section 8 takes this seriously; the
short version is that installation is the *conversion* event, never the entry.

**This should not be started past stage 0 until the kill test has run.** The
app's whole value — "your catalogue stays current" — is a retention feature for
merchants who have already said yes. The kill test is the experiment that finds
out whether any merchant says yes. Building install plumbing for zero installs
is the precise failure mode step 7 exists to prevent. Section 9 argues this
properly.

---

## 1. What could be verified, and how

The brief for this work said to verify the constraints rather than assume them.

**Network.** Checked directly from this environment:

| Host | Result |
|---|---|
| `shopify.dev` | `CONNECT tunnel failed, response 403` — refused at the egress proxy |
| a public storefront `/products.json` | same 403 |
| `api.anthropic.com` | reachable (405 to a bare GET, which is the expected answer) |
| `registry.npmjs.org` | reachable |

So: no `shopify app dev`, no OAuth round trip, no Admin API call, no webhook
delivery. That is the constraint the code below is shaped around, and it is why
every module here takes its transport, its clock and its storage as arguments.

**Documentation, unexpectedly, yes.** This session has a Shopify MCP server
attached whose documentation tools reach shopify.dev's search index and the
Admin GraphQL schema's introspection endpoint even though direct HTTP to
shopify.dev is blocked. That is a real source and it has been used heavily:
almost every factual claim below is quoted from a shopify.dev page returned by
that index, or read off live schema introspection, and each is cited.

Two honest limits on that source, which apply to every "verified" mark in this
document:

- It is a **relay**, not a fetch. The URLs cited were returned by the index
  alongside their text; they could not be opened to confirm the text is still
  on the page. A stale index would look exactly like a current one from here.
- It documents **stated** behaviour. That an endpoint is documented to return
  `expires_in: 3600` is not evidence that it does. Nothing below has been
  observed.

Anything that is neither cited nor observed is marked **[unverified]** inline,
and section 10 is the full register.

---

## 2. Gap analysis

### 2.1 What the app reuses unchanged

This is the good news, and it is most of the system. The ingester was built
against a contract rather than against an endpoint, and the contract holds.

| Reused | Why it survives |
|---|---|
| `IngestResult` / `Catalogue` / `IngestedProduct` (`lib/ingest/types.ts`) | The output type is a description of a catalogue, not of `/products.json`. An Admin API response maps into it. This is the single load-bearing reuse: everything downstream takes `Catalogue`. |
| `parseMoney` (`lib/ingest/products.ts`) | Admin `Money` is a decimal string; `parseMoney`'s string branch already handles exactly that, and its type-not-magnitude rule is the thing that stops the hundredfold pricing bug on either surface. |
| `htmlToText` (`lib/ingest/html.ts`) | Admin `descriptionHtml` is the same HTML the public feed's `body_html` carries. |
| The Catalogue Genome, whole | It reads a `Catalogue`. It does not know or care where one came from. |
| The merchandiser, whole | Same. `merchandise(ingest, prompt)` takes an `IngestResult`. |
| The renderer, `resolve.ts`, `theme.ts` | Take a `ShopConfig` and a `Catalogue`. Untouched. |
| `lib/smart` (drift / decide / repair) | Compares two catalogues' worth of stock facts. An app-fed catalogue drifts the same way a re-ingested one does — **this is what makes webhooks cheap**: the mending logic already exists and refresh becomes event-driven rather than command-driven. |
| `stores` / `shops` / `shop_versions` / `shop_events` | See §3. Kept as they are. |
| `ShopStore` (`lib/publish/store.ts`) | The persistence seam. New tables go behind it or beside it; nothing above it learns a new word. |
| The funnel, whole | Untouched, and deliberately: see §7.3. |
| `lib/cart/permalink.ts` | Still a permalink to the merchant's own checkout. The app does not move the money. **But see the `legacyResourceId` finding in §2.3 — this is where the app can silently break it.** |

The claim worth stating plainly: **an app-backed store produces the same
`Catalogue` a public ingest produces, and everything above `Catalogue` is
unaware which happened.** Stage 1's exit condition (§6) is exactly this claim,
tested against a real store, because it is the assumption the whole design rests
on and it is the one thing here that cannot be checked offline.

### 2.2 What has to be new

| New | What it is |
|---|---|
| `lib/shopify/hmac.ts` | Webhook signature verification. **Built.** |
| `lib/shopify/webhook.ts` | Delivery envelope: headers → a validated `WebhookDelivery`, staleness. **Built.** |
| `lib/shopify/idempotency.ts` | Duplicate suppression and out-of-order defence. **Built.** |
| `lib/shopify/token.ts` | Expiring-token lifecycle: skew, refresh, death. **Built.** |
| `lib/shopify/admin/client.ts` | Admin GraphQL client behind an interface, transport injected. **Built.** |
| `lib/shopify/admin/catalogue.ts` | Admin `products` connection → `Catalogue`. **Built, shape unverified.** |
| `app/api/shopify/webhooks/route.ts` | The HTTP endpoint. Needs a running app. Not built. |
| An install / callback route, session handling | Needs Shopify. Not built. |
| `shopify.app.toml`, an app in the Dev Dashboard | Needs an account. Not built. |
| Token encryption at rest | Needs a key management decision. Not built; §4.4. |
| Three new tables | §3.2. Not built. |
| Backfill + reconciliation job | §5.5. Not built. |

### 2.3 What has to change, and two of these are not obvious

**`stores` gains a provenance column, and `stores.catalogue` gains a version.**
§3.1.

**`lib/claims.ts` stops being a global rule and becomes a per-store
capability. This is the subtle one.** The first banned claim is:

```
/\b(synced?|syncing|in sync|auto-?updat\w*|always up to date|live inventory|real-?time|updates? automatically)\b/i
why: "claims the shop syncs with the store. It does not yet — nothing on the page may say it does"
```

The reason is `it does not yet`. For an app-backed store it *does*, and the ban
becomes wrong — a merchant who installed the app precisely so their shop would
stay current cannot have the page say so. But the ban must stay absolute for
public-path stores, and it must **come back the moment the app is
uninstalled**, which is a state change that happens without anybody
regenerating the shop.

So the rule is not "delete the pattern". It is: the sync claim is gated on a
capability the *store* has, checked at render time and not at merchandise time,
because merchandise time is hours or weeks before the uninstall. Concretely,
`ShopRenderInput` carries a `syncing: boolean` derived from the store's live
installation state, the renderer suppresses any sync language when it is false,
and the merchandiser may only emit that language for a store that has the
capability at the time it runs. Two gates, because this is a claim about
somebody else's shop and the failure mode — a page telling a merchant it is
live when their token died three weeks ago — is exactly the dishonesty the
brief rules out.

That is a real piece of new work, it is not obviously part of "add OAuth", and
it should be built in the same stage as uninstall (§6, stage 4), never before.

**`legacyResourceId`, or the cart permalink quietly 404s.** Verified by live
introspection of the Admin schema: `ProductVariant.id` is a
`gid://shopify/ProductVariant/45779434701121`, and `ProductVariant`
separately exposes `legacyResourceId: UnsignedInt64!`, "The ID of the
corresponding resource in the REST Admin API."

`IngestedVariant.id` is documented as *"Stringified: Shopify variant ids are
64-bit and JSON numbers are not"* and is the numeric id the public feed gives.
`lib/cart/permalink.ts` builds `/cart/<variantId>:1` from it, and the repo
already refuses to build a permalink from a non-numeric variant id — *"A
permalink built on a guess is a 404 where a purchase should be."*

A mapper that put the gid in `IngestedVariant.id` would therefore not crash. It
would produce a catalogue where every product silently falls back to its product
page instead of a pre-filled cart, on every app-backed shop, and the existing
guard would report it as correct behaviour. The mapper built here takes
`legacyResourceId`, and there is a test asserting the mapped id is numeric and
that a permalink survives it.

---

## 3. The data model

### 3.1 Reuse `stores`, `shops`, `shop_versions`. Do not add a product cache.

The instinct is a normalised `shopify_products` / `shopify_variants` cache
mirroring the Admin API. That is the wrong shape here, for one reason: **nothing
in this system reads products relationally.** The renderer resolves by handle
out of a `Catalogue`; drift compares two `Catalogue`s; the merchandiser is
handed one. A relational cache would be a second representation of the same
facts, and the job of keeping it agreeing with the one everything actually reads
is pure cost.

So the product cache is `stores.catalogue`, unchanged — the same `Catalogue`
JSON the public ingester writes today. An app-backed store and a public store
are the same row shape, and a shop can move from one to the other without being
regenerated.

`stores` gains three columns:

```sql
alter table public.stores add column if not exists source text not null default 'public'
  check (source in ('public', 'app'));
alter table public.stores add column if not exists shop_domain text unique;   -- '<shop>.myshopify.com'
alter table public.stores add column if not exists catalogue_version bigint not null default 0;
```

`source` is what the sync-claim capability in §2.3 reads. `shop_domain` is how a
webhook finds the row it has to update — the delivery names the shop, not our
store id. `catalogue_version` is the concurrency control, and it is the real
cost of this decision:

**A `products/update` webhook is a read-modify-write of a whole catalogue blob.**
Two deliveries for the same store racing each other will lose one edit. So every
webhook-driven mutation is a compare-and-set on `catalogue_version` with a
bounded retry, and deliveries for one store are **coalesced**: a short debounce
window collects everything that arrived, then one read-modify-write applies them
together. A merchant bulk-editing 400 products produces one write, not 400
conflicts.

The honest limit: this is fine for catalogues in the hundreds and for the edit
volume a small merchant produces, and it will not hold for a large or
frequently-bulk-edited catalogue. Normalising is the escape hatch, and the
trigger for taking it is measurable — sustained CAS retry rates, or a debounce
window that stops draining. It should not be taken pre-emptively; a second
representation built for load that never arrives is worse than the contention it
prevents.

### 3.2 Three new tables

```sql
-- One row per (app, shop). The installation is the merchant relationship;
-- `stores` remains the catalogue, and the two are separable because a store can
-- exist with no installation (public path) — which is the normal case.
create table if not exists public.shopify_installations (
  id                   uuid primary key default gen_random_uuid(),
  shop_domain          text not null unique,         -- '<shop>.myshopify.com'
  shop_gid             text,                          -- 'gid://shopify/Shop/…'
  store_id             uuid references public.stores(id) on delete set null,

  -- Encrypted at rest. Never selectable by an anon key: no RLS policy on this
  -- table at all, same as `stores`. See §4.4 for what "encrypted" must mean.
  access_token_enc     bytea not null,
  refresh_token_enc    bytea,
  access_expires_at    timestamptz,                   -- null = non-expiring (legacy)
  refresh_expires_at   timestamptz,

  scopes               text[] not null default '{}',  -- as granted, not as requested
  api_version          text not null,

  state                text not null default 'active'
    check (state in ('active', 'needs_reauth', 'uninstalled')),
  installed_at         timestamptz not null default now(),
  uninstalled_at       timestamptz,
  updated_at           timestamptz not null default now()
);

-- The idempotency ledger. One row per *delivery*, not per event.
create table if not exists public.shopify_webhook_deliveries (
  webhook_id   text primary key,          -- X-Shopify-Webhook-Id
  event_id     text,                      -- X-Shopify-Event-Id
  topic        text not null,
  shop_domain  text not null,
  triggered_at timestamptz,               -- X-Shopify-Triggered-At
  received_at  timestamptz not null default now(),
  status       text not null check (status in ('processing', 'done', 'failed'))
);
create index if not exists shopify_webhook_deliveries_received_idx
  on public.shopify_webhook_deliveries(received_at);

-- Per-installation sync bookkeeping. Separate from the installation because it
-- churns and the installation does not.
create table if not exists public.shopify_sync_state (
  installation_id  uuid primary key references public.shopify_installations(id) on delete cascade,
  backfill_cursor  text,                  -- GraphQL end cursor, null when complete
  backfill_done_at timestamptz,
  -- The high-water mark for out-of-order defence: the newest product
  -- `updatedAt` this store has applied. See §5.4.
  watermark        timestamptz,
  last_synced_at   timestamptz,
  updated_at       timestamptz not null default now()
);
```

Three notes on shape.

**The installation is not the store.** A merchant can have a store row with no
installation (every kill-test merchant), and an installation whose store row is
still being backfilled. Folding them together would make "we have a catalogue
for this merchant" and "this merchant has agreed to something" the same
question, and they are emphatically not.

**`scopes` records what was granted, not what was asked for.** `app/scopes_update`
exists because those can differ and can change after install; an app that
assumes its requested scopes is an app that discovers otherwise via a 403.

**The delivery ledger is keyed on `webhook_id`, not `event_id`.** Verified:
*"If you have more than one subscription for the same topic, you'll receive a
separate delivery per subscription. Each has a different `X-Shopify-Webhook-Id`
but shares the same `X-Shopify-Event-Id`. Use `X-Shopify-Webhook-Id` to
deduplicate individual deliveries. Use `X-Shopify-Event-Id` to correlate
deliveries that originated from the same merchant action."*
([verify-deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries))
Keying on `event_id` would drop the second subscription's delivery, which is a
bug that only appears once a second subscription exists.

Retention: rows older than the retry window plus a margin are prunable. Shopify
retries *"8 times over 4 hours"*
([changelog](https://shopify.dev/changelog/updates-to-webhook-retry-mechanism)),
so nothing older than about a day can still arrive as a retry — but deliveries
can be *delayed*, and the docs warn about *"receiving webhooks up to a day
late"* ([troubleshoot](https://shopify.dev/docs/apps/build/webhooks/troubleshoot)).
Seven days is a cheap margin.

---

## 4. Auth and the token lifecycle

### 4.1 Which flow

Verified. Shopify's own table of supported flows says that for an app rendered
in the Shopify admin, installation should be **Shopify managed installation
(recommended)** and token acquisition should be **token exchange (recommended)**,
and: *"Whenever possible, you should create apps rendered in the Shopify admin
that use Shopify managed installation and token exchange."*
([authentication-authorization](https://shopify.dev/docs/apps/build/authentication-authorization))
Managed install means declaring scopes in the app's TOML via the CLI so Shopify
handles the grant screen; the documented alternative is *"a degraded user
experience"*.

So: **managed install + token exchange**, not a hand-rolled authorization code
grant. The authorization code grant stays documented here only because it is the
fallback for a standalone (non-embedded) surface, and there is an open question
in §8 about whether popuup's merchant-facing surface is embedded at all.

Token exchange trades a session token for an access token
([token-exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange)):

```
grant_type            urn:ietf:params:oauth:grant-type:token-exchange
subject_token         {session token}
subject_token_type    urn:ietf:params:oauth:token-type:id_token
requested_token_type  urn:shopify:params:oauth:token-type:offline-access-token
expiring              1
```

### 4.2 Offline, and expiring

**Offline**, not online: the whole point is that a catalogue stays current while
nobody is logged in. An online token is scoped to a user session and is the
wrong instrument for a background sync.

**Expiring**, because the documentation is explicit that this is now the
direction for new installs — the migration guide's step 3 reads: *"Step 3: Start
requesting expiring offline tokens. For new installs, start acquiring expiring
offline tokens, and persist the refresh token for refreshing."*
([offline-access-tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens))

The documented response shape, quoted verbatim from that page:

```json
{
  "access_token": "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 3600,
  "refresh_token": "shprt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "refresh_token_expires_in": 7776000,
  "scope": "write_products,read_orders"
}
```

One hour and ninety days. **[unverified]**: that these are the values a real
exchange returns, rather than an illustrative example in the docs. The code
built here therefore does not hardcode either number — it reads `expires_in` off
the response and treats a missing value as "non-expiring", which is also the
legacy shape.

The brief asked to be explicit about what could and could not be confirmed here.
Confirmed: expiring offline tokens exist, are requested with `expiring=1` on
both token exchange and the authorization code grant, return a `shprt_` refresh
token, and are what new installs are told to use. Not confirmed: the actual
lifetimes, the exact error shape when a refresh token has expired, and whether
`expires_in` is ever absent from an expiring-token response.

### 4.3 The state machine

```
                    token exchange
   (no install) ──────────────────────▶ active
                                          │
                          access token expiring soon
                                          │  refresh
                                          ▼
                                        active
                                          │
                    refresh fails / refresh token expired
                                          │
                                          ▼
                                    needs_reauth ──── merchant opens app ──▶ active
                                          │
                                  app/uninstalled
                                          ▼
                                    uninstalled
```

Two rules make this safe.

**Refresh ahead of expiry, with skew.** Never "call, get a 401, then refresh" as
the primary path — that spends a failed request on every cycle and turns a clock
skew into an outage. Refresh when the token is inside a skew window of expiry
(the built code defaults to five minutes and takes the clock as an argument). A
401 still triggers one refresh-and-retry, because the proactive path cannot
cover a token revoked out from under us.

**`needs_reauth` is not an outage.** The refresh token expires (ninety days, per
the doc above), and a merchant who has not opened the app in that time has an
installation that cannot be refreshed without merchant interaction — the doc is
explicit that re-acquiring requires it. This is where §0's first principle pays
for itself: an installation in `needs_reauth` **falls back to the public
ingester**. The store keeps refreshing from `/products.json`, the shop stays
current-ish, the sync capability (§2.3) drops so the page stops claiming
liveness, and the merchant gets a prompt rather than a dead shop. The public
path being first-class is what makes token death a degradation instead of an
incident.

### 4.4 Secrets

Tokens are merchant credentials to somebody else's store and they get the
treatment `SUPABASE_SERVICE_ROLE_KEY` gets and then some.

- No RLS policy on `shopify_installations`, matching `stores`. The anon key
  cannot reach the table at all; there is no `security definer` function that
  returns any part of it.
- Encrypted at rest under a key that is **not** in the same database — otherwise
  the column encryption buys nothing against the failure it exists for.
  Envelope encryption with the key in the platform's secret store, which for
  the fixed stack means a Vercel environment variable, and rotation means
  re-wrapping rather than re-authorising every merchant. **This decision is not
  made here** and it should not be made without asking: it is the one piece of
  the design that touches the fixed stack (§CLAUDE.md, "No other services
  without asking") and a KMS is a service.
- Never logged, never in a trace entry, never in an error message. The ingest
  `diagnostics.trace` is written to `.cache/` in plaintext and is the obvious
  place a token would leak into by accident.
- The client secret used for HMAC is the same secret used to mint tokens; the
  docs note *"Shopify's Global app model uses one shared secret for both OAuth
  token minting and webhook HMAC signing."*
  ([monitor-orders](https://shopify.dev/docs/agents/get-started/monitor-orders))
  One secret, two uses, one blast radius.

---

## 5. Webhooks

### 5.1 Topics

Minimal, and every one of them earns its place.

| Topic | Why | Scope |
|---|---|---|
| `products/create` | A new product should be eligible for a refresh's consideration | `read_products` |
| `products/update` | The one that matters: price, stock, title, variants. *"Occurs whenever a product is updated, ordered, or variants are added, removed or updated."* | `read_products` |
| `products/delete` | A delisted product is what `drift.ts` weights double; a stale card is a dead link on a merchant's bio | `read_products` |
| `app/uninstalled` | Revoke immediately, degrade to public, drop the sync claim | — |
| `app/scopes_update` | Granted scopes can change after install | — |
| `customers/data_request` | Mandatory | — |
| `customers/redact` | Mandatory | — |
| `shop/redact` | Mandatory | — |

Product topics and their `read_products` requirement verified against the
`WebhookSubscriptionTopic` enum
([admin-graphql](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/WebhookSubscriptionTopic)).
The three compliance topics are verified as mandatory for App Store
distribution: *"Every app that's distributed through the Shopify App Store must
subscribe to the following compliance webhook topics"*
([privacy-law-compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)).

Not subscribed, deliberately: `inventory_levels/update`. It carries the same
fact `products/update` already carries for our purposes (can this be bought),
at a far higher volume, and it needs `read_inventory` — a scope for a
finer-grained number than any part of this system renders.

### 5.2 HMAC

Verified, and quoted because the details matter:

> Each HTTPS delivery includes a base64-encoded HMAC signature in the
> `X-Shopify-Hmac-SHA256` header, generated using your app's client secret and
> the raw request body. Verify this signature before processing to confirm the
> delivery came from Shopify.
> — [verify-deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)

> To validate manually, compute HMAC-SHA256 of the raw request body using your
> app's client secret as the key, then compare it to the decoded header value.
> Reject any delivery where the signatures don't match.

Four implementation points, three of which are the ways this is normally got
wrong:

1. **Raw body.** Compute over the bytes as received, before any JSON parse. A
   framework that parses and re-serialises will change the bytes and every
   signature will fail. In Next's App Router that means `await request.text()`
   and parsing afterwards, never `request.json()` first.
2. **Constant time.** `crypto.timingSafeEqual`, never `===`.
3. **Length check first.** Shopify's own sample says so explicitly: *"The length
   check before `timingSafeEqual` is required. In Node, the function throws on
   buffers of differing lengths, so without it a malformed signature would
   surface as a 500 error instead of a clean rejection."*
   ([monitor-orders](https://shopify.dev/docs/agents/get-started/monitor-orders))
   A 500 on a bad signature is also a worse answer than a 401 for the reason in
   point 4.
4. **401, specifically.** Not 400, not 200. App review requires it: *"If a
   mandatory compliance webhook sends a request with an invalid Shopify HMAC
   header, then the app must return a 401 Unauthorized HTTP status."*
   ([privacy-law-compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance))

Also verified and worth designing around: *"If you rotate your app's client
secret, it can take up to an hour for the HMAC digest to be generated using the
new secret."* So the verifier accepts a **set** of candidate secrets, not one,
and a rotation means running both for an hour. The built code takes
`secret: string | string[]` for this reason.

### 5.3 Idempotency

Verified: *"Shopify minimizes duplicate deliveries, but your app might receive
the same webhook more than once, for example after a network timeout or a retry.
Process webhooks using idempotent operations… If your processing isn't
idempotent, use the `X-Shopify-Webhook-Id` header to detect and skip
duplicates."*

The design does both, because they defend different things:

- **The operations are idempotent by construction.** A `products/update`
  delivery carries the product's full current state, and applying it is a
  replace-by-handle into the catalogue, not a delta. Applying it twice is
  applying it once. This is the primary defence and the one that survives the
  ledger being wrong.
- **The ledger is the secondary defence**, keyed on `webhook_id` (§3.2), and it
  exists mostly to stop redundant *work* — a duplicate delivery that would
  otherwise cost a catalogue read-modify-write and an Admin API call.

The ledger has a failure mode worth naming: a row inserted as `processing` by a
handler that then dies leaves a delivery that will never be retried past its
window and never completed. So `processing` rows older than the request timeout
are treated as absent, not as done. The built `DeliveryLog` interface makes this
the storage layer's decision rather than burying it.

### 5.4 Ordering

**Ordering is not guaranteed, and the design must not assume it.** This is the
one significant claim in this section not backed by a direct quotation — the
docs are emphatic about the *consequence* without stating the rule as such:

> Treat the latest delivery as truth. Every payload is the full current state.
> Don't merge or replay events from previous deliveries.
> — [order-webhooks](https://shopify.dev/docs/agents/orders/order-webhooks)

and, on delay:

> You might experience delays receiving webhooks. If receiving webhooks up to a
> day late might cause issues in your app, then compare the timestamp of the
> webhook to the current date and time.
> — [troubleshoot](https://shopify.dev/docs/apps/build/webhooks/troubleshoot)

and the retry mechanism changelog: *"When webhooks are retried, they will be
delivered with the original payload from the time they were triggered. Partners
should utilize the `X-Shopify-Triggered-At` timestamp in the header, or a
timestamp from the payload, to determine if the payload is stale."*

An eight-times-over-four-hours retry that replays the *original* payload is a
mechanism that will deliver a stale product state after a newer one has already
landed. So: **[unverified as a stated rule, but forced by the documented retry
behaviour]** — treat deliveries as unordered.

The defence is a watermark, and it has to be per-resource rather than per-store:

- Each product carries `updatedAt` from the payload. A delivery whose
  `updatedAt` is **older than the version already in the catalogue for that
  handle** is dropped. That is the correct comparison, because it is a fact
  about the resource rather than about the transport.
- `X-Shopify-Triggered-At` is the fallback when a payload has no usable
  timestamp, and is also what a staleness *warning* is measured against.
- The per-store `watermark` in `shopify_sync_state` is not for ordering — it is
  the reconciliation bookmark (§5.5).

A `products/delete` has no newer state to compare against, so it is applied
unconditionally and a subsequent late `products/update` for a deleted handle is
dropped by handle-not-present rather than by timestamp.

### 5.5 Reconciliation, because webhooks are not a guarantee

Verified: after eight consecutive failures *"the subscription is automatically
deleted if it was configured using the Admin API"*, and the troubleshooting page
lists *"Removed webhooks — Your app isn't receiving data for subscriptions
removed after multiple failed delivery attempts"* as a thing to look for. Also
verified: the response deadline is *"a five-second timeout for the entire
request"*, with a one-second connection timeout.

Two consequences:

- **Respond first, work later.** The route verifies HMAC, records the delivery,
  returns 200, and hands the payload to a queue. Doing a catalogue
  read-modify-write inline is how a busy merchant's bulk edit turns into eight
  failures and a deleted subscription.
- **A periodic full reconciliation is not optional.** A nightly (or on-open)
  sweep querying products with `updated_at:>{watermark}` and applying anything
  missed. The docs recommend exactly this: *"A common practice is to also build
  a reconciliation job that periodically retrieves data you might have missed
  using Shopify APIs."* This is what `shopify_sync_state.watermark` is for.

### 5.6 Uninstall

`app/uninstalled` is the important one and it does five things, in order:

1. Mark the installation `uninstalled`.
2. **Delete the tokens now**, not on `shop/redact`. They are dead the moment the
   app is uninstalled and holding a dead credential is pure liability.
3. Flip `stores.source` back to `'public'` — so `pnpm refresh` and the whole
   public path resume for that merchant, and a published shop keeps working.
4. **Drop the sync capability**, so the page stops claiming liveness (§2.3).
   This is the honesty-rule consequence and it is the one that would be easiest
   to forget.
5. Leave the shop published. A merchant who uninstalls has not asked for their
   bio link to 404.

`shop/redact` arrives *"48 hours after a shop uninstalls your app"*
([changelog](https://shopify.dev/changelog/apps-now-need-to-use-a-new-gdpr-webhook))
and asks for customers' personal data to be erased. We hold none — see §7.3 —
so the honest handler acknowledges with a 200 and deletes the installation row.
`customers/data_request` and `customers/redact` are the same: implemented,
HMAC-verified, 401 on a bad signature, 200 on a good one, nothing to hand over
and nothing to erase. They are mandatory *"regardless of whether the app
collects personal data"*, and the compliance deadline is *"within 30 days"*.

---

## 6. Scopes

**`read_products`. That is the whole request.**

| Scope | What it buys | What it costs |
|---|---|---|
| `read_products` | Products, variants, media, options; and the three product webhook topics, which all require exactly this scope | One line in the install modal's Data Access section. No protected-customer-data review. |

And the ones deliberately not requested:

| Not requested | Why not |
|---|---|
| `write_products` | Nothing in this system writes to a merchant's store. The renderer builds a page; the checkout is a permalink back to them. Asking for write access we never use is the clearest possible signal that the app is not minimal — and the App Store requirements say *"You may be requested to provide proof that the access scopes you've requested are required for your app to function properly."* |
| `read_orders` | Protected customer data, a review burden, and — separately and more importantly — **an outcome**. Order data read back into merchandising is the drawer (CLAUDE.md), and the cheapest way to guarantee it never happens is to be unable to see it. |
| `read_customers` | Same, plus it is the scope that turns the compliance webhooks from a formality into a real obligation. |
| `read_inventory` | §5.1. A finer-grained number than anything rendered. |
| `read_content` / theme scopes | Brand context — name, logo, colours, voice — already comes off the public homepage at no scope cost. The ingester's `brand.ts` works on an app-backed store exactly as it does now. |

**On protected customer data.** Avoiding it entirely at this stage is the right
trade and it is not close. The cost of touching it is a review process with its
own approval, ongoing obligations, and — verified — enforcement that has been
tightening: as of *December 10th, 2025*, web pixel payloads null out customer
PII fields for apps not approved for the corresponding scopes
([changelog](https://shopify.dev/changelog/protected-customer-data-scopes-required)),
and Level 1 approval became a requirement for the Customer Account API in 2024.
The benefit at this stage is zero, because there is no feature that wants it:
email capture is still behind the step-7 gate, and order-derived merchandising
is behind the drawer rule and is meant to stay there.

The one thing worth flagging for later: back-in-stock capture, named in CLAUDE.md
as a paid feature, will want customer contact data and will drag protected
customer data with it. That is a decision for whoever builds it, and it should
be made knowing it changes the app's review class.

---

## 7. Three boundaries this must not cross

### 7.1 The public path stays first-class

Restated as a checkable rule rather than an intention: **nothing under
`lib/ingest` may import from `lib/shopify`.** The ingester does not learn about
installations, tokens or app-backed stores. The app maps *into* the ingester's
output type and depends on it one-way. That is what keeps `pnpm ingest
<any-url>` working for a merchant who has agreed to nothing, and it is enforced
in `tests/stop-line.test.tsx` rather than remembered (§11).

### 7.2 The renderer does not learn a new word

An app-backed shop and a public shop are the same `ShopConfig` and the same
`Catalogue`. The only difference the renderer may observe is the sync capability
of §2.3, and that is one boolean that suppresses a claim.

### 7.3 The drawer stays shut

The app reads a catalogue. It does not read orders, it does not read customers,
and nothing it learns reaches a merchandising decision. `read_products` is the
scope-level enforcement of this; `lib/smart` not importing the funnel is the
code-level enforcement, and both stay.

Worth stating because the app makes the temptation concrete: with the Admin API
in hand, "sort the grid by what actually sold" is one query away and it is
exactly the learned weight the drawer holds. The scope minimisation in §6 is not
only a review-burden argument.

---

## 8. Risks

**The sales-motion inversion, which is the real one.** The kill test works
because a shop can be built for a merchant who has agreed to nothing: ingest
their public catalogue, generate the shop, send them a link, ask if they want it
live. OAuth-first destroys that — "install my app and then I'll show you
something" is asking for consent before delivering value, and it is a
categorically worse conversation.

**The position: the app is never the entry.** Concretely —

- The demo is always built from the public path. Always. There is no flow where
  a merchant must install anything to see their own shop.
- Installation is the **conversion event**: it is what "yes, make it live"
  means, and it happens after the shop exists and the merchant has seen it.
- Therefore stage 1's exit condition (below) is load-bearing beyond testing: a
  public-path store and an app-backed store must produce the same `Catalogue`,
  because the merchant journey is *public shop → merchant says yes → install →
  same shop, now maintained*. If installing regenerated the shop, the merchant
  would say yes to one page and get another.

This also reorders the roadmap: **the app is a retention feature, and it should
be built when there are merchants to retain.**

**The other risks, briefly.**

| Risk | Shape | Mitigation |
|---|---|---|
| App review | Submission is a gate with its own latency and rejection modes, none of which are on our schedule | Minimal scopes (§6), compliance webhooks from stage 4, no protected customer data |
| Refresh-token death | 90 days of merchant inactivity kills an installation | Degrade to public (§4.3) rather than break |
| Hot-row contention | Catalogue-blob CAS under bulk edits | Coalesce + bounded retry; normalise only on measured pressure (§3.1) |
| Deleted subscriptions | Eight failures removes the subscription silently | Reconciliation sweep is mandatory, not a nice-to-have (§5.5) |
| False sync claim | A page saying "live" for a store whose token died | Capability checked at render time, not merchandise time (§2.3) |
| Secret blast radius | One client secret signs webhooks and mints tokens | Rotation support in the verifier (§5.2); the one-hour rotation window is designed for |
| API version drift | Quarterly releases, 12-month support, *"at least nine months of overlap"* ([versioning](https://shopify.dev/docs/api/admin-rest/usage/versioning)) | Pin explicitly, never rely on the default; version stored per installation so a migration can be staged |
| The public path itself | A merchant can disable `/products.json`, and this is the actual argument *for* the app existing | Which is why the app is worth building — eventually |

---

## 9. The staged plan

Ordered so the earliest stage is useful on its own, and so the stage that tests
the biggest unverified assumption comes first among the stages that need
Shopify.

### Stage 0 — the offline core · **done, in this commit**

HMAC verification, the delivery envelope, idempotency and ordering defence,
token lifecycle, an Admin client behind an interface, and the catalogue mapper.
No routes, no credentials, no app, no persistence.

**Exit condition — met:** `pnpm test`, `pnpm typecheck` and `pnpm build` pass;
nothing under `lib/ingest` imports `lib/shopify`; the public path is byte-for-byte
unchanged.

*Useful on its own?* Marginally — as a design artefact and as the thing that
makes stage 1 a day rather than a week. This is the honest weakest link in the
"each stage is useful alone" ordering, and it is why stage 0 is small.

### Stage 1 — one real store, one real query, nothing persisted

An app in a dev store, managed install, token exchange, and a single Admin
`products` query mapped through `catalogue.ts`. No webhooks. No database. A
CLI flag, not a route.

**Exit condition:** for one real store, the app-backed `Catalogue` and the
public-path `Catalogue` for the same store agree on handles, variant ids
(numeric — §2.3), prices, availability and image URLs. Differences that are real
(draft products, unpublished variants) are enumerated and explained rather than
smoothed over.

*Useful on its own:* **yes, and it is the most valuable single stage in this
plan.** It is the only thing that converts §2.1's central assumption from a
design claim into a fact, and it needs no persistence, no webhooks and no
review to do it. If it fails, most of this document is wrong and it is far
cheaper to find out here.

### Stage 2 — persistence and backfill

`shopify_installations`, `shopify_sync_state`, token storage, and a paginated
backfill into `stores.catalogue` with `source: 'app'`.

**Exit condition:** install on a dev store → full catalogue in `stores` →
`pnpm merchandise` → a rendered shop, with no public ingest involved. And the
inverse: revoking the installation returns that store to the public path with
the shop still serving.

### Stage 3 — webhooks

The route, HMAC, the delivery ledger, the coalescing writer, the reconciliation
sweep.

**Exit condition:** a product edited in the Shopify admin changes a published
shop within one debounce window, observed; the same delivery replayed changes
nothing, observed; a delivery with a stale `updatedAt` is dropped, observed;
a delivery with a bad signature gets a 401, observed. Each of these is a thing
the offline tests assert about the *logic* and only a live delivery can assert
about the *system*.

### Stage 4 — uninstall, compliance, and the sync claim

`app/uninstalled`, `app/scopes_update`, the three compliance topics, and the
per-store sync capability of §2.3 end to end.

**Exit condition:** uninstalling drops the tokens, returns the store to public,
and removes any liveness language from the served page — checked by loading the
page, not by reading the code.

### Stage 5 — submission

App Store listing, privacy policy, scope justification.

**Exit condition:** approved, or a rejection list.

---

## 10. Verification register

Every factual claim about Shopify in this document, and its status.

### Verified from a cited shopify.dev page (via the MCP documentation index)

| Claim | Where used |
|---|---|
| Managed install + token exchange are the recommended flows for an app rendered in the Shopify admin | §4.1 |
| Token-exchange grant type, subject/requested token types, and `expiring=1` | §4.1 |
| Authorization code grant also accepts `expiring` (0 default, 1 for expiring) | §4.2 |
| Expiring offline tokens return `access_token`, `expires_in`, `refresh_token` (`shprt_`), `refresh_token_expires_in`, `scope`; new installs are told to request them and persist the refresh token | §4.2 |
| Migrating a non-expiring token revokes it irreversibly | §4.2 |
| Re-acquiring a non-expiring token requires merchant interaction | §4.3 |
| HMAC is base64 HMAC-SHA256 over the raw body, keyed by the client secret, in `X-Shopify-Hmac-SHA256` | §5.2 |
| Constant-time compare with a length check first; Node throws otherwise | §5.2 |
| Secret rotation takes up to an hour to take effect for HMAC | §5.2 |
| Invalid HMAC on a mandatory compliance webhook must return 401 | §5.2 |
| `X-Shopify-Webhook-Id` deduplicates deliveries; `X-Shopify-Event-Id` correlates them; one delivery per subscription | §3.2, §5.3 |
| Retries: 8 times over 4 hours, exponential backoff, original payload replayed | §5.4, §5.5 |
| `X-Shopify-Triggered-At` is the staleness signal | §5.4 |
| Subscriptions are auto-deleted after 8 consecutive failures | §5.5 |
| 1-second connection timeout, 5-second total; respond 200 fast and process async | §5.5 |
| Reconciliation jobs are recommended practice | §5.5 |
| `products/create`, `products/update`, `products/delete` each require `read_products` | §5.1 |
| `app/uninstalled` and `app/scopes_update` exist and what they mean | §5.1, §3.2 |
| The three compliance topics are mandatory for App Store apps regardless of whether the app collects personal data; 30 days to comply | §5.1, §5.6 |
| `shop/redact` arrives 48 hours after uninstall | §5.6 |
| App Store requirements: request only necessary scopes, proof may be requested | §6 |
| Protected customer data enforcement on web pixels from 2025-12-10; Level 1 required for the Customer Account API | §6 |
| API versions are quarterly, supported ≥12 months, ≥9 months of overlap; URL form `/admin/api/{version}/graphql.json` | §8, code |
| GraphQL Admin API is cost-based; 1000-point single-query ceiling; `extensions.cost.throttleStatus` in the response | code |
| REST is legacy as of 2024-10-01; new public apps must use GraphQL from 2025-04-01 | §2.2 (why GraphQL, not REST) |

### Verified by live Admin GraphQL introspection

| Claim | Where used |
|---|---|
| `ProductVariant.legacyResourceId: UnsignedInt64!` — "the ID of the corresponding resource in the REST Admin API" | §2.3 — **the cart-permalink finding** |
| `ProductVariant`: `availableForSale: Boolean!`, `price: Money!`, `compareAtPrice: Money`, `sku`, `title`, `selectedOptions: [SelectedOption!]!`, `position`, `media` | mapper |
| `Product`: `handle`, `title`, `description`, `descriptionHtml`, `productType`, `tags`, `vendor`, `status`, `publishedAt`, `updatedAt`, `createdAt`, `onlineStoreUrl`, `totalInventory`, `media`, `variants` | mapper |
| `Product` has **no** plain `images` field — media is the current model | mapper |

### Not verified

| Claim | Why it could not be checked | How the code copes |
|---|---|---|
| That a real token exchange returns the documented shape at all | No network to Shopify | `expires_in` is read, never assumed; absent ⇒ non-expiring |
| That `expires_in` is 3600 and `refresh_token_expires_in` is 7776000 in practice | Documented example, not an observation | No lifetime is hardcoded anywhere |
| The error shape when a refresh token has expired | Same | Any refresh failure ⇒ `needs_reauth` ⇒ public fallback |
| That our HMAC matches a signature Shopify actually produced | Only self-consistency can be tested offline | Tests prove the algorithm, tamper-rejection and rotation; a real delivery is stage 3's exit condition |
| That webhook ordering is not guaranteed, **as a stated rule** | No such statement found; the retry-replay behaviour forces the conclusion | Per-resource `updatedAt` watermark, which is correct either way |
| That `Money` serialises as a decimal string on the wire | Introspection gives the type, not the encoding | `parseMoney`'s type-not-magnitude rule handles both; a number would be read as minor units, which is the documented public-feed convention — **this is the mapper's most likely wrong assumption** |
| The Admin `products` connection response shape | Fixtures are hand-built from introspected field names, not recorded | Stage 1 exists to replace them with a recording |
| Rate-limit behaviour under real load | — | Client surfaces `throttleStatus`; no tuning claimed |
| That the docs index is current | It is a relay; 2026-07 was served as current stable, consistent with today | Version is a parameter, defaulted and overridable |

---

## 11. What is built, and what it does not prove

Stage 0 only. Six modules under `src/lib/shopify/`, each taking its transport,
clock and storage as arguments, in the manner of `lib/ingest/http.ts` — *"the
tests inject a fetch and a fake model client; none of them need a network, a
browser or a key."*

| Module | What it does | What its tests prove |
|---|---|---|
| `hmac.ts` | Constant-time base64 HMAC-SHA256 over a raw body, accepting a set of secrets | The digest matches an independently computed one; a one-byte body change fails; a truncated header fails without throwing; rotation accepts both secrets; an empty secret list never passes |
| `webhook.ts` | Headers → validated `WebhookDelivery`; staleness against a clock | Missing headers are refused, not defaulted; the shop domain is validated rather than trusted; staleness is measured, not assumed |
| `idempotency.ts` | `DeliveryLog` interface + in-memory store; duplicate suppression; per-handle `updatedAt` watermark | A replayed delivery is skipped; an abandoned `processing` row expires rather than blocking forever; an out-of-order product update is dropped and a newer one is not |
| `token.ts` | Expiry with skew, refresh-or-die, `needs_reauth` | A token inside the skew window refreshes; a missing `expires_in` is treated as non-expiring; a failed refresh produces `needs_reauth` rather than an exception; a fake clock drives all of it |
| `admin/client.ts` | GraphQL client: URL construction, `X-Shopify-Access-Token`, GraphQL-errors-with-200, 401 → refresh once → retry, 429/throttle | The URL and headers are exactly right; a 200 carrying `errors` is a failure; a 401 refreshes once and retries once and no more; `throttleStatus` is surfaced |
| `admin/catalogue.ts` | Admin `products` page → `Catalogue` | Variant ids are numeric so cart permalinks survive; sold-out products are kept and marked; `availabilityKnown` is true because `availableForSale` is non-null; money parses to decimals; a product with no readable variant is dropped, as on the public path |

**What none of this proves.** No token has been exchanged. No Admin query has
been sent. No webhook has been received. The catalogue mapper has never seen a
real Admin response and its fixtures were written from a schema, which means the
tests prove the mapper does what the mapper was written to do — a real payload
is the only thing that proves it does what Shopify does. That is stage 1, and it
is first among the live stages for exactly this reason.

The precedent for saying so is in the repo already, at the top of
`src/lib/publish/supabase.ts`, and this document is trying to hold to the same
standard: *"typechecked against the real client and exercised against nothing…
what is not covered is whether these queries are right."*
