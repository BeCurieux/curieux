// Seed data mirroring the prototype + README §6 data model. In production this
// would come from Postgres (Prisma); here it bootstraps the in-memory store so
// the full product flow is demonstrable end to end.

// Cairns, QLD — used as the launch point for the live marine forecast.
export const CAPTAIN = {
  id: 'cap_reefreel',
  name: 'Capt. Mick',
  business: 'Reef & Reel Charters',
  slug: 'reef-reel',
  initials: 'RR',
  location: 'Cairns, QLD',
  rating: 4.9,
  reviewCount: 212,
  lat: -16.92,
  lng: 145.78,
}

export const VESSEL = {
  id: 'ves_marlin',
  name: 'Reel Deal',
  capacity: 8,
  homeMarina: 'Marlin Marina, Cairns',
  surveyExpiry: '2026-07-15', // ~18 days from the prototype's "today"
}

export const CREDENTIALS = [
  { id: 'cr_master', type: 'Master <24m', expiry: '2027-03-01' },
  { id: 'cr_coxswain', type: 'Coxswain Gr.1', expiry: '2028-01-01' },
  { id: 'cr_survey', type: 'Vessel survey', expiry: '2026-07-15' },
  { id: 'cr_liability', type: 'Public liability', expiry: '2027-09-30' },
]

export const WEATHER_RULE = { gustKt: 25, swellM: 1.5 }

export const WHAT_TO_BRING =
  'Reef-safe sunscreen & hat · polarised shades · soft cooler with food & drinks · flat-soled shoes. Rods, bait & reef permit provided.'

export const TRIP_TYPES = [
  {
    id: 'reef',
    name: 'Half-Day Reef',
    price: 1100,
    deposit: 300,
    durationLabel: '5 hrs',
    durationHrs: 5,
    capacity: 8,
    desc: 'Coral trout, nannygai & snapper on the inner reef. Families welcome.',
    tag: 'Most booked',
    whatToBring: WHAT_TO_BRING,
  },
  {
    id: 'game',
    name: 'Full-Day Game',
    price: 2400,
    deposit: 600,
    durationLabel: '9 hrs',
    durationHrs: 9,
    capacity: 6,
    desc: 'Run wide for marlin, mahi & wahoo. Heavy tackle provided.',
    tag: '',
    whatToBring: WHAT_TO_BRING,
  },
  {
    id: 'sunset',
    name: 'Sunset Reef Cruise',
    price: 650,
    deposit: 200,
    durationLabel: '2 hrs',
    durationHrs: 2,
    capacity: 8,
    desc: 'Light tackle & drinks as the sun drops behind the ranges.',
    tag: '',
    whatToBring: WHAT_TO_BRING,
  },
]

// Bookable slots offered on the public page (customer flow).
export const SLOTS = [
  { id: 'sat', dow: 'SAT', day: '27', month: 'Jun', label: 'Sat · 27 Jun', date: '2026-06-27', time: '7:00 AM departure' },
  { id: 'sun', dow: 'SUN', day: '28', month: 'Jun', label: 'Sun · 28 Jun', date: '2026-06-28', time: '7:00 AM departure' },
  { id: 'tue', dow: 'TUE', day: '30', month: 'Jun', label: 'Tue · 30 Jun', date: '2026-06-30', time: '7:00 AM departure' },
  { id: 'wed', dow: 'WED', day: '1', month: 'Jul', label: 'Wed · 1 Jul', date: '2026-07-01', time: '7:00 AM departure' },
]

// The captain's week, as shown on the dashboard trips list.
export const BOOKINGS = [
  {
    id: 'bk_mahony',
    dow: 'FRI', day: '26', month: 'Jun', date: '2026-06-26', time: '7:00a',
    tripTypeId: 'game', tripName: 'Full-Day Game',
    guest: 'D. Mahony', email: 'd.mahony@example.com', phone: '+61 400 111 222',
    party: 4, price: 2400, deposit: 600,
    status: 'confirmed', waiverSignedAt: '2026-06-12T09:30:00+10:00',
  },
  {
    id: 'bk_bartlett',
    dow: 'SAT', day: '27', month: 'Jun', date: '2026-06-27', time: '7:00a',
    tripTypeId: 'reef', tripName: 'Half-Day Reef',
    guest: 'The Bartlett family', email: 'bartlett@example.com', phone: '+61 400 333 444',
    party: 5, price: 1100, deposit: 300,
    status: 'confirmed', waiverSignedAt: '2026-06-18T14:02:00+10:00',
  },
  {
    id: 'bk_nguyen',
    dow: 'SAT', day: '27', month: 'Jun', date: '2026-06-27', time: '5:30p',
    tripTypeId: 'sunset', tripName: 'Sunset Reef Cruise',
    guest: 'K. Nguyen +1', email: 'k.nguyen@example.com', phone: '+61 400 555 666',
    party: 2, price: 650, deposit: 200,
    status: 'confirmed', waiverSignedAt: '2026-06-20T18:40:00+10:00',
  },
  {
    id: 'bk_open',
    dow: 'SUN', day: '28', month: 'Jun', date: '2026-06-28', time: '7:00a',
    tripTypeId: 'game', tripName: 'Full-Day Game',
    guest: null, email: null, phone: null,
    party: 0, price: 2400, deposit: 600,
    status: 'open', waiverSignedAt: null,
  },
]

// Fallback forecast (matches the prototype) used when the live API is offline.
// Risk is recomputed against WEATHER_RULE by the risk engine at runtime.
export const FALLBACK_FORECAST = [
  { day: 'Fri', date: '2026-06-26', dir: 'SE', gust: 16, swell: 0.6 },
  { day: 'Sat', date: '2026-06-27', dir: 'SE', gust: 32, swell: 1.8 },
  { day: 'Sun', date: '2026-06-28', dir: 'SE', gust: 22, swell: 1.1 },
  { day: 'Mon', date: '2026-06-29', dir: 'E', gust: 14, swell: 0.7 },
]

// Headline stats (prototype values). Deposits/fill recompute from bookings,
// but "kept vs OTAs" needs a commission assumption, so it is seeded.
export const KEPT_VS_OTA = 1240
