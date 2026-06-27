-- Skippr database schema (Postgres / Supabase).
-- Paste this whole file into the Supabase SQL Editor and click "Run" once.
-- It creates the tables, seeds the demo charter, and opens demo-grade access.
-- (Tighten the RLS policies before going live — see the note at the bottom.)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists captains (
  id            text primary key,
  name          text not null,
  business      text not null,
  slug          text not null,
  initials      text,
  location      text,
  rating        numeric default 0,
  review_count  int default 0,
  lat           numeric,
  lng           numeric,
  gust_kt       int default 25,
  swell_m       numeric default 1.5
);

create table if not exists trip_types (
  id            text primary key,
  captain_id    text references captains(id) on delete cascade,
  name          text not null,
  price         int not null,
  deposit       int not null,
  duration_label text,
  duration_hrs  numeric,
  capacity      int default 8,
  descr         text,
  tag           text,
  what_to_bring text,
  sort          int default 0
);

create table if not exists bookings (
  id            text primary key,
  captain_id    text references captains(id) on delete cascade,
  trip_type_id  text,
  trip_name     text,
  guest         text,
  email         text,
  phone         text,
  party         int default 0,
  price         int default 0,
  deposit       int default 0,
  status        text default 'confirmed',
  slot_id       text,
  dow           text,
  day           text,
  month         text,
  date          text,
  time          text,
  waiver_signed_at  timestamptz,
  review_requested  boolean default false,
  is_new        boolean default false,
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Seed data (only inserts if the rows aren't already there)
-- ---------------------------------------------------------------------------

insert into captains (id, name, business, slug, initials, location, rating, review_count, lat, lng, gust_kt, swell_m)
values ('cap_reefreel', 'Capt. Mick', 'Reef & Reel Charters', 'reef-reel', 'RR', 'Cairns, QLD', 4.9, 212, -16.92, 145.78, 25, 1.5)
on conflict (id) do nothing;

insert into trip_types (id, captain_id, name, price, deposit, duration_label, duration_hrs, capacity, descr, tag, what_to_bring, sort) values
  ('reef', 'cap_reefreel', 'Half-Day Reef', 1100, 300, '5 hrs', 5, 8, 'Coral trout, nannygai & snapper on the inner reef. Families welcome.', 'Most booked', 'Reef-safe sunscreen & hat · polarised shades · soft cooler with food & drinks · flat-soled shoes. Rods, bait & reef permit provided.', 1),
  ('game', 'cap_reefreel', 'Full-Day Game', 2400, 600, '9 hrs', 9, 6, 'Run wide for marlin, mahi & wahoo. Heavy tackle provided.', '', 'Reef-safe sunscreen & hat · polarised shades · soft cooler with food & drinks · flat-soled shoes. Rods, bait & reef permit provided.', 2),
  ('sunset', 'cap_reefreel', 'Sunset Reef Cruise', 650, 200, '2 hrs', 2, 8, 'Light tackle & drinks as the sun drops behind the ranges.', '', 'Reef-safe sunscreen & hat · polarised shades · soft cooler with food & drinks · flat-soled shoes. Rods, bait & reef permit provided.', 3)
on conflict (id) do nothing;

insert into bookings (id, captain_id, trip_type_id, trip_name, guest, email, phone, party, price, deposit, status, slot_id, dow, day, month, date, time, waiver_signed_at) values
  ('bk_mahony',   'cap_reefreel', 'game',   'Full-Day Game',      'D. Mahony',           'd.mahony@example.com', '+61 400 111 222', 4, 2400, 600, 'confirmed', null, 'FRI', '26', 'Jun', '2026-06-26', '7:00a', '2026-06-12T09:30:00+10:00'),
  ('bk_bartlett', 'cap_reefreel', 'reef',   'Half-Day Reef',      'The Bartlett family', 'bartlett@example.com', '+61 400 333 444', 5, 1100, 300, 'confirmed', null, 'SAT', '27', 'Jun', '2026-06-27', '7:00a', '2026-06-18T14:02:00+10:00'),
  ('bk_nguyen',   'cap_reefreel', 'sunset', 'Sunset Reef Cruise', 'K. Nguyen +1',        'k.nguyen@example.com', '+61 400 555 666', 2, 650,  200, 'confirmed', null, 'SAT', '27', 'Jun', '2026-06-27', '5:30p', '2026-06-20T18:40:00+10:00'),
  ('bk_open',     'cap_reefreel', 'game',   'Full-Day Game',      null,                  null,                   null,              0, 2400, 600, 'open',      null, 'SUN', '28', 'Jun', '2026-06-28', '7:00a', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Access (demo-grade). Row Level Security is ON; these policies let the
-- public booking page read trips and create/update bookings without a login.
--
-- BEFORE LAUNCH: replace the booking policies so guests can only INSERT (not
-- read or edit other people's bookings), and gate captain reads/edits behind
-- Supabase Auth. This open setup is for the prototype only.
-- ---------------------------------------------------------------------------

alter table captains   enable row level security;
alter table trip_types enable row level security;
alter table bookings   enable row level security;

drop policy if exists "demo read captains" on captains;
create policy "demo read captains" on captains for select using (true);
drop policy if exists "demo write captains" on captains;
create policy "demo write captains" on captains for update using (true) with check (true);

drop policy if exists "demo read trips" on trip_types;
create policy "demo read trips" on trip_types for all using (true) with check (true);

drop policy if exists "demo bookings" on bookings;
create policy "demo bookings" on bookings for all using (true) with check (true);
