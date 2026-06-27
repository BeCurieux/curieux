import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  CAPTAIN, VESSEL, CREDENTIALS, WEATHER_RULE, TRIP_TYPES, SLOTS, BOOKINGS,
  FALLBACK_FORECAST, KEPT_VS_OTA, WHAT_TO_BRING,
} from './data.js'
import { fetchForecast, classifyRisk, notify } from './services.js'
import { supabase, hasDatabase } from './supabase.js'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

let seq = 100
const nextId = (p) => `${p}_${++seq}`

// ---- Row <-> app shape mappers (DB is snake_case, app is camelCase) --------
const tripFromRow = (r) => ({
  id: r.id, name: r.name, price: r.price, deposit: r.deposit,
  durationLabel: r.duration_label, durationHrs: r.duration_hrs, capacity: r.capacity,
  desc: r.descr, tag: r.tag || '', whatToBring: r.what_to_bring, sort: r.sort,
})
const bookingFromRow = (r) => ({
  id: r.id, tripTypeId: r.trip_type_id, tripName: r.trip_name,
  guest: r.guest, email: r.email, phone: r.phone,
  party: r.party, price: r.price, deposit: r.deposit, status: r.status,
  slotId: r.slot_id, dow: r.dow, day: r.day, month: r.month, date: r.date, time: r.time,
  waiverSignedAt: r.waiver_signed_at, reviewRequested: r.review_requested, isNew: r.is_new,
})
const bookingToRow = (b, captainId) => ({
  id: b.id, captain_id: captainId, trip_type_id: b.tripTypeId, trip_name: b.tripName,
  guest: b.guest, email: b.email, phone: b.phone,
  party: b.party, price: b.price, deposit: b.deposit, status: b.status,
  slot_id: b.slotId || null, dow: b.dow, day: b.day, month: b.month, date: b.date, time: b.time,
  waiver_signed_at: b.waiverSignedAt, review_requested: !!b.reviewRequested, is_new: !!b.isNew,
})

