# Skippr — production recreation

A faithful, functional recreation of the Skippr prototype (booking & ops for
charter captains) built into this repo as a second Vite + React app, alongside
Curieux. It follows the existing codebase conventions (Vite, React, inline-style
components) rather than the README's greenfield Next.js suggestion, per the
"follow the existing codebase" rule.

## Run it

```bash
npm install
npm run dev      # then open http://localhost:5173/skippr.html
npm run build    # builds both index.html (Curieux) and skippr.html (Skippr)
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
| `api/skippr/weather.js` | always (Open-Meteo, no key) | cached prototype forecast |
| `api/skippr/pay.js` | `STRIPE_SECRET_KEY` set | mock client secret |
| `api/skippr/notify.js` | Twilio / Postmark env set | logged "queued" message |

**Persistence is wired up via Supabase (Postgres).** When `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are set, bookings, trip types, and captain settings load
from and save to the database (the top bar shows "Saving to database"). Without
them the app runs in in-memory demo mode ("Demo mode · not saving"). Schema +
seed live in `supabase/schema.sql`; see `SETUP-DATABASE.md` for the step-by-step.
Captain auth is the remaining piece (the RLS policies are demo-grade — tighten
before launch).

## Layout

```
skippr.html              entry
src/skippr/
  main.jsx  App.jsx        shell + top bar + view toggle
  theme.js  icons.jsx  ui.jsx   tokens, inline SVG icons, primitives
  data.js   store.jsx  services.js   seed data, state + actions, integrations
  captain/  Dashboard TripsView Calendar Customers Payments Settings NewTripModal
  customer/ Booking
api/skippr/  weather.js pay.js notify.js
```
