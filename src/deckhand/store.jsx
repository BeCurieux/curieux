import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  CAPTAIN, VESSEL, CREDENTIALS, WEATHER_RULE, TRIP_TYPES, SLOTS, BOOKINGS,
  FALLBACK_FORECAST, KEPT_VS_OTA, WHAT_TO_BRING,
} from './data.js'
import { fetchForecast, classifyRisk, notify } from './services.js'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

let seq = 100
const nextId = (p) => `${p}_${++seq}`

export function StoreProvider({ children }) {
  // ---- Navigation ----------------------------------------------------------
  const [view, setView] = useState('captain') // 'captain' | 'customer'
  const [section, setSection] = useState('trips') // captain sidebar section

  // ---- Entities ------------------------------------------------------------
  const [captain, setCaptain] = useState(CAPTAIN)
  const [vessel] = useState(VESSEL)
  const [credentials] = useState(CREDENTIALS)
  const [weatherRule, setWeatherRule] = useState(WEATHER_RULE)
  const [tripTypes, setTripTypes] = useState(TRIP_TYPES)
  const [slots] = useState(SLOTS)
  const [bookings, setBookings] = useState(BOOKINGS)

  // ---- Weather -------------------------------------------------------------
  const [rawForecast, setRawForecast] = useState(FALLBACK_FORECAST)
  const [forecastSource, setForecastSource] = useState('BOM coastal waters + Windy')
  const [forecastLive, setForecastLive] = useState(false)
  const [weatherCancelled, setWeatherCancelled] = useState(false)

  // ---- Activity log (outbound SMS/email) -----------------------------------
  const [activity, setActivity] = useState([])
  const logActivity = useCallback((entries) => {
    const arr = Array.isArray(entries) ? entries : [entries]
    setActivity((prev) => [...arr, ...prev])
  }, [])

  // Load a live marine forecast on mount; falls back silently.
  useEffect(() => {
    let alive = true
    fetchForecast({ lat: captain.lat, lng: captain.lng }).then((r) => {
      if (!alive) return
      setRawForecast(r.forecast)
      setForecastSource(r.source)
      setForecastLive(r.live)
    })
    return () => { alive = false }
  }, [captain.lat, captain.lng])

  // Forecast annotated with risk computed against the captain's threshold.
  const forecast = useMemo(
    () => rawForecast.map((f) => ({ ...f, risk: classifyRisk(f.gust, f.swell, weatherRule) })),
    [rawForecast, weatherRule],
  )

  // ---- Actions -------------------------------------------------------------

  // Signature flow: cancel a day's trips and offer every affected guest a
  // one-tap rebooking link. Captain confirmation required (never automatic).
  const cancelAndRebook = useCallback(
    async (dateISO = '2026-06-27') => {
      const affected = bookings.filter(
        (b) => b.date === dateISO && (b.status === 'confirmed' || b.status === 'completed'),
      )
      setBookings((prev) =>
        prev.map((b) =>
          affected.some((a) => a.id === b.id) ? { ...b, status: 'rebooking' } : b,
        ),
      )
      setWeatherCancelled(true)

      const sent = []
      for (const b of affected) {
        const link = `https://deckhand.com.au/${captain.slug}/rebook/${b.id}`
        if (b.phone) {
          sent.push(
            await notify({
              channel: 'sms', to: b.phone,
              subject: 'Trip moved — pick a new day',
              body: `Hi ${b.guest}, ${captain.business} has cancelled ${b.tripName} on ${dateISO} for safety (strong-wind warning). Pick a new open slot — your deposit carries over: ${link}`,
            }),
          )
        }
        if (b.email) {
          sent.push(
            await notify({
              channel: 'email', to: b.email,
              subject: `Your ${b.tripName} has been moved`,
              body: `We've cancelled ${dateISO} due to a BOM strong-wind warning. Rebook in one tap: ${link}`,
            }),
          )
        }
      }
      logActivity(sent)
      return affected.length
    },
    [bookings, captain.slug, captain.business, logActivity],
  )

  // Customer completes the booking flow -> a real confirmed booking appears on
  // the captain side, with confirmation messages logged.
  const createBooking = useCallback(
    async ({ tripTypeId, slot, party, customer }) => {
      const tt = tripTypes.find((t) => t.id === tripTypeId)
      const booking = {
        id: nextId('bk'),
        dow: slot.dow, day: slot.day, month: slot.month, date: slot.date, time: '7:00a',
        tripTypeId, tripName: tt.name,
        guest: customer?.name || 'New guest', email: customer?.email || null, phone: customer?.phone || null,
        party, price: tt.price, deposit: tt.deposit,
        status: 'confirmed', waiverSignedAt: new Date().toISOString(),
        isNew: true,
      }
      setBookings((prev) => [booking, ...prev])

      const sent = []
      if (booking.phone) {
        sent.push(
          await notify({
            channel: 'sms', to: booking.phone,
            subject: 'Booking confirmed',
            body: `You're booked! ${tt.name} on ${slot.label}, party of ${party}. Deposit of $${tt.deposit} paid. Capt. Mick will text the marina pin the night before.`,
          }),
        )
      }
      if (booking.email) {
        sent.push(
          await notify({
            channel: 'email', to: booking.email,
            subject: `Booking confirmed — ${tt.name}`,
            body: `Deposit paid & waiver signed. Balance of $${tt.price - tt.deposit} due at the marina.`,
          }),
        )
      }
      logActivity(sent)
      return booking
    },
    [tripTypes, logActivity],
  )

  // Settings: booking page + trip types + weather thresholds.
  const updateCaptain = useCallback((patch) => setCaptain((c) => ({ ...c, ...patch })), [])
  const updateTripType = useCallback(
    (id, patch) => setTripTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  )
  const addTripType = useCallback((tt) => {
    setTripTypes((prev) => [...prev, { id: nextId('tt'), whatToBring: WHAT_TO_BRING, tag: '', ...tt }])
  }, [])
  const updateWeatherRule = useCallback((patch) => setWeatherRule((r) => ({ ...r, ...patch })), [])

  // Send a post-trip review request (README §11 #8).
  const requestReview = useCallback(
    async (booking) => {
      const link = `https://g.page/r/${captain.slug}/review`
      const sent = await notify({
        channel: 'sms', to: booking.phone || 'guest',
        subject: 'How was your trip?',
        body: `Thanks for fishing with ${captain.business}! A quick review helps other anglers find us: ${link}`,
      })
      logActivity(sent)
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, reviewRequested: true } : b)))
      return sent
    },
    [captain.slug, captain.business, logActivity],
  )

  const value = useMemo(
    () => ({
      view, setView, section, setSection,
      captain, vessel, credentials, weatherRule, tripTypes, slots, bookings,
      forecast, forecastSource, forecastLive, weatherCancelled,
      activity,
      cancelAndRebook, createBooking, updateCaptain, updateTripType, addTripType,
      updateWeatherRule, requestReview,
      keptVsOta: KEPT_VS_OTA,
    }),
    [
      view, section, captain, vessel, credentials, weatherRule, tripTypes, slots, bookings,
      forecast, forecastSource, forecastLive, weatherCancelled, activity,
      cancelAndRebook, createBooking, updateCaptain, updateTripType, addTripType,
      updateWeatherRule, requestReview,
    ],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
