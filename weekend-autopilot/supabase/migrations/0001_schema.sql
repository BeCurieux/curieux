-- Core schema (§27).
--
-- Conventions:
--   * UUID primary keys everywhere.
--   * created_at / updated_at on every table that matters, maintained by trigger.
--   * Soft delete (deleted_at) where a customer might come back, hard delete
--     where they asked us to forget them (§52).
--   * The HOUSEHOLD is the fundamental entity, not the user (§26). A user
--     belongs to a household; plans, preferences and taste belong to the
--     household. Partner accounts join later without a migration.
--
-- Row Level Security is defined in 0002_rls.sql and is not optional.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ enums

create type household_shape as enum ('SOLO', 'COUPLE', 'FAMILY', 'FRIENDS');
create type member_type as enum ('ADULT', 'CHILD');
create type transport_mode as enum ('DRIVING', 'TRANSIT', 'WALKING', 'CYCLING');
create type activity_level as enum ('GENTLE', 'EASY', 'MODERATE', 'ACTIVE');
create type nudge_level as enum ('NONE', 'LITTLE', 'YES');
create type budget_band as enum ('FREE', 'UNDER_75', '75_150', '150_250', 'FLEXIBLE');
create type start_time_preference as enum
  ('EARLY', 'AROUND_9', 'AROUND_10', 'LATE_MORNING', 'FLEXIBLE');
create type time_budget as enum ('FEW_HOURS', 'HALF_DAY', 'MOST_OF_DAY', 'FULL_WEEKEND');

create type taste_source as enum
  ('ONBOARDING', 'CHECKIN', 'PLAN_ACCEPTED', 'PLAN_REJECTED', 'DID_IT',
   'LOVED_IT', 'RATING', 'MANUAL_EDIT', 'INFERRED');

create type energy_level as enum ('LOW', 'NORMAL', 'HIGH');
create type budget_level as enum ('LOW', 'MEDIUM', 'HIGH');
create type time_level as enum ('FEW_HOURS', 'HALF_DAY', 'WHOLE_DAY');

create type plan_type as enum ('PRIMARY', 'BACKUP');

-- PENDING_REVIEW exists for the founder-review switch (§42). It is a stop on
-- the way to READY, not a permanent part of the pipeline.
create type plan_status as enum
  ('QUEUED', 'DISCOVERING', 'BUILDING', 'VERIFYING', 'PENDING_REVIEW', 'READY',
   'DELIVERED', 'OPENED', 'COMPLETED', 'REJECTED', 'FAILED');

create type plan_item_type as enum
  ('TRAVEL', 'WALK', 'VENUE', 'FOOD', 'ACTIVITY', 'BREAK', 'OPTIONAL');

create type verification_status as enum ('UNVERIFIED', 'VERIFIED', 'UNCERTAIN', 'FAILED');

create type did_it as enum ('YES', 'NO');
create type plan_rating as enum ('LOVED', 'GOOD', 'FINE', 'NOT_FOR_ME');
create type not_done_reason as enum
  ('PLANS_CHANGED', 'TOO_TIRED', 'TOO_EXPENSIVE', 'WEATHER', 'TOO_FAR',
   'DIDNT_APPEAL', 'SOMETHING_ELSE');

create type plan_event_type as enum
  ('PLAN_GENERATED', 'PLAN_DELIVERED', 'PLAN_OPENED', 'PLAN_SWAPPED',
   'PLAN_ACCEPTED', 'PLAN_REJECTED', 'DID_IT_YES', 'DID_IT_NO', 'PLAN_LOVED',
   'PLAN_OKAY', 'PLAN_DISLIKED', 'AFFILIATE_CLICKED');

