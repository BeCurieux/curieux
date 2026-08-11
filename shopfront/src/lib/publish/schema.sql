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
