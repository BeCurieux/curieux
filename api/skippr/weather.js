export const config = { runtime: 'edge' }

// Live marine forecast for the captain's launch point (README §7, layer 2).
// Multi-source: prefers WillyWeather (popular in AU/NZ, needs a paid API key in
// WILLYWEATHER_API_KEY) and falls back to Open-Meteo (free, no key). Returns the
// 4-day gust/swell/dir series; risk is classified client-side against the
// captain's own threshold. BOM is the legal authority for cancellations and is
// surfaced as a cross-check link on the card (it has no free public API).

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const deg2dir = (d) => COMPASS[Math.round((Number(d) % 360) / 22.5) % 16]
const dayName = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' })
const kmhToKt = (k) => k / 1.852

// ---- WillyWeather --------------------------------------------------------
async function willyWeather(lat, lng) {
  const key = process.env.WILLYWEATHER_API_KEY
  if (!key) return null

  // 1) Resolve the nearest WillyWeather location id from lat/lng.
  const searchRes = await fetch(`https://api.willyweather.com.au/v2/${key}/search.json?lat=${lat}&lng=${lng}&units=distance:km`)
  if (!searchRes.ok) throw new Error('willy search ' + searchRes.status)
  const search = await searchRes.json()
  const locationId = search?.location?.id ?? (Array.isArray(search) ? search[0]?.id : null)
  if (!locationId) throw new Error('willy: no location')

  // 2) Pull wind + swell forecasts.
  const wxRes = await fetch(
    `https://api.willyweather.com.au/v2/${key}/locations/${locationId}/weather.json?forecasts=wind,swell&days=4`,
  )
  if (!wxRes.ok) throw new Error('willy weather ' + wxRes.status)
  const wx = await wxRes.json()

  const windDays = wx?.forecasts?.wind?.days || []
  const swellDays = wx?.forecasts?.swell?.days || []
  if (!windDays.length) throw new Error('willy: empty wind')

  const forecast = windDays.slice(0, 4).map((wd, i) => {
    const winds = wd.entries || []
    // Use the day's strongest wind as a gust proxy (km/h -> kt).
    const maxWind = winds.reduce((m, e) => Math.max(m, e.speed || 0), 0)
    const dir = winds.length ? winds[Math.floor(winds.length / 2)].direction : 0
    const swellEntries = swellDays[i]?.entries || []
    const maxSwell = swellEntries.reduce((m, e) => Math.max(m, e.height || 0), 0)
    const date = (wd.dateTime || '').slice(0, 10)
    return {
      day: date ? dayName(date) : '',
      date,
      dir: deg2dir(dir),
      gust: Math.round(kmhToKt(maxWind)),
      swell: Number(maxSwell.toFixed(1)),
    }
  })
  return { forecast, source: 'WillyWeather' }
}

// ---- Open-Meteo (free fallback) ------------------------------------------
async function openMeteo(lat, lng) {
  const tz = 'Australia/Brisbane'
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=${tz}&forecast_days=4`
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
    `&daily=wave_height_max&timezone=${tz}&forecast_days=4`

  const [windRes, marineRes] = await Promise.all([fetch(windUrl), fetch(marineUrl)])
  if (!windRes.ok) throw new Error('wind ' + windRes.status)
  const wind = await windRes.json()
  const marine = marineRes.ok ? await marineRes.json() : null

  const days = wind.daily.time
  const gusts = wind.daily.wind_gusts_10m_max
  const dirs = wind.daily.wind_direction_10m_dominant
  const waves = marine?.daily?.wave_height_max || []

  const forecast = days.map((date, i) => ({
    day: dayName(date),
    date,
    dir: deg2dir(dirs[i] ?? 0),
    gust: Math.round(gusts[i] ?? 0),
    swell: Number((waves[i] ?? 0).toFixed(1)),
  }))
  return { forecast, source: 'Open-Meteo Marine + ECMWF' }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') || '-16.92'
  const lng = searchParams.get('lng') || '145.78'

  // Try WillyWeather first (if keyed), then Open-Meteo.
  for (const provider of [willyWeather, openMeteo]) {
    try {
      const result = await provider(lat, lng)
      if (result?.forecast?.length) {
        return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=1800' } })
      }
    } catch (e) {
      console.warn('[skippr] forecast provider failed:', String(e))
    }
  }

  return new Response(JSON.stringify({ error: 'all forecast providers failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}
