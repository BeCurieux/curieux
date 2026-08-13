-- Quotio schema (brief §32).
--
-- Run this once in the Supabase SQL editor, then set DATA_STORE=supabase.
--
-- The widget document lives in one jsonb column rather than being shredded
-- into tables. Adding an input type, a result kind or a whole new widget type
-- (§3 lists six for "later") is then a change to src/lib/widget/schema.ts and
-- nothing else — no migration, no backfill, no version skew between the
-- renderer and the database.

create extension if not exists pgcrypto;

/* users -------------------------------------------------------------- */

create table if not exists public.users (
  id            text primary key,
  -- Null while the author is still anonymous (§27). They can build, edit and
  -- preview a widget before we ever ask who they are.
  email         text unique,
  password_hash text,
  plan          text not null default 'free' check (plan in ('free', 'pro', 'business')),
  created_at    timestamptz not null default now()
);

create table if not exists public.sessions (
  token      text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id);

/* widgets ------------------------------------------------------------ */

create table if not exists public.widgets (
  id             text primary key,
  owner_id       text not null references public.users (id) on delete cascade,
  name           text not null,
  type           text not null check (type in ('calculator', 'estimator', 'quiz')),
  slug           text not null unique,
  status         text not null default 'draft' check (status in ('draft', 'published')),
  -- What the builder edits.
  schema_json    jsonb not null,
  -- What the world sees. Editing a live widget must not change it until the
  -- author presses Publish (§34).
  published_json jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  -- A published widget without a published document would 404 in public.
  constraint widgets_published_has_schema
    check (status <> 'published' or published_json is not null)
);

create index if not exists widgets_owner_idx on public.widgets (owner_id, updated_at desc);

create table if not exists public.widget_versions (
  id          text primary key,
  widget_id   text not null references public.widgets (id) on delete cascade,
  schema_json jsonb not null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists widget_versions_widget_idx
  on public.widget_versions (widget_id, created_at desc);

/* analytics ---------------------------------------------------------- */

create table if not exists public.widget_events (
  id            text primary key,
  widget_id     text not null references public.widgets (id) on delete cascade,
  -- Anonymous, per-tab, from sessionStorage. Not a visitor identity (§26).
  session_id    text not null,
  event_type    text not null check (event_type in (
                  'widget_view', 'widget_start', 'step_complete',
                  'widget_complete', 'result_view', 'cta_click', 'lead_submit')),
  step_id       text,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists widget_events_widget_idx
  on public.widget_events (widget_id, created_at desc);
create index if not exists widget_events_rollup_idx
  on public.widget_events (widget_id, event_type, session_id);

/* leads -------------------------------------------------------------- */

create table if not exists public.leads (
  id            text primary key,
  widget_id     text not null references public.widgets (id) on delete cascade,
  name          text,
  email         text,
  phone         text,
  message       text,
  -- The answers that produced the quote, so a lead arrives with its context.
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists leads_widget_idx on public.leads (widget_id, created_at desc);

/* billing ------------------------------------------------------------ */

create table if not exists public.subscriptions (
  user_id                text primary key references public.users (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status                 text not null default 'inactive'
);

/* row level security -------------------------------------------------- */

-- Every table is locked. There are no policies, which means the anon and
-- authenticated keys can read and write nothing at all: the only way in is
-- the service-role key, used exclusively by server code that has already
-- performed its own ownership check. See src/lib/db/supabase.ts for why the
-- usual "RLS against auth.uid()" pattern doesn't fit an app whose users can
-- create content before they have an account.

alter table public.users           enable row level security;
alter table public.sessions        enable row level security;
alter table public.widgets         enable row level security;
alter table public.widget_versions enable row level security;
alter table public.widget_events   enable row level security;
alter table public.leads           enable row level security;
alter table public.subscriptions   enable row level security;

-- Password reset links (§27 follow-on).
--
-- Single-use and short-lived. `used_at` is what makes redemption idempotent:
-- consumePasswordReset updates where used_at is null, so two requests carrying
-- the same link race here and exactly one wins.
create table if not exists public.password_resets (
  token       text primary key,
  user_id     text not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index if not exists password_resets_user_idx
  on public.password_resets (user_id);

-- Rate limiting (lib/ratelimit.ts).
--
-- Fixed windows, one row per key. The row is rewritten rather than appended
-- to when a new window starts, so this table stays the size of the number of
-- things currently being limited rather than growing forever.
create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  count         integer not null default 0
);

-- Counting has to be atomic, or two requests arriving together both read the
-- old value and both write the same new one — which is how a limit of 10
-- quietly becomes a limit of 20 under exactly the load it exists for.
create or replace function public.bump_rate_limit(p_key text, p_window_start timestamptz)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
    values (p_key, p_window_start, 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start = excluded.window_start
            then public.rate_limits.count + 1
          else 1
        end,
        window_start = excluded.window_start
    returning count into new_count;
  return new_count;
end;
$$;
