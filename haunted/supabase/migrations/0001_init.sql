-- Haunted Wishlist — data model (CLAUDE.md §Data model). RLS on everything,
-- keyed by shop_id. The storefront app block talks to a public endpoint that
-- only ever reads/writes rows for its own shop + subscriber; shop_id is never
-- trusted from the client — it is derived from the verified app-proxy signature.
--
-- The server (send job, cron, webhooks) uses the service-role key and bypasses
-- RLS. The anon key is never used to read across shops.

create extension if not exists "pgcrypto";

-- one row per installed store ------------------------------------------------
create table if not exists shops (
  id            uuid primary key default gen_random_uuid(),
  shop_domain   text unique not null,               -- avoca.myshopify.com
  access_token  text,                               -- encrypted at rest (app-side)
  persona       text not null default 'clingy_ex',  -- persona key
  cadence       text not null default 'normal',     -- gentle | normal | persistent
  triggers      jsonb not null default
                  '{"price_drop":true,"back_in_stock":true,"been_a_while":true,"low_stock":false,"abandoned_saved":false}',
  plan          text not null default 'trial',
  installed_at  timestamptz not null default now(),
  uninstalled_at timestamptz,
  constraint shops_persona_chk check (persona in ('clingy_ex','poet','deadpan')),
  constraint shops_cadence_chk check (cadence in ('gentle','normal','persistent'))
);

-- a browser that opted in to push, scoped to a shop --------------------------
create table if not exists subscribers (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  customer_id  text,                                -- Shopify customer, or null
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,                         -- set on 410 Gone / opt-out
  unique (shop_id, endpoint)
);

-- a saved item ---------------------------------------------------------------
create table if not exists wishlist_items (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  subscriber_id   uuid not null references subscribers(id) on delete cascade,
  product_id      text not null,                    -- Shopify product GID
  variant_id      text,
  title           text not null,
  image_url       text,
  price_cents     int not null,                     -- price at save time
  in_stock        boolean not null default true,
  saved_at        timestamptz not null default now(),
  released_at     timestamptz,                      -- soft delete ("Release")
  last_haunted_at timestamptz,
  haunt_count     int not null default 0
);
create index if not exists wishlist_items_shop_idx on wishlist_items(shop_id) where released_at is null;
create index if not exists wishlist_items_sub_idx on wishlist_items(subscriber_id);
create index if not exists wishlist_items_product_idx on wishlist_items(shop_id, product_id) where released_at is null;

-- every notification we attempted (audit + cadence source of truth) ----------
create table if not exists haunt_events (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  wishlist_item_id uuid not null references wishlist_items(id) on delete cascade,
  subscriber_id    uuid not null references subscribers(id) on delete cascade,
  trigger          text not null,
  persona          text not null,
  body             text not null default '',
  status           text not null,                   -- sent | suppressed_cadence | suppressed_safety | failed | clicked
  suppressed_reason text,
  created_at       timestamptz not null default now(),
  constraint haunt_events_status_chk check (
    status in ('sent','suppressed_cadence','suppressed_safety','failed','clicked')
  )
);
-- The cadence gate reads these windows constantly — index for them.
create index if not exists haunt_events_item_sent_idx
  on haunt_events(wishlist_item_id, created_at) where status = 'sent';
create index if not exists haunt_events_sub_sent_idx
  on haunt_events(subscriber_id, created_at) where status = 'sent';

-- Row Level Security ---------------------------------------------------------
-- Deny-by-default: enable RLS with no permissive policy for anon/authenticated.
-- All app access goes through the server using the service-role key, which
-- bypasses RLS. This guarantees no client can read another shop's rows even if
-- it forges a shop_id — the server derives shop_id from the verified session /
-- app-proxy HMAC before any query runs.
alter table shops           enable row level security;
alter table subscribers     enable row level security;
alter table wishlist_items  enable row level security;
alter table haunt_events    enable row level security;

alter table shops           force row level security;
alter table subscribers     force row level security;
alter table wishlist_items  force row level security;
alter table haunt_events    force row level security;