export function StoreProvider({ children }) {
  // ---- Navigation ----------------------------------------------------------
  const [view, setView] = useState('captain')
  const [section, setSection] = useState('trips')

  // ---- Entities (seeded; replaced by DB rows when connected) ---------------
  const [captain, setCaptain] = useState(CAPTAIN)
  const [vessel] = useState(VESSEL)
  const [credentials] = useState(CREDENTIALS)
  const [weatherRule, setWeatherRule] = useState(WEATHER_RULE)
  const [tripTypes, setTripTypes] = useState(TRIP_TYPES)
  const [slots] = useState(SLOTS)
  const [bookings, setBookings] = useState(BOOKINGS)

  // ---- Persistence status --------------------------------------------------
  const [persistent, setPersistent] = useState(false) // true once DB is loaded
  const [dbReady, setDbReady] = useState(!hasDatabase) // gate first paint on load

  // ---- Weather -------------------------------------------------------------
  const [rawForecast, setRawForecast] = useState(FALLBACK_FORECAST)
  const [forecastSource, setForecastSource] = useState('BOM coastal waters + Windy')
  const [forecastLive, setForecastLive] = useState(false)
  const [weatherCancelled, setWeatherCancelled] = useState(false)

  // ---- Activity log --------------------------------------------------------
  const [activity, setActivity] = useState([])
  const logActivity = useCallback((entries) => {
    const arr = Array.isArray(entries) ? entries : [entries]
    setActivity((prev) => [...arr, ...prev])
  }, [])

  // ---- Hydrate from the database on mount (if configured) -------------------
  useEffect(() => {
    if (!hasDatabase) return
    let alive = true
    ;(async () => {
      try {
        const [{ data: caps }, { data: trips }, { data: books }] = await Promise.all([
          supabase.from('captains').select('*').limit(1),
          supabase.from('trip_types').select('*').order('sort'),
          supabase.from('bookings').select('*').order('date'),
        ])
        if (!alive) return
        if (caps && caps[0]) {
          const c = caps[0]
          setCaptain({
            id: c.id, name: c.name, business: c.business, slug: c.slug, initials: c.initials,
            location: c.location, rating: c.rating, reviewCount: c.review_count, lat: c.lat, lng: c.lng,
          })
          setWeatherRule({ gustKt: c.gust_kt, swellM: Number(c.swell_m) })
        }
        if (trips?.length) setTripTypes(trips.map(tripFromRow))
        if (books) setBookings(books.map(bookingFromRow))
        setPersistent(true)
      } catch (e) {
        console.warn('[skippr] database load failed, staying in demo mode:', e)
      } finally {
        if (alive) setDbReady(true)
      }
    })()
    return () => { alive = false }
  }, [])

  // ---- Live marine forecast ------------------------------------------------
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

  const forecast = useMemo(
    () => rawForecast.map((f) => ({ ...f, risk: classifyRisk(f.gust, f.swell, weatherRule) })),
    [rawForecast, weatherRule],
  )

  // ---- Actions -------------------------------------------------------------

  const cancelAndRebook = useCallback(
    async (dateISO = '2026-06-27') => {
      const affected = bookings.filter(
        (b) => b.date === dateISO && (b.status === 'confirmed' || b.status === 'completed'),
      )
      setBookings((prev) =>
        prev.map((b) => (affected.some((a) => a.id === b.id) ? { ...b, status: 'rebooking' } : b)),
      )
      setWeatherCancelled(true)

      if (persistent && affected.length) {
        try {
          await supabase.from('bookings').update({ status: 'rebooking' }).in('id', affected.map((a) => a.id))
        } catch (e) {
          console.warn('[skippr] rebook persist failed:', e)
        }
      }

      const sent = []
      for (const b of affected) {
        const link = `https://skippr.com.au/${captain.slug}/rebook/${b.id}`
        if (b.phone) sent.push(await notify({ channel: 'sms', to: b.phone, subject: 'Trip moved — pick a new day', body: `Hi ${b.guest}, ${captain.business} has cancelled ${b.tripName} on ${dateISO} for safety (strong-wind warning). Pick a new open slot — your deposit carries over: ${link}` }))
        if (b.email) sent.push(await notify({ channel: 'email', to: b.email, subject: `Your ${b.tripName} has been moved`, body: `We've cancelled ${dateISO} due to a BOM strong-wind warning. Rebook in one tap: ${link}` }))
      }
      logActivity(sent)
      return affected.length
    },
    [bookings, persistent, captain.slug, captain.business, logActivity],
  )

  const createBooking = useCallback(
    async ({ tripTypeId, slot, party, customer }) => {
      const tt = tripTypes.find((t) => t.id === tripTypeId)
      const booking = {
        id: nextId('bk'),
        dow: slot.dow, day: slot.day, month: slot.month, date: slot.date, time: '7:00a',
        tripTypeId, tripName: tt.name, slotId: slot.id,
        guest: customer?.name || 'New guest', email: customer?.email || null, phone: customer?.phone || null,
        party, price: tt.price, deposit: tt.deposit,
        status: 'confirmed', waiverSignedAt: new Date().toISOString(), isNew: true,
      }
      setBookings((prev) => [booking, ...prev])

      if (persistent) {
        try {
          await supabase.from('bookings').insert(bookingToRow(booking, captain.id))
        } catch (e) {
          console.warn('[skippr] booking persist failed:', e)
        }
      }

      const sent = []
      if (booking.phone) sent.push(await notify({ channel: 'sms', to: booking.phone, subject: 'Booking confirmed', body: `You're booked! ${tt.name} on ${slot.label}, party of ${party}. Deposit of $${tt.deposit} paid. Capt. Mick will text the marina pin the night before.` }))
      if (booking.email) sent.push(await notify({ channel: 'email', to: booking.email, subject: `Booking confirmed — ${tt.name}`, body: `Deposit paid & waiver signed. Balance of $${tt.price - tt.deposit} due at the marina.` }))
      logActivity(sent)
      return booking
    },
    [tripTypes, persistent, captain.id, logActivity],
  )

  const updateCaptain = useCallback(
    (patch) => {
      setCaptain((c) => ({ ...c, ...patch }))
      if (persistent) {
        const row = {}
        if ('slug' in patch) row.slug = patch.slug
        if ('name' in patch) row.name = patch.name
        if ('business' in patch) row.business = patch.business
        if (Object.keys(row).length) supabase.from('captains').update(row).eq('id', captain.id).then(() => {})
      }
    },
    [persistent, captain.id],
  )

  const updateTripType = useCallback(
    (id, patch) => {
      setTripTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      if (persistent) {
        const row = {}
        if ('price' in patch) row.price = patch.price
        if ('deposit' in patch) row.deposit = patch.deposit
        if ('whatToBring' in patch) row.what_to_bring = patch.whatToBring
        if ('name' in patch) row.name = patch.name
        if (Object.keys(row).length) supabase.from('trip_types').update(row).eq('id', id).then(() => {})
      }
    },
    [persistent],
  )

  const addTripType = useCallback(
    (tt) => {
      const created = { id: nextId('tt'), whatToBring: WHAT_TO_BRING, tag: '', sort: 99, ...tt }
      setTripTypes((prev) => [...prev, created])
      if (persistent) {
        supabase.from('trip_types').insert({
          id: created.id, captain_id: captain.id, name: created.name, price: created.price,
          deposit: created.deposit, duration_label: created.durationLabel, duration_hrs: created.durationHrs,
          capacity: created.capacity, descr: created.desc, tag: created.tag, what_to_bring: created.whatToBring, sort: created.sort,
        }).then(() => {})
      }
    },
    [persistent, captain.id],
  )

  const updateWeatherRule = useCallback(
    (patch) => {
      setWeatherRule((r) => ({ ...r, ...patch }))
      if (persistent) {
        const row = {}
        if ('gustKt' in patch) row.gust_kt = patch.gustKt
        if ('swellM' in patch) row.swell_m = patch.swellM
        if (Object.keys(row).length) supabase.from('captains').update(row).eq('id', captain.id).then(() => {})
      }
    },
    [persistent, captain.id],
  )

  const requestReview = useCallback(
    async (booking) => {
      const link = `https://g.page/r/${captain.slug}/review`
      const sent = await notify({ channel: 'sms', to: booking.phone || 'guest', subject: 'How was your trip?', body: `Thanks for fishing with ${captain.business}! A quick review helps other anglers find us: ${link}` })
      logActivity(sent)
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, reviewRequested: true } : b)))
      if (persistent) supabase.from('bookings').update({ review_requested: true }).eq('id', booking.id).then(() => {})
      return sent
    },
    [persistent, captain.slug, captain.business, logActivity],
  )

  const value = useMemo(
    () => ({
      view, setView, section, setSection,
      captain, vessel, credentials, weatherRule, tripTypes, slots, bookings,
      forecast, forecastSource, forecastLive, weatherCancelled,
      activity, persistent, dbReady, hasDatabase,
      cancelAndRebook, createBooking, updateCaptain, updateTripType, addTripType, updateWeatherRule, requestReview,
      keptVsOta: KEPT_VS_OTA,
    }),
    [
      view, section, captain, vessel, credentials, weatherRule, tripTypes, slots, bookings,
      forecast, forecastSource, forecastLive, weatherCancelled, activity, persistent, dbReady,
      cancelAndRebook, createBooking, updateCaptain, updateTripType, addTripType, updateWeatherRule, requestReview,
    ],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
