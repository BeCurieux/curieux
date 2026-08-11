-- popuup — step 5 persistence.
--
-- Three tables. A store is a merchant's catalogue, ingested once and shared by
-- every shop built from it. A shop is a slug and a plan. A version is one
-- ShopConfig, appended on every regeneration and never overwritten.
--
-- Catalogue lives on the store rather than the version on purpose: re-ingesting
-- a merchant's prices updates every published shop at once, which is the whole
-- mechanism behind "constantly live". What a version pins is the merchandising,
-- because that is what a funnel event in step 6 has to be attributable to.
--
-- Run against a fresh Supabase project:
--   psql "$SUPABASE_DB_URL" -f src/lib/publish/schema.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- stores

create table if not exists public.stores (
  id           uuid primary key default gen_random_uuid(),
  store_url    text not null unique,
  catalogue    jsonb not null,
  -- The Catalogue Genome. Internal: it informs merchandising and is never
  -- served to a page. The public read policy below does not expose this table.
  genome       jsonb,
  ingested_at  timestamptz not null,
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------- shops

create table if not exists public.shops (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  slug               text not null unique,
  plan               text not null default 'free' check (plan in ('free', 'pro')),
  current_version_id uuid,
  created_at         timestamptz not null default now()
);

create index if not exists shops_store_id_idx on public.shops(store_id);

-- -------------------------------------------------------------- versions

create table if not exists public.shop_versions (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  version    integer not null,
  config     jsonb not null,
  -- Provenance, lifted out of config.meta so it can be queried across every
  -- shop ever published. A JSON path into a blob works right up until someone
  -- needs an index on it.
  prompt     text not null,
  audience   text,
  created_at timestamptz not null default now(),
  unique (shop_id, version)
);

create index if not exists shop_versions_shop_id_idx on public.shop_versions(shop_id);

-- The current-version pointer is added after the versions table exists so the
-- two foreign keys can point at each other without an ordering problem.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_current_version_id_fkey'
  ) then
    alter table public.shops
      add constraint shops_current_version_id_fkey
      foreign key (current_version_id) references public.shop_versions(id) on delete set null;
  end if;
end $$;

-- --------------------------------------------------------------------- RLS
--
-- Everything is denied by default and the anon key gets exactly one thing: read
-- access to published shops. Writes go through the service role, which lives on
-- the server and is never shipped to a browser.

alter table public.stores        enable row level security;
alter table public.shops         enable row level security;
alter table public.shop_versions enable row level security;

-- No policy on `stores`, deliberately. A shopper's page needs a catalogue, and
-- it gets one through the view below rather than through table access — which
-- is what keeps the `genome` column unreachable from a public key.

drop policy if exists "published shops are readable" on public.shops;
create policy "published shops are readable"
  on public.shops for select
  using (current_version_id is not null);

drop policy if exists "current versions are readable" on public.shop_versions;
create policy "current versions are readable"
  on public.shop_versions for select
  using (
    exists (
      select 1 from public.shops s
      where s.current_version_id = shop_versions.id
    )
  );

-- --------------------------------------------------------------------- view
--
-- What serving a public URL needs, in one round trip, with the Genome column
-- absent by construction rather than by a SELECT list somebody has to maintain.

create or replace view public.published_shops
with (security_invoker = true) as
select
  sh.slug,
  sh.plan,
  v.version,
  v.id          as version_id,
  v.config,
  st.catalogue,
  st.ingested_at,
  v.created_at  as published_at,
  sh.store_id
from public.shops sh
join public.shop_versions v on v.id = sh.current_version_id
join public.stores st       on st.id = sh.store_id;

comment on view public.published_shops is
  'Public read surface for a shop URL. Excludes stores.genome, which is internal and must never reach a page.';

-- `security_invoker` means the view runs as the caller, so the policies above
-- still apply. `stores` has no select policy, so a join through it is only
-- legal for the service role — and the anon key reads this view via the
-- function below instead.

create or replace function public.get_published_shop(want_slug text)
returns table (
  slug        text,
  plan        text,
  version     integer,
  version_id  uuid,
  config      jsonb,
  catalogue   jsonb,
  ingested_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select sh.slug, sh.plan, v.version, v.id, v.config, st.catalogue, st.ingested_at, v.created_at
  from public.shops sh
  join public.shop_versions v on v.id = sh.current_version_id
  join public.stores st       on st.id = sh.store_id
  where sh.slug = want_slug;
$$;

comment on function public.get_published_shop(text) is
  'The one public read path. security definer so an anon key can serve a shop without select access to stores; the column list is the allowlist, and genome is not in it.';

grant execute on function public.get_published_shop(text) to anon, authenticated;

-- ================================================================== step 6
-- Provenance is already above: shop_versions holds every prompt, stated
-- audience and ShopConfig, in columns rather than only inside a blob. What
-- follows is the funnel.
--
-- Three event types, closed. No properties bag and no custom events — those are
-- how an events table becomes an analytics product nobody asked for. Nothing
-- here carries a weight, a variant assignment or a score: PULSE stays in the
-- drawer until the logs contain enough real sessions to learn from, and a
-- column shaped for it now would be building the thing the rule forbids.

create table if not exists public.shop_events (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  -- The version that served the page. This is why publishing appends versions
  -- rather than overwriting: a regeneration must not reattribute yesterday's
  -- numbers to a shop nobody saw yesterday.
  version_id  uuid not null references public.shop_versions(id) on delete cascade,
  -- Random, generated in the browser, kept in sessionStorage. Not a cookie, not
  -- derived from anything about the person, and gone when the tab closes.
  session_id  text not null,
  type        text not null check (type in ('view', 'product_click', 'checkout_start')),
  handle      text,
  variant_id  text,
  -- Coarse, from the referrer the browser already sent. "instagram", not a URL.
  source      text,
  campaign    text,
  created_at  timestamptz not null default now()
);

create index if not exists shop_events_shop_id_created_idx on public.shop_events(shop_id, created_at desc);
create index if not exists shop_events_version_idx on public.shop_events(version_id);
create index if not exists shop_events_session_idx on public.shop_events(session_id);

alter table public.shop_events enable row level security;

-- No policy at all: events are written by the service role from the API route
-- and read by the service role for the funnel summary. A public key can neither
-- write one nor read anybody's.

create or replace function public.shop_funnel(want_slug text)
returns table (
  id         uuid,
  shop_id    uuid,
  version_id uuid,
  version    integer,
  session_id text,
  type       text,
  handle     text,
  variant_id text,
  source     text,
  campaign   text,
  created_at timestamptz
)
language sql
stable
as $$
  select e.id, e.shop_id, e.version_id, v.version, e.session_id, e.type,
         e.handle, e.variant_id, e.source, e.campaign, e.created_at
  from public.shop_events e
  join public.shops sh on sh.id = e.shop_id
  join public.shop_versions v on v.id = e.version_id
  where sh.slug = want_slug;
$$;

comment on function public.shop_funnel(text) is
  'Raw events for one shop. Not security definer and not granted to anon: the summary is the merchant''s, not the public''s. Aggregation happens in funnel/store.ts so the file and database adapters cannot compute a different rate.';
