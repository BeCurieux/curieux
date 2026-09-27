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
  -- Whose audience this shop was made for, when it was made for one. A small
  -- json object — handle, name, optional profile url — rather than a creators
  -- table, because there is nothing yet to hang off a creator row: no login, no
  -- payout, no ownership. A table with one useful column is a join for nothing.
  --
  -- It is supplied at publish time by whoever ran the command. It is not in
  -- ShopConfig and so it is not a field the model can fill, which is the point:
  -- an invented credit is a real person's name on a shop they never saw.
  creator            jsonb,
  -- Whether a rebuild may re-pick this shop's products from current stock.
  -- 'pinned' is the old behaviour: the selection is the merchant's until they
  -- change it. Both settings read the catalogue and only the catalogue.
  refresh            text not null default 'pinned' check (refresh in ('pinned', 'live')),
  current_version_id uuid,
  created_at         timestamptz not null default now()
);

-- Additive, like the provenance columns below, so re-running this file gives
-- them to a project that already has shops in it.
alter table public.shops add column if not exists creator jsonb;
alter table public.shops add column if not exists refresh text not null default 'pinned';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_refresh_check') then
    alter table public.shops
      add constraint shops_refresh_check check (refresh in ('pinned', 'live'));
  end if;
end $$;

create index if not exists shops_store_id_idx on public.shops(store_id);

-- "Every shop this creator has" — the one query attribution exists to answer.
-- Expression index rather than a column, since the handle is the only part of
-- the object anything looks up by.
create index if not exists shops_creator_handle_idx on public.shops((creator->>'handle'));

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
  -- What produced this version. The model is the one that *answered*, which
  -- with server-side fallbacks in force is not always the one that was asked;
  -- prompt_version is a content fingerprint of the merchandiser's system
  -- prompt, so it cannot drift from the text it describes the way a hand-set
  -- number does; genome_version identifies the enrichment pass behind the
  -- input. Nullable because rows written before these columns existed have no
  -- honest answer, and inventing one would be worse than a null.
  model          text,
  prompt_version text,
  genome_version text,
  created_at timestamptz not null default now(),
  unique (shop_id, version)
);

-- Added after the first shops were published, so re-running this file gives
-- them to an existing project too. `if not exists` rather than a migration
-- tool: this schema is applied by re-running it, and these three are additive.
alter table public.shop_versions add column if not exists model          text;
alter table public.shop_versions add column if not exists prompt_version text;
alter table public.shop_versions add column if not exists genome_version text;

create index if not exists shop_versions_shop_id_idx on public.shop_versions(shop_id);

-- The query these columns exist to make possible: every shop a given prompt
-- revision or model produced, joined to what those shops went on to do.
create index if not exists shop_versions_prompt_version_idx on public.shop_versions(prompt_version);
create index if not exists shop_versions_model_idx on public.shop_versions(model);

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

-- No policy on any of the three, deliberately. Not one of them needs table
-- access from a public key: every read this codebase performs goes through the
-- service role, and the one path built for an anon key is
-- `get_published_shop` below, which is `security definer` and therefore
-- unaffected by the absence of policies here.
--
-- `shops` and `shop_versions` did carry select policies — "published shops are
-- readable" and "current versions are readable" — and they were dropped rather
-- than narrowed. RLS is row-level, so a policy that let a shopper read a
-- published version handed them the whole row, and `shop_versions` rows carry
-- `prompt` and `audience`: the merchant's own campaign brief, in their own
-- words. "Clear the slow-moving knitwear before the sale" is not something a
-- merchant expects a competitor to be able to query.
--
-- The `drop` statements stay so that re-running this file against a project
-- created before the change actually removes them. Deleting these two lines
-- would leave the old policies in place on exactly the projects that have real
-- merchants in them.

drop policy if exists "published shops are readable" on public.shops;
drop policy if exists "current versions are readable" on public.shop_versions;

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
  sh.creator,
  sh.refresh,
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
  creator     jsonb,
  refresh     text,
  ingested_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select sh.slug, sh.plan, v.version, v.id, v.config, st.catalogue, sh.creator, sh.refresh,
         st.ingested_at, v.created_at
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