create type subscription_status as enum
  ('NONE', 'TRIAL', 'PILOT_ACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
create type plan_tier as enum ('PILOT_4_WEEK', 'ANNUAL', 'MONTHLY');

create type generation_stage as enum
  ('CONTEXT', 'INTENTS', 'CANDIDATES', 'FILTERING', 'SCORING', 'ASSEMBLY',
   'SELECTION', 'VERIFICATION', 'COPY', 'VALIDATION', 'DONE', 'FAILED');

create type job_status as enum ('queued', 'running', 'done', 'failed', 'dead');

create type notification_channel as enum ('EMAIL');
create type notification_kind as enum
  ('WEEKLY_PLAN', 'FEEDBACK_REQUEST', 'PILOT_ENDING', 'GENERATION_FAILED',
   'WELCOME', 'MAGIC_LINK');

-- ------------------------------------------------------------------ helpers

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------------ users

-- Mirrors auth.users. Personal data kept to the minimum the product needs.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------------ markets

-- Mirrors src/config/markets.ts so that SQL-side reporting and scheduling can
-- join against it. The application treats the TypeScript file as the source of
-- truth and seeds this table from it.
create table markets (
  market_id            text primary key,
  display_name         text not null,
  country              text not null,
  currency             text not null,
  locale               text not null,
  timezone             text not null,
  distance_units       text not null default 'metric',
  default_travel_radius integer not null default 40,
  delivery_day         smallint not null default 4,
  delivery_time        text not null default '07:30',
  feedback_day         smallint not null default 7,
  feedback_time        text not null default '18:30',
  live                 boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ------------------------------------------------------------------ households

create table households (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  market_id     text not null references markets(market_id),
  shape         household_shape not null default 'SOLO',
  home_label    text,
  -- Approximate only: rounded to ~100 m before write (§51). We deliberately
  -- do not have a table of where anyone has been.
  home_lat      double precision,
  home_lng      double precision,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index households_owner_idx on households(owner_user_id);

-- Membership, so a partner can join a household later without restructuring.
create table household_users (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'OWNER',
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Ages matter enormously; names do not. Nickname is optional and never required
-- (§9 screen 2) and we collect nothing else about a child.
create table household_members (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  member_type    member_type not null,
  nickname       text,
  age            smallint check (age is null or (age >= 0 and age <= 120)),
  mobility_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index household_members_household_idx on household_members(household_id);

-- ------------------------------------------------------------------ preferences

create table preference_profiles (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null unique references households(id) on delete cascade,

  max_travel_minutes       integer not null default 40,
  allow_occasional_further boolean not null default false,
  transport_modes          transport_mode[] not null default '{TRANSIT,WALKING}',

  budget_band              budget_band not null default 'UNDER_75',

  activity_level           activity_level not null default 'EASY',
  desired_activity_level   activity_level not null default 'EASY',
  nudge                    nudge_level not null default 'NONE',

  liked_categories         text[] not null default '{}',
  dislikes                 text[] not null default '{}',
  hard_no                  text,

  food                     jsonb not null default '{
    "cuisines_loved": [], "dietary_requirements": [],
    "kid_friendly_importance": 0, "coffee_importance": 0.5,
    "restaurant_price_sensitivity": 0.5
  }'::jsonb,

  start_time_preference    start_time_preference not null default 'AROUND_9',
  time_budget              time_budget not null default 'HALF_DAY',
  crowd_tolerance          real not null default 0.5 check (crowd_tolerance between 0 and 1),

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Free-text "absolutely not" entries, kept separately from the structured
-- dislikes so they can be shown back and edited individually (§52).
create table user_dislikes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  text         text not null,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------ taste model

create table taste_signals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  dimension    text not null,
  value        text not null,
  weight       real not null check (weight between -1 and 1),
  confidence   real not null default 0.2 check (confidence between 0 and 1),
  source       taste_source not null,
  evidence     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, dimension, value)
);

create index taste_signals_household_idx on taste_signals(household_id);

-- Behavioural counters per category (§18). Separate from taste_signals because
-- they are counts, not weights, and the difference matters when debugging.
create table category_stats (
  household_id      uuid not null references households(id) on delete cascade,
  category_id       text not null,
  suggested_count   integer not null default 0,
  accepted_count    integer not null default 0,
  completed_count   integer not null default 0,
  loved_count       integer not null default 0,
  rejected_count    integer not null default 0,
  last_suggested_at timestamptz,
  last_completed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (household_id, category_id)
);

-- ------------------------------------------------------------------ check-ins

create table weekend_checkins (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  weekend_date date not null,
  energy       energy_level,
  budget       budget_level,
  time         time_level,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, weekend_date)
);

-- ------------------------------------------------------------------ places

-- Provider IDs and OUR derived data. Deliberately no descriptions, reviews or
-- photos: we re-fetch presentational content rather than warehousing a
-- provider's corpus (§12).
create table place_refs (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_place_id text not null,
  name              text not null,
  lat               double precision not null,
  lng               double precision not null,
  categories        text[] not null default '{}',
  price_level       smallint,
  busyness          real,
  market_id         text not null references markets(market_id),
  last_verified_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, provider_place_id)
);

create index place_refs_market_idx on place_refs(market_id);

-- ------------------------------------------------------------------ generation

create table plan_generation_runs (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  weekend_date        date not null,
  stage               generation_stage not null default 'CONTEXT',
  attempt             smallint not null default 1,
  succeeded           boolean,
  error               text,
  provider_cost_cents real not null default 0,
  candidate_count     integer not null default 0,
  -- Full pipeline trace for the admin inspector (§42): intents, rejections
  -- with reasons, scores, bundles, verification results.
  diagnostics         jsonb,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index generation_runs_household_idx on plan_generation_runs(household_id, weekend_date);

-- ------------------------------------------------------------------ plans

create table plans (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references households(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  market_id                text not null references markets(market_id),
  weekend_date             date not null,
  -- Overnight escapes are not MVP (§31), but the column is here so the schema
  -- does not need changing when they arrive.
  plan_duration_days       smallint not null default 1,
  plan_type                plan_type not null,

  title                    text not null,
  short_description        text not null default '',

  start_time               text not null,
  estimated_finish_time    text not null,

  estimated_total_cost_min numeric(10,2) not null default 0,
  estimated_total_cost_max numeric(10,2) not null default 0,
  currency                 text not null,

  total_travel_minutes     integer not null default 0,
  total_activity_distance_km real not null default 0,
  activity_level           activity_level not null default 'EASY',

  weather_summary          text,
  fit_reason               text not null default '',

  confidence_score         real not null default 0,
  base_score               real not null default 0,
  verification_score       real not null default 0,

  status                   plan_status not null default 'QUEUED',

  swap_reason              text,
  swapped_from_plan_id     uuid references plans(id) on delete set null,

  generation_run_id        uuid references plan_generation_runs(id) on delete set null,

  created_at               timestamptz not null default now(),
  verified_at              timestamptz,
  delivered_at             timestamptz,
  opened_at                timestamptz,
  completed_at             timestamptz,
  updated_at               timestamptz not null default now()
);

create index plans_household_weekend_idx on plans(household_id, weekend_date);
create index plans_status_idx on plans(status);

-- Idempotency for the generation job (§40): one live plan per household, per
-- weekend, per type. Superseded plans (swaps) are marked REJECTED first.
create unique index plans_idempotency_idx
  on plans(household_id, weekend_date, plan_type)
  where status not in ('REJECTED', 'FAILED');

create table plan_items (
  id                     uuid primary key default gen_random_uuid(),
  plan_id                uuid not null references plans(id) on delete cascade,
  sequence               smallint not null,
  item_type              plan_item_type not null,

  title                  text not null,
  description            text,

  provider               text,
  provider_place_id      text,
  place_ref_id           uuid references place_refs(id) on delete set null,
  lat                    double precision,
  lng                    double precision,
  address                text,

  start_time             text not null,
  end_time               text not null,

  estimated_cost_min     numeric(10,2) not null default 0,
  estimated_cost_max     numeric(10,2) not null default 0,

  walk_distance_km       real,
  travel_mode            transport_mode,

  booking_required       boolean not null default false,
  booking_url            text,

  commercial_url         text,
  affiliate_url          text,
  affiliate_provider     text,

  maps_url               text,

  verification_status    verification_status not null default 'UNVERIFIED',
  verification_timestamp timestamptz,
  verification_notes     text,

  is_critical            boolean not null default false,

  -- Every factual claim traced to the provider that supplied it (§53).
  source_provenance      jsonb not null default '{"facts":{},"model_fields":[],"ai_run_id":null}'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (plan_id, sequence)
);

create index plan_items_plan_idx on plan_items(plan_id);

-- The shortlist a plan was chosen from, kept for the admin inspector and for
-- regeneration after a verification failure.
create table plan_candidates (
  id                uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references plan_generation_runs(id) on delete cascade,
  provider          text not null,
  provider_place_id text not null,
  name              text not null,
  categories        text[] not null default '{}',
  base_score        real,
  advisory_score    real,
  rejected_rule     text,
  rejected_detail   text,
  created_at        timestamptz not null default now()
);

create index plan_candidates_run_idx on plan_candidates(generation_run_id);

-- ------------------------------------------------------------------ feedback

create table plan_feedback (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  household_id    uuid not null references households(id) on delete cascade,
  did_it          did_it not null,
  rating          plan_rating,
  not_done_reason not_done_reason,
  note            text,
  created_at      timestamptz not null default now(),
  unique (plan_id)
);

-- The strategically important table (§28). Append-only.
create table plan_events (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid references plans(id) on delete set null,
  household_id uuid not null references households(id) on delete cascade,
  event_type   plan_event_type not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index plan_events_household_idx on plan_events(household_id, created_at desc);
create index plan_events_type_idx on plan_events(event_type, created_at desc);

-- ------------------------------------------------------------------ billing

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null unique references households(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  status                 subscription_status not null default 'NONE',
  tier                   plan_tier,
  stripe_customer_id     text,
  stripe_subscription_id text,
  -- 0–4. The pilot delivers four weekends, then converts (§29).
  pilot_week_number      smallint not null default 0,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_stripe_customer_idx on subscriptions(stripe_customer_id);

-- Financial records are retained separately from customer data so that an
-- account deletion can remove the person without destroying the books (§52).
create table payments (
  id                        uuid primary key default gen_random_uuid(),
  household_id              uuid references households(id) on delete set null,
  stripe_payment_intent_id  text unique,
  stripe_checkout_session_id text unique,
  amount_cents              integer not null,
  currency                  text not null,
  tier                      plan_tier,
  status                    text not null,
  -- Retained after account deletion for tax purposes; contains no profile data.
  customer_email_hash       text,
  created_at                timestamptz not null default now()
);

-- ------------------------------------------------------------------ notifications

create table notification_preferences (
  household_id       uuid primary key references households(id) on delete cascade,
  weekly_plan        boolean not null default true,
  feedback_request   boolean not null default true,
  product_updates    boolean not null default false,
  unsubscribe_token  uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  plan_id       uuid references plans(id) on delete set null,
  channel       notification_channel not null default 'EMAIL',
  kind          notification_kind not null,
  subject       text,
  provider_id   text,
  status        text not null default 'queued',
  error         text,
  -- Idempotency for the delivery job (§40).
  idempotency_key text unique,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_household_idx on notifications(household_id, created_at desc);

-- ------------------------------------------------------------------ commercial

create table affiliate_clicks (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid references households(id) on delete set null,
  plan_id            uuid references plans(id) on delete set null,
  plan_item_id       uuid references plan_items(id) on delete set null,
  affiliate_provider text not null,
  target_url         text not null,
  created_at         timestamptz not null default now()
);

create table waitlist_entries (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  city       text not null,
  country    text,
  created_at timestamptz not null default now(),
  unique (email, city)
);

-- ------------------------------------------------------------------ operations

create table provider_usage (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  operation           text not null,
  requests            integer not null default 1,
  estimated_cost_cents real not null default 0,
  household_id        uuid references households(id) on delete set null,
  generation_run_id   uuid references plan_generation_runs(id) on delete cascade,
  created_at          timestamptz not null default now()
);

create index provider_usage_run_idx on provider_usage(generation_run_id);
create index provider_usage_created_idx on provider_usage(created_at desc);

-- AI observability (§43). Note: no prompt text, only a hash of the input.
create table ai_runs (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null,
  model                text not null,
  prompt_version       text not null,
  operation            text not null,
  input_hash           text not null,
  output               jsonb,
  latency_ms           integer,
  input_tokens         integer,
  output_tokens        integer,
  estimated_cost_cents real not null default 0,
  success              boolean not null,
  validation_errors    text[] not null default '{}',
  attempts             smallint not null default 1,
  household_id         uuid references households(id) on delete set null,
  generation_run_id    uuid references plan_generation_runs(id) on delete cascade,
  created_at           timestamptz not null default now()
);

create index ai_runs_operation_idx on ai_runs(operation, created_at desc);

create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

create table admin_flags (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  plan_id      uuid references plans(id) on delete cascade,
  reason       text not null,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create table audit_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  subject    text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ jobs

-- Postgres-backed durable queue (§40). Idempotency keys are
-- household_id + weekend_date + plan_type as the brief specifies, enforced by
-- the unique constraint rather than by convention.
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,
  payload         jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status          job_status not null default 'queued',
  attempts        smallint not null default 0,
  max_attempts    smallint not null default 5,
  last_error      text,
  run_after       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index jobs_claimable_idx on jobs(status, run_after) where status = 'queued';

-- ------------------------------------------------------------------ triggers

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'markets', 'households', 'household_members', 'preference_profiles',
    'taste_signals', 'category_stats', 'weekend_checkins', 'place_refs', 'plans',
    'plan_items', 'subscriptions', 'notification_preferences', 'jobs'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t
    );
  end loop;
end $$;
