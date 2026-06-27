export const config = { runtime: 'edge' }

// Live marine forecast for the captain's launch point (README §7, layer 2).
// Uses Open-Meteo — free, no API key — and returns the 4-day gust/swell/dir
// series the conditions card renders. Risk is classified client-side against
// the captain's own threshold.

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const deg2dir = (d) => COMPASS[Math.round((d % 360) / 22.5) % 16]
const dayName = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' })

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') || '-16.92'
  const lng = searchParams.get('lng') || '145.78'
  const tz = 'Australia/Brisbane'

  const windUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=kn&timezone=${tz}&forecast_days=4`
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
    `&daily=wave_height_max&timezone=${tz}&forecast_days=4`

  try {
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

    return Response.json(
      { forecast, source: 'Open-Meteo Marine + ECMWF' },
      { headers: { 'Cache-Control': 'public, max-age=1800' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