-- ---------------------------------------------------- early access requests

-- Somebody asking for a shop, from popuup's own contact form.
--
-- **This is the Sprint 3 email-capture gate, opened deliberately (2026-08-17).**
-- CLAUDE.md records the override. What opened is popuup's own form; what stays
-- shut is capture inside a generated shop, where a shopper is a different
-- person consenting to a different thing.
--
-- The only table in this schema holding personal data. Everything else popuup
-- stores is a public product feed or a random session id, so this is the one
-- worth being careful about:
--
--   * No policy at all, and RLS on. Written by the service role from the API
--     route and read by the service role. An anon key can neither insert a row
--     nor read anybody's — the same posture as shop_events, for stronger
--     reasons.
--   * No unique constraint on email. Somebody who submits twice because they
--     were not sure it worked has not done anything wrong, and a rejection
--     they cannot interpret is worse than a duplicate a human clears in a
--     second.
--   * No consent or marketing columns. Nothing here is a mailing list, and a
--     column shaped for one would be the next person's excuse to treat it as
--     one. This is an inbox with a schema.

create table if not exists public.early_access (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  -- Normalised to a bare host and path — "nectarandbone.com/collections/new".
  -- A note for a human to read, not a key anything is looked up by.
  store        text not null,
  brief        text,
  received_at  timestamptz not null default now()
);

create index if not exists early_access_received_idx on public.early_access(received_at desc);

alter table public.early_access enable row level security;

comment on table public.early_access is
  'Merchants asking for a shop. Service role only, no policy, no unique constraint on email. The one table here holding personal data.';

-- ======================================================= genome v1 (v5 M1)
--
-- The Catalogue Genome taxonomy (docs/HANDOFF.md §5–§8), opened on the
-- owner's call on 2026-09-26. CLAUDE.md records what opened and what did not.
--
-- The taxonomy and the price-band references are *seeded from code*
-- (src/lib/genome/v1/taxonomy.ts, price-bands.ts) by `pnpm genome:seed`. The
-- code is the source of truth and these rows are its published copy, so a
-- query can join a value to its definition.
--
-- Every table here is service-role only: RLS on, no policy. Nothing in this
-- block is readable by an anon key, the same posture as `stores`, whose
-- `genome` column these tables will eventually replace.
--
-- Nothing here holds or reads a shopper event. Behavioural evidence states
-- are columns so the data logged now is honest about what it is; nothing
-- advances them until the owner rules on exploration at M2.

create table if not exists public.taxonomy_versions (
  version     text primary key,
  status      text not null default 'active' check (status in ('draft', 'active', 'retired')),
  created_at  timestamptz not null default now()
);

create table if not exists public.taxonomy_values (
  version     text not null references public.taxonomy_versions(version),
  dimension   text not null,
  value       text not null,
  -- 'gift_role:practical'. Never renamed in place; a change is a new version.
  value_id    text not null,
  layer       text not null check (layer in ('global', 'merchant_relative')),
  label       text not null,
  definition  text not null,
  primary key (version, value_id)
);

create table if not exists public.price_band_references (
  version          text not null references public.taxonomy_versions(version),
  parent_category  text not null,
  currency         text not null,
  budget_max       numeric not null,
  mid_max          numeric not null,
  premium_max      numeric not null,
  primary key (version, parent_category, currency)
);

-- A thin product row: just enough to hang Genome values off and to know when
-- to reclassify. Not a mirror of the catalogue, which stays in
-- `stores.catalogue` (SHOPIFY-APP.md §3.1, amended for v5).
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  handle           text not null,
  shopify_id       text,
  title            text not null,
  -- Classifier-supplied, for choosing price bands. Not a Genome dimension.
  parent_category  text,
  -- Hash of exactly what the classifier saw. A change means reclassify.
  inputs_hash      text not null,
  -- '<model>@<prompt_version>x<runs>' of the stored model values.
  classified_with  text,
  updated_at       timestamptz not null default now(),
  unique (store_id, handle)
);

