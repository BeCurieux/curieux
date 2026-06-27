# DeckHand — production recreation

A faithful, functional recreation of the DeckHand prototype (booking & ops for
charter captains) built into this repo as a second Vite + React app, alongside
Curieux. It follows the existing codebase conventions (Vite, React, inline-style
components) rather than the README's greenfield Next.js suggestion, per the
"follow the existing codebase" rule.

## Run it

```bash
npm install
npm run dev      # then open http://localhost:5173/deckhand.html
npm run build    # builds both index.html (Curieux) and deckhand.html (DeckHand)
```

The top-bar toggle switches **Captain dashboard ⇄ Customer booking**.

## What's here (README roadmap)

**Phase 1 (MVP)**
- Captain dashboard: week trips, stats, AMSA strip, sidebar nav.
- Public booking flow: pick trip → date/party → Stripe-ready deposit + e-waiver → confirmation.
- Trip types, booking-page slug, and "what to bring" are captain-editable in Settings.
- Confirmation SMS/email composed and logged on every booking.

**Phase 2 (differentiators)**
- Weather risk engine: live marine forecast (Open-Meteo, no key) classified
  against the captain's gust/swell threshold → per-day + per-trip risk dots.
- One-tap **Cancel Sat & auto-rebook**: flips the day's trips to "Rebooking",
  switches the conditions card, and texts/emails every affected guest a rebooking
  link (captain confirmation required — never automatic).
- AMSA compliance tracking with computed expiry reminders.
- Auto review requests (post-trip nudge).

**Phase 3**
- Calendar week view, Customers + message-activity log, Payments (deposits,
  balances, GST), editable weather thresholds.

## Real vs mocked

The whole UX and product logic is live and in-memory. Third-party calls run
through serverless endpoints that use real APIs when credentials exist and fall
back to mocks otherwise:

| Endpoint | Real when | Falls back to |
|---|---|---|
| `api/deckhand/weather.js` | always (Open-Meteo, no key) | cached prototype forecast |
| `api/deckhand/pay.js` | `STRIPE_SECRET_KEY` set | mock client secret |
| `api/deckhand/notify.js` | Twilio / Postmark env set | logged "queued" message |

Persistence (Postgres/Prisma per README §6) and captain auth are not wired —
state lives in `src/deckhand/store.jsx`, which mirrors the §6 data model and is
the seam to swap for a real backend.

## Layout

```
deckhand.html              entry
src/deckhand/
  main.jsx  App.jsx        shell + top bar + view toggle
  theme.js  icons.jsx  ui.jsx   tokens, inline SVG icons, primitives
  data.js   store.jsx  services.js   seed data, state + actions, integrations
  captain/  Dashboard TripsView Calendar Customers Payments Settings NewTripModal
  customer/ Booking
api/deckhand/  weather.js pay.js notify.js
```
