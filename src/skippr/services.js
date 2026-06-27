// Service layer. Each function targets a real serverless endpoint and degrades
// gracefully to a local mock so the whole product is demonstrable without keys.
// In production these endpoints talk to Open-Meteo/BOM, Stripe, and Twilio.

import { FALLBACK_FORECAST } from './data.js'

// ---- Weather risk engine (README §7 layer 2) -------------------------------

// Classify a day against the captain's threshold. A day is `high` once either
// gust or swell breaches the rule, `watch` within ~80% of it, else `ok`.
export function classifyRisk(gustKt, swellM, rule) {
  const g = gustKt / rule.gustKt
  const s = swellM / rule.swellM
  const ratio = Math.max(g, s)
  if (ratio >= 1) return 'high'
  if (ratio >= 0.8) return 'watch'
  return 'ok'
}

// Pull a marine forecast for the launch point. Returns days with gust/swell/dir.
export async function fetchForecast({ lat, lng }) {
  try {
    const res = await fetch(`/api/skippr/weather?lat=${lat}&lng=${lng}`)
    if (!res.ok) throw new Error('weather ' + res.status)
    const data = await res.json()
    if (Array.isArray(data?.forecast) && data.forecast.length) {
      return { forecast: data.forecast, source: data.source || 'Open-Meteo Marine', live: true }
    }
    throw new Error('empty forecast')
  } catch {
    return {
      forecast: FALLBACK_FORECAST,
      source: 'BOM coastal waters + Windy (cached)',
      live: false,
    }
  }
}

// ---- Payments (README §7 Stripe) -------------------------------------------

// Create a deposit Payment Intent. The endpoint returns a real client secret
// when STRIPE_SECRET_KEY is set, otherwise a mock one so checkout completes.
export async function createDeposit({ amount, tripName, customer }) {
  try {
    const res = await fetch('/api/skippr/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency: 'aud', tripName, customer }),
    })
    if (!res.ok) throw new Error('pay ' + res.status)
    return await res.json() // { clientSecret, mock }
  } catch {
    return { clientSecret: 'pi_mock_' + Math.random().toString(36).slice(2), mock: true }
  }
}

// ---- Messaging (README §7 Twilio / Postmark) -------------------------------

// Send an SMS/email. Endpoint sends for real when creds exist; either way we
// return the composed message so the captain UI can show an activity log.
export async function notify({ channel, to, subject, body }) {
  const message = { channel, to, subject, body, at: new Date().toISOString() }
  try {
    const res = await fetch('/api/skippr/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...message, sent: true, mock: !!data.mock }
    }
  } catch {
    /* fall through to mock */
  }
  return { ...message, sent: true, mock: true }
}

// ---- Compliance reminders (README §7) --------------------------------------

export function daysUntil(isoDate, today = new Date()) {
  const due = new Date(isoDate + 'T00:00:00')
  return Math.ceil((due - today) / 86400000)
}

// status: valid | expiring (<=30d) | expired
export function credentialStatus(cred, today = new Date()) {
  const d = daysUntil(cred.expiry, today)
  if (d < 0) return { status: 'expired', days: d }
  if (d <= 30) return { status: 'expiring', days: d }
  return { status: 'valid', days: d }
}

// ---- Reviews (README §6 / §11 #8) ------------------------------------------

// A review nudge is due ~1 day after a completed trip.
export function reviewDue(booking, today = new Date()) {
  if (booking.status !== 'completed') return false
  const trip = new Date(booking.date + 'T00:00:00')
  return today - trip >= 86400000
}
