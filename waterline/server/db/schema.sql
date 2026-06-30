-- Waterline persistence schema (BUILD_SPEC.md §9), PostgreSQL.
-- Run once against your database (e.g. Supabase):  psql "$DATABASE_URL" -f server/db/schema.sql
-- The app hydrates the in-memory store from these tables on boot and write-throughs
-- every mutation. Without DATABASE_URL the app runs purely in-memory (seed/snapshot).

create table if not exists stores (
  id              text primary key,
  shop_domain     text not null,
  name            text,
  currency        text default 'USD',
  fee_rate        numeric default 0.029,
  autopilot_on    boolean default true,
  autopilot_mode  text default 'guarded',   -- 'guarded' | 'ask'
  created_at      timestamptz default now()
);

-- Catalog + window metrics (the ingestion target). Per-store product rows.
create table if not exists products (
  store_id        text references stores(id) on delete cascade,
  id              text not null,            -- internal id (e.g. p1422…)
  shopify_id      text,
  title           text,
  short           text,
  category        text,
  cat_color       text,
  price           numeric,
  units           integer default 0,
  cogs_per_unit   numeric,
  cogs            numeric default 0,
  ship            numeric default 0,
  fees            numeric default 0,
  ads             numeric default 0,
  disc            numeric default 0,
  ret             numeric default 0,
  cogs_confidence text default 'estimated', -- 'verified' | 'estimated' | 'missing'
  updated_at      timestamptz default now(),
  primary key (store_id, id)
);

-- Merchant COGS overrides (flip confidence → verified).
create table if not exists cogs_overrides (
  store_id        text,
  product_id      text,
  cogs_per_unit   numeric not null,
  updated_at      timestamptz default now(),
  primary key (store_id, product_id)
);

-- Per-product attributed ad spend (BUILD_SPEC §4).
create table if not exists ad_spend (
  id                  text primary key,
  store_id            text references stores(id) on delete cascade,
  product_id          text,
  platform            text,                 -- 'meta' | 'google' | …
  campaign            text,
  spend               numeric default 0,
  attributed_revenue  numeric default 0,
  attribution_method  text,                 -- 'feed' | 'utm' | 'order'
  confidence          text,                 -- 'high' | 'medium' | 'low'
  window_start        date,
  window_end          date
);

-- Live state for generated plays the merchant has acted on.
create table if not exists play_state (
  store_id        text,
  play_id         text,
  state           text not null,            -- 'enabled' | 'paused'
  updated_at      timestamptz default now(),
  primary key (store_id, play_id)
);

-- Impact Ledger: proven before→after on every executed action.
create table if not exists ledger (
  id              text primary key,
  store_id        text references stores(id) on delete cascade,
  play_id         text,
  product_id      text,
  type            text,
  action          text,
  before_margin   numeric,
  after_margin    numeric,
  recovered       numeric default 0,
  series_json     jsonb,
  note            text,
  created_at      timestamptz default now(),
  reverted_at     timestamptz
);

-- Append-only action log — prior value captured for revert (BUILD_SPEC §6).
create table if not exists action_log (
  id               text primary key,
  store_id         text references stores(id) on delete cascade,
  play_id          text,
  kind             text,
  prior_value_json jsonb,
  new_value_json   jsonb,
  executed_at      timestamptz default now(),
  reverted_at      timestamptz
);

create table if not exists alerts (
  id              text primary key,
  store_id        text references stores(id) on delete cascade,
  product_id      text,
  severity        text,                     -- 'critical' | 'warning' | 'good'
  rule            text,
  title           text,
  body            text,
  created_at      timestamptz default now(),
  read_at         timestamptz,
  dismissed_at    timestamptz
);

create table if not exists alert_rules (
  store_id        text,
  rule_key        text,
  enabled         boolean default true,
  channel         text,
  threshold_json  jsonb,
  primary key (store_id, rule_key)
);

-- Guardrail policy toggles (server-enforced; BUILD_SPEC §7).
create table if not exists guardrails (
  store_id        text,
  idx             integer,
  label           text,
  enabled         boolean default true,
  primary key (store_id, idx)
);

-- Per-merchant OAuth access tokens (offline).
create table if not exists shop_tokens (
  shop          text primary key,         -- foo.myshopify.com
  store_id      text references stores(id) on delete cascade,
  access_token  text not null,
  scope         text,
  installed_at  timestamptz default now()
);

create index if not exists idx_products_store on products (store_id);
create index if not exists idx_ad_spend_store on ad_spend (store_id, product_id);
create index if not exists idx_ledger_store on ledger (store_id);
create index if not exists idx_action_log_store on action_log (store_id, executed_at desc);