create index if not exists products_store_idx on public.products(store_id);

-- One row per value (HANDOFF §6.2). Multi-label dimensions are several rows.
-- `store_id` stands in for the spec's merchant_id until installations exist.
create table if not exists public.genome_values (
  id                bigint generated always as identity primary key,
  product_id        uuid not null references public.products(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  dimension         text not null,
  value             text not null,
  layer             text not null check (layer in ('global', 'merchant_relative')),
  taxonomy_version  text not null references public.taxonomy_versions(version),
  provenance        text not null check (provenance in ('taxonomy_model', 'deterministic_rule', 'merchant_declared', 'behaviour_inferred', 'human_reviewed')),
  -- Measured: run agreement, or 1 for a rule or a declaration. Never a score
  -- the model reported about itself. Null when the runs split.
  confidence        numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_state    text check (evidence_state is null or evidence_state in ('unobserved', 'provisional', 'evidenced')),
  raw_value         text,
  comparison_scope  text check (comparison_scope is null or comparison_scope in ('product_type', 'store', 'global_reference')),
  comparison_n      integer,
  percentile        numeric,
  derived_at        timestamptz not null,
  inputs_hash       text not null,
  run_agreement     text,
  model             text,
  prompt_version    text,
  unique (product_id, dimension, value, taxonomy_version, provenance)
);

create index if not exists genome_values_store_idx on public.genome_values(store_id, dimension);
create index if not exists genome_values_product_idx on public.genome_values(product_id);

-- The agreement gate's verdict per dimension (HANDOFF §8), written by
-- `pnpm genome:eval`. Cross-merchant eligibility reads it; nothing else may.
create table if not exists public.taxonomy_gate (
  taxonomy_version  text not null references public.taxonomy_versions(version),
  dimension         text not null,
  kappa             numeric,
  items             integer not null,
  verdict           text not null check (verdict in ('keep', 'tighten', 'redefine', 'insufficient')),
  eval_run_id       uuid,
  decided_at        timestamptz not null default now(),
  primary key (taxonomy_version, dimension)
);

-- ------------------------------------------------------ labelling (gold set)

-- A frozen snapshot of each product put in front of the labellers: title,
-- description, images, price. Frozen so that a merchant editing a listing
-- mid-labelling cannot make two labellers answer about two different things.
create table if not exists public.gold_items (
  id               uuid primary key default gen_random_uuid(),
  gold_set         text not null,
  store_url        text not null,
  handle           text not null,
  parent_category  text,
  snapshot         jsonb not null,
  created_at       timestamptz not null default now(),
  unique (gold_set, store_url, handle)
);

-- The external merchandisers. They arrive by invite link: the token is shown
-- once, only its sha256 is stored, and the name is the one they were invited
-- under. No login, no contact details.
create table if not exists public.labellers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create table if not exists public.gold_labels (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.gold_items(id) on delete cascade,
  labeller_id       uuid not null references public.labellers(id) on delete cascade,
  dimension         text not null,
  labels            text[] not null,
  taxonomy_version  text not null,
  labelled_at       timestamptz not null default now(),
  unique (item_id, labeller_id, dimension, taxonomy_version)
);

create index if not exists gold_labels_item_idx on public.gold_labels(item_id);

create table if not exists public.eval_runs (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('agreement', 'model')),
  taxonomy_version  text not null,
  prompt_version    text,
  model             text,
  config            jsonb not null default '{}'::jsonb,
  metrics           jsonb not null,
  created_at        timestamptz not null default now()
);

alter table public.taxonomy_versions     enable row level security;
alter table public.taxonomy_values       enable row level security;
alter table public.price_band_references enable row level security;
alter table public.products              enable row level security;
alter table public.genome_values         enable row level security;
alter table public.taxonomy_gate         enable row level security;
alter table public.gold_items            enable row level security;
alter table public.labellers             enable row level security;
alter table public.gold_labels           enable row level security;
alter table public.eval_runs             enable row level security;

