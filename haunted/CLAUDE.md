# CLAUDE.md — Haunted Wishlist

This is the build brief for Claude Code. Read it fully before writing anything.

> Note: this repo is a multi-app studio (`waterline`, `lattice`, `haunted`), so
> this brief lives at the **app root** (`haunted/CLAUDE.md`) rather than the true
> repo root.

## What this is

A Shopify app. A shopper saves items to a wishlist; each saved item can "haunt"
them — a web push notification written in the item's own voice ("It's me. The
jacket. Still cold without you.") when something changes (price drop, back in
stock, been a while). The merchant picks a persona and a cadence. That's the
whole product.

It is secretly three systems wearing one sheet:

1. A wishlist (capture + storage + a themed customer-facing surface).
2. A notification platform (web push — no email, ever).
3. An AI voice engine (persona → line, with hard content guardrails).

Dogfood target: AVOCA. Build it so it installs clean on a real store from day one.

## Stack (non-negotiable, it's what the rest of the studio runs on)

* Next.js 14 (App Router), TypeScript strict.
* Supabase (Postgres + RLS) for data.
* Stripe for billing (usage-tiered — see Billing).
* Anthropic API for voice generation (`claude-haiku-4-5` for line gen and the
  safety check — cheap, fast, high volume).
* Playwright for E2E, and for the guardrail regression suite (see Testing).
* Shopify: embedded admin app (App Bridge + Admin GraphQL), Theme App Extension
  (app block) for the storefront wishlist button + customer surface. Session
  tokens for auth, OAuth for install.
* Web Push: VAPID + service worker + Push API. This is the delivery channel.
  There is no email fallback and we are not building one.

## The one rule that shapes everything

The notification is the product. Not the wishlist page, not the admin. Every
architecture decision serves getting a well-written, well-timed, non-creepy push
onto a lock screen. When in doubt, optimize that path.

## Data model

See `supabase/migrations/0001_init.sql`. `shops`, `subscribers`,
`wishlist_items`, `haunt_events`. RLS on everything, keyed by `shop_id`. The
storefront app block talks to a public endpoint that only ever reads/writes rows
for its own shop + subscriber; never trust a `shop_id` from the client — derive
it from the verified session/app-proxy signature.

## Core surfaces

1. **Storefront — Theme App Extension (app block).** A "let it haunt you" save
   button on the PDP. On click: create the `wishlist_item`, then trigger push
   opt-in (permission is requested here, never on page load). The customer
   wishlist surface ("A room full of patient little ghosts"): each item a card
   with a fading glow that is a pure function of `now - saved_at`. Two actions:
   Reunite (→ PDP) and Release (soft delete). Cozy dusk, friendly ghost,
   candlelight — never horror.

2. **Admin — embedded Next.js app.** Voice picker (persona cards + sample line),
   cadence (Gentle/Normal/Persistent, Normal recommended), per-trigger toggles,
   dashboard (haunted, opened %, reunions, recovered revenue), and the guardrail
   surfaced as reassurance: "We cap every level so it never becomes spam."

3. **Graveyard — behind a flag, default OFF.** Schema hooks only in v1; UI gated
   behind `FEATURE_GRAVEYARD=false`.

## The trigger engine

A scheduled job + webhook handlers. `price_drop` (decrease only),
`back_in_stock` (products/update webhook), `been_a_while` (cron). `low_stock` /
`abandoned_saved` are wired but off by default. **Triggers do not send.** They
enqueue a candidate haunt. The sender is the only thing that sends, and the
sender is the gate — cadence and safety are enforced there, once.

## Guardrail 1 — Cadence caps (enforced in the send path, hard)

One function (`canHaunt`, `src/lib/cadence.ts`) stands between every candidate
and the push service. `LIMITS` are server constants. `perItemLifetime` is
absolute — even Persistent cannot exceed it. Every suppressed candidate still
writes a `haunt_events` row with `status='suppressed_cadence'` and a reason.

## Guardrail 2 — Cozy, never creepy (two layers + deterministic fallback)

Generate (`claude-haiku-4-5`) → validate (deterministic reject, then a cheap
classifier) → fall back. Flow: generate → validate; fail → regenerate once;
fail again → pull from the persona's hand-written safe bank. Never ship an
unvetted line, never skip the haunt for lack of a line. Every `suppressed_safety`
and every fallback is logged.

## Personas (three; sample + safe-bank each)

* **The Clingy Ex** — warm, needy, sweet.
* **The Poet** — wistful, brief, romantic.
* **The Deadpan** — dry, understated. Highest creepy-risk → tightest safe bank,
  most classifier scrutiny in tests.

Config in `src/config/personas.ts`.

## Web push specifics

VAPID keypair in env; public key to the client. Service worker handles `push`
and `notificationclick` (open the PDP, log `status='clicked'`). Store
subscription per `subscribers` row. On 404/410, set `revoked_at` and stop
sending. Payload deep-links to the PDP with `?haunt=<event_id>` for attribution.

## Billing (Stripe)

Trial → paid, tiered on active subscribers. Free tier capped at N subscribers
for dogfooding/AVOCA. Gate on `shops.plan`. Don't over-build in v1.

## Testing (Playwright + guardrail regression)

1. **E2E:** install → save → grant push → trigger → notification (mock push) →
   click attributes.
2. **Guardrail regression (the important one):** ~50 known-creepy lines that
   MUST be rejected, ~50 known-cozy that must pass, plus a cadence suite that
   hammers the trigger engine and asserts no ceiling is ever breached across a
   simulated 30 days. A guardrail regression failure is a build-breaker.

## Build order

1. Scaffold + install (OAuth, session tokens, `shops`, admin shell).
2. Wishlist capture (app block, save button, `wishlist_items`, `subscribers`).
3. Web push plumbing (VAPID, SW, opt-in on save, storage, manual test send).
4. Voice engine + both guardrails. Guardrail regression green before moving on.
5. Trigger engine + cadence gate + `haunt_events` logging.
6. Customer surface + admin.
7. Billing, then Graveyard behind its flag, then E2E green.

Ship 1–5 to AVOCA and dogfood before touching 6's polish. The notification is
the product — get it real, get it kind, then make it pretty.
