# 👻 Haunted Wishlist

A Shopify app where saved products **haunt** their shopper — a cozy, well-timed
web-push note written in the item's own voice ("It's me. The jacket. Still cold
without you.") when something changes: a price drop, a restock, or it's just
been a while.

It is three systems wearing one sheet:

1. **A wishlist** — capture + storage + a themed customer-facing surface.
2. **A notification platform** — web push only. No email, ever.
3. **An AI voice engine** — persona → line, with hard content guardrails.

**The one rule that shapes everything:** the notification is the product. Every
decision serves getting a well-written, well-timed, non-creepy push onto a lock
screen.

Dogfood target: **AVOCA**.

---

## Architecture

```
src/
  config/personas.ts     Persona config + hand-written safe-bank line per trigger
  lib/
    types.ts             Domain types (mirror the SQL model)
    guardrails.ts        Guardrail 2 — deterministic reject + classifier interface
    anthropic.ts         claude-haiku-4-5 line generator + safety classifier
    voice.ts             generate → validate → safe-bank fallback
    cadence.ts           Guardrail 1 — the canHaunt gate (server-constant LIMITS)
    triggers.ts          Trigger engine — enqueues candidates, never sends
    sender.ts            The ONLY sender. The single gate: cadence + safety, once
    push.ts              web-push delivery (prunes 404/410 endpoints)
    store.ts             HauntStore interface (send-path persistence boundary)
    store.supabase.ts    Supabase implementation + repos
    fade.ts              Deterministic client-side glow (0..1 over ~21 days)
    shopify/             OAuth, session-token verify, app-proxy signature verify
    crypto.ts            AES-256-GCM for shops.access_token at rest
    billing.ts           Subscriber-tiered plans (gate on shops.plan)
  app/                   Next.js 14 App Router — embedded admin + API routes
extensions/haunted-wishlist/   Theme App Extension (save button, ghost room, SW)
supabase/migrations/     Postgres schema + RLS
tests/                   Guardrail + cadence build-breaker suites (vitest)
e2e/                     Playwright (admin smoke + documented full flow)
```

### Why the sender is the only gate

Triggers (`price_drop`, `back_in_stock`, `been_a_while`, …) do **not** send. They
enqueue a *candidate*. `sendHaunt()` is the one place that:

1. runs the **cadence gate** (`canHaunt`) — hard ceilings, server constants;
2. **composes + validates** the line (generate → validate → safe-bank fallback);
3. delivers via web push and prunes dead endpoints;
4. writes **exactly one `haunt_events` row per candidate** — suppression is
   observable, never silent.

No trigger path can bypass the caps or ship an unvetted line, because there is
only one door.

---

## Guardrails

**Guardrail 1 — cadence caps** (`src/lib/cadence.ts`). Per-item min gap, per-item
30-day window, per-subscriber daily, and an absolute per-item lifetime cap that
even *Persistent* cannot exceed. Limits are server constants — never read from
anything client-supplied.

**Guardrail 2 — cozy, never creepy** (`src/lib/guardrails.ts` + `voice.ts`).
Generate → deterministic reject → cheap Haiku classifier → **regenerate once** →
**safe-bank fallback**. An unvalidated line is never sent, and a haunt is never
skipped for lack of a line.

---

## Setup

```bash
npm install
cp .env.example .env.local        # fill in for the real app; tests need nothing
npm run keys:vapid                # generate a VAPID keypair
```

Apply the schema to your Supabase project:

```bash
supabase db push        # or run supabase/migrations/0001_init.sql
```

Shopify: create an app (Partners), set the App URL to this host, add the OAuth
callback `/api/auth/callback`, and configure an **App Proxy**:

- Subpath prefix `apps`, subpath `haunted`
- Proxy URL `https://<your-host>/api/public`

so the storefront reaches `/apps/haunted/{config,subscribe,wishlist,sw}`.

```bash
npm run dev        # embedded admin at /
```

---

## Testing

Two suites are **build-breakers** and run offline (no network, no services):

```bash
npm test                 # everything
npm run test:guardrail   # ~50 creepy MUST reject, ~50 cozy MUST pass; safe banks vetted
npm run test:cadence     # 30-day hourly sim; asserts NO cadence ceiling is ever breached
```

E2E (Playwright):

```bash
# Smoke — admin shell renders standalone (no backend needed):
PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test admin.smoke
# Full install → save → push → click flow (needs a live store):
E2E_LIVE=1 ... npx playwright test haunt-flow
```

A guardrail regression failure is a build-breaker. Treat it as one.

---

## Status vs. build order

| Step | Area | State |
|---|---|---|
| 1 | Scaffold + Shopify OAuth + session tokens + `shops` + admin shell | ✅ |
| 2 | Theme app block, save button, `wishlist_items`, `subscribers` | ✅ |
| 3 | VAPID + service worker + opt-in on save + subscription storage + test send | ✅ |
| 4 | Voice engine + both guardrails + persona config + **regression suite green** | ✅ |
| 5 | Trigger engine + `canHaunt` gate + `haunt_events` logging | ✅ |
| 6 | Customer ghost room (fading glow, Reunite/Release) + admin dashboard | ✅ |
| 7 | Billing (simple, subscriber-tiered) · Graveyard behind `FEATURE_GRAVEYARD=false` · E2E | ◑ billing minimal; Graveyard schema-only; full E2E gated on live store |

The engine, both guardrails, and the two build-breaker suites are real and green.
Live-store verification (OAuth round-trip, a real push on a lock screen, Stripe
charges) requires credentials and is documented above.