-- Cross-merchant eligibility (HANDOFF §6.2), as a view rather than a stored
-- flag so it cannot go stale against the gate. Mirrors
-- `crossMerchantEligible()` in src/lib/genome/v1/records.ts; the 0.8
-- confidence threshold is the open question's default. Nothing reads this yet:
-- cross-merchant learning is out of V1.
create or replace view public.genome_values_eligible
with (security_invoker = true) as
select gv.*
from public.genome_values gv
join public.taxonomy_gate g
  on g.taxonomy_version = gv.taxonomy_version and g.dimension = gv.dimension and g.verdict = 'keep'
where gv.dimension not in ('margin_band', 'style_register')
  and gv.value <> 'unknown'
  and (gv.provenance in ('human_reviewed', 'merchant_declared', 'deterministic_rule') or gv.confidence >= 0.8)
  and (gv.evidence_state is null or gv.evidence_state = 'evidenced')
  and (gv.layer = 'global' or gv.comparison_scope is null or gv.comparison_scope = 'global_reference' or gv.comparison_n >= 10);

-- ============================================================ POPs (v5 M2)
--
-- A POP is a standing merchandising instruction: a merchant's sentence, the
-- brief it was settled into, and the rules it must keep. It publishes as an
-- ordinary shop (`shops`, `shop_versions`), so the renderer and the funnel
-- serve it unchanged. These tables hold what a shop row cannot: the brief,
-- and why each product is on the page (HANDOFF §5, §7).
--
-- Opened on the owner's call (2026-09-26) as M2's engine. Service role only,
-- like every table here that holds a merchant's words.

create table if not exists public.pops (
  id                uuid primary key default gen_random_uuid(),
  shop_slug         text not null unique references public.shops(slug) on delete cascade,
  sentence          text not null,
  -- The brief as the merchant confirmed it: who, why, goal, rules, targets.
  brief             jsonb not null,
  status            text not null default 'live' check (status in ('draft', 'live', 'paused', 'ended')),
  locked_handles    text[] not null default '{}',
  excluded_handles  text[] not null default '{}',
  created_at        timestamptz not null default now(),
  ended_at          timestamptz
);

-- One per published version, immutable: the brief it was generated from, the
-- ranked shortlist the model saw, what the filter excluded and why, and any
-- repair the guard made. Enough to answer "why is this on the page?" for any
-- version ever served.
create table if not exists public.pop_versions (
  id                    uuid primary key default gen_random_uuid(),
  pop_id                uuid not null references public.pops(id) on delete cascade,
  shop_version_id       uuid not null references public.shop_versions(id) on delete cascade,
  version               integer not null,
  brief                 jsonb not null,
  shortlist             jsonb not null,
  excluded              jsonb not null,
  repairs               jsonb not null default '[]'::jsonb,
  -- The keyword collection the same sentence would have made, and the overlap:
  -- the "collection with a nicer header" objection, measured per version.
  baseline              jsonb,
  taxonomy_version      text not null,
  brief_prompt_version  text,
  created_at            timestamptz not null default now(),
  unique (pop_id, version)
);

-- What POPUUP chose to show, per product per version (Genome rule 6: kept
-- apart from whatever happened after). `is_exploration` is constrained to
-- false: reserved exposure (D7) waits on its own ruling, and allowing it will
-- take a migration that someone has to decide to write.
create table if not exists public.pop_decisions (
  id                bigint generated always as identity primary key,
  pop_version_id    uuid not null references public.pop_versions(id) on delete cascade,
  handle            text not null,
  position          integer not null,
  role              text not null check (role in ('hero', 'supporting', 'add_on')),
  reason            text not null,
  concepts          text[] not null default '{}',
  score             numeric,
  is_exploration    boolean not null default false check (is_exploration = false),
  decision_source   text not null check (decision_source in ('engine', 'merchant_lock', 'maintenance_replacement')),
  unique (pop_version_id, position)
);

create index if not exists pop_versions_pop_idx on public.pop_versions(pop_id);
create index if not exists pop_decisions_version_idx on public.pop_decisions(pop_version_id);

alter table public.pops          enable row level security;
alter table public.pop_versions  enable row level security;
alter table public.pop_decisions enable row level security;
