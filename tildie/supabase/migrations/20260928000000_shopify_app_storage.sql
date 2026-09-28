-- Franca's Shopify app, stage 3: storage.
--
-- Server-only. Every table has row-level security on and no policies, and the
-- public API roles have no grants, so the publishable key reads nothing. The
-- app reaches the data with the secret key (the service_role, which bypasses
-- RLS) and only through the functions below, so that each operation the app
-- performs is one atomic statement rather than a read-then-write race.
--
-- Access tokens arrive already encrypted by the app (src/server/crypto.ts);
-- this database never holds a usable Shopify token.

create table public.installations (
  shop               text primary key check (shop ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  state              text not null check (state in ('active', 'needs_reauth', 'uninstalled')),
  access_token_enc   text not null,
  refresh_token_enc  text,
  access_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  scopes             text[] not null default '{}',
  -- Null until the merchant chooses; a scan refuses to run without them.
  markets            text[],
  last_known_plan    text check (last_known_plan in ('starter', 'growth', 'studio')),
  installed_at       timestamptz not null,
  updated_at         timestamptz not null default now()
);

-- The last full scan's metadata. Its products are rows of their own, so a
-- webhook rescanning one product never rewrites another's.
create table public.catalogues (
  shop           text primary key references public.installations (shop) on delete cascade,
  scanned_at     timestamptz not null,
  jurisdictions  text[] not null,
  pack_versions  jsonb not null,
  truncated      boolean not null default false
);

create table public.product_scans (
  shop               text not null references public.catalogues (shop) on delete cascade,
  gid                text not null,
  -- The product's own updatedAt, for refusing a write older than what is held.
  product_updated_at timestamptz,
  scan               jsonb not null,
  primary key (shop, gid)
);

-- The webhook idempotency ledger, keyed on the delivery (X-Shopify-Webhook-Id).
create table public.webhook_deliveries (
  webhook_id  text primary key,
  shop        text,
  status      text not null check (status in ('processing', 'done', 'failed')),
  started_at  timestamptz not null
);
create index webhook_deliveries_started_at_idx on public.webhook_deliveries (started_at);
create index webhook_deliveries_shop_idx on public.webhook_deliveries (shop);

alter table public.installations      enable row level security;
alter table public.catalogues         enable row level security;
alter table public.product_scans      enable row level security;
alter table public.webhook_deliveries enable row level security;

revoke all on table public.installations, public.catalogues, public.product_scans, public.webhook_deliveries
  from anon, authenticated;

-- ---------------------------------------------------------------- installations

create function public.franca_get_installation(p_shop text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(i) from public.installations i where i.shop = p_shop
$$;

create function public.franca_put_installation(p_row jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into public.installations as i
    select * from jsonb_populate_record(null::public.installations, p_row)
  on conflict (shop) do update set
    state              = excluded.state,
    access_token_enc   = excluded.access_token_enc,
    refresh_token_enc  = excluded.refresh_token_enc,
    access_expires_at  = excluded.access_expires_at,
    refresh_expires_at = excluded.refresh_expires_at,
    scopes             = excluded.scopes,
    markets            = excluded.markets,
    last_known_plan    = excluded.last_known_plan,
    installed_at       = excluded.installed_at,
    updated_at         = excluded.updated_at
$$;

-- ---------------------------------------------------------------- catalogues

create function public.franca_get_catalogue(p_shop text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'scannedAt',     c.scanned_at,
    'jurisdictions', to_jsonb(c.jurisdictions),
    'packVersions',  c.pack_versions,
    'truncated',     c.truncated,
    'products',      coalesce((select jsonb_agg(p.scan order by p.gid)
                               from public.product_scans p where p.shop = c.shop), '[]'::jsonb)
  )
  from public.catalogues c where c.shop = p_shop
$$;

-- A full scan replaces everything for the shop in one transaction: a reader
-- sees the old catalogue or the new one, never half of each.
create function public.franca_replace_catalogue(
  p_shop text, p_scanned_at timestamptz, p_jurisdictions text[], p_pack_versions jsonb,
  p_truncated boolean, p_products jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.catalogues (shop, scanned_at, jurisdictions, pack_versions, truncated)
  values (p_shop, p_scanned_at, p_jurisdictions, p_pack_versions, p_truncated)
  on conflict (shop) do update set
    scanned_at = excluded.scanned_at, jurisdictions = excluded.jurisdictions,
    pack_versions = excluded.pack_versions, truncated = excluded.truncated;

  delete from public.product_scans where shop = p_shop;

  insert into public.product_scans (shop, gid, product_updated_at, scan)
  select p_shop, e->>'gid', (e->>'productUpdatedAt')::timestamptz, e->'scan'
  from jsonb_array_elements(p_products) as e;
end;
$$;

-- One product, written only if its copy is not older than what is held.
-- Returns false when the write was refused as stale, or when the shop has no
-- catalogue yet (the first full scan will read the product anyway).
create function public.franca_put_product_scan(
  p_shop text, p_gid text, p_product_updated_at timestamptz, p_scan jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.catalogues where shop = p_shop) then
    return false;
  end if;
  insert into public.product_scans as p (shop, gid, product_updated_at, scan)
  values (p_shop, p_gid, p_product_updated_at, p_scan)
  on conflict (shop, gid) do update set
    product_updated_at = excluded.product_updated_at, scan = excluded.scan
  where p.product_updated_at is null
     or excluded.product_updated_at is null
     or excluded.product_updated_at >= p.product_updated_at;
  return found;
end;
$$;

-- The copy changed and could not be reread: keep the old score, drop the mark.
create function public.franca_mark_product_stale(p_shop text, p_gid text)
returns void language sql security invoker set search_path = '' as $$
  update public.product_scans
     set scan = scan || '{"badge": false, "stale": true}'::jsonb
   where shop = p_shop and gid = p_gid
$$;

create function public.franca_remove_product_scan(p_shop text, p_gid text)
returns void language sql security invoker set search_path = '' as $$
  delete from public.product_scans where shop = p_shop and gid = p_gid
$$;

-- ---------------------------------------------------------------- webhooks

-- Claim a delivery, or say who has it. One statement, so two concurrent
-- deliveries with the same id cannot both be told they are first. A failed
-- delivery, or one abandoned mid-flight, may be claimed again.
create function public.franca_claim_delivery(
  p_webhook_id text, p_shop text, p_now timestamptz, p_abandoned_after interval
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
begin
  insert into public.webhook_deliveries as d (webhook_id, shop, status, started_at)
  values (p_webhook_id, p_shop, 'processing', p_now)
  on conflict (webhook_id) do update set status = 'processing', started_at = excluded.started_at
  where d.status = 'failed'
     or (d.status = 'processing' and d.started_at <= p_now - p_abandoned_after);
  if found then
    return 'claimed';
  end if;
  select status into v_status from public.webhook_deliveries where webhook_id = p_webhook_id;
  return case when v_status = 'done' then 'already-processed' else 'in-flight' end;
end;
$$;

create function public.franca_settle_delivery(p_webhook_id text, p_status text)
returns void language sql security invoker set search_path = '' as $$
  update public.webhook_deliveries set status = p_status where webhook_id = p_webhook_id
$$;

-- Deliveries older than Shopify's retry window plus a margin can never recur.
create function public.franca_prune_deliveries(p_before timestamptz)
returns integer language sql security invoker set search_path = '' as $$
  with gone as (delete from public.webhook_deliveries where started_at < p_before returning 1)
  select count(*)::integer from gone
$$;

-- ---------------------------------------------------------------- redaction

-- shop/redact: everything held for the shop. Catalogue and product scans go
-- with the installation by cascade.
create function public.franca_redact_shop(p_shop text)
returns void language sql security invoker set search_path = '' as $$
  delete from public.webhook_deliveries where shop = p_shop;
  delete from public.installations where shop = p_shop;
$$;

-- Only the server calls these.
revoke execute on function
  public.franca_get_installation(text),
  public.franca_put_installation(jsonb),
  public.franca_get_catalogue(text),
  public.franca_replace_catalogue(text, timestamptz, text[], jsonb, boolean, jsonb),
  public.franca_put_product_scan(text, text, timestamptz, jsonb),
  public.franca_mark_product_stale(text, text),
  public.franca_remove_product_scan(text, text),
  public.franca_claim_delivery(text, text, timestamptz, interval),
  public.franca_settle_delivery(text, text),
  public.franca_prune_deliveries(timestamptz),
  public.franca_redact_shop(text)
from public, anon, authenticated;

grant execute on function
  public.franca_get_installation(text),
  public.franca_put_installation(jsonb),
  public.franca_get_catalogue(text),
  public.franca_replace_catalogue(text, timestamptz, text[], jsonb, boolean, jsonb),
  public.franca_put_product_scan(text, text, timestamptz, jsonb),
  public.franca_mark_product_stale(text, text),
  public.franca_remove_product_scan(text, text),
  public.franca_claim_delivery(text, text, timestamptz, interval),
  public.franca_settle_delivery(text, text),
  public.franca_prune_deliveries(timestamptz),
  public.franca_redact_shop(text)
to service_role;
