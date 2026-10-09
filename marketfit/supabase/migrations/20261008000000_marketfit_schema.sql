-- MarketFit v1 schema (BUILD_BRIEF.md §4).
--
-- Two kinds of reader:
--
--   service_role   the app's server. Bypasses RLS. Writes everything: catalogue
--                  sync, facts, assessments, rules (from the YAML seed only).
--   authenticated  a merchant, identified by a `merchant_id` claim in a JWT
--                  the app server mints for the shop. Reads only its own rows,
--                  reads rules and markets, writes nothing it could use to
--                  change a verdict.
--
-- RLS is on for every table. `anon` gets nothing.
--
-- Additions to §4, each because something else in the brief needs it:
--   rules.title, rules.fix, rules.applies_if  the finding view shows "what's
--       wrong → which rule → citation → the fix" (§2.2) and the US iron warning
--       only binds iron products
--   rules.category, rules.retired_at  rules are per category; a rule removed
--       from the YAML is retired, never deleted, so old findings still resolve
--   assessments.score 'not_assessed'  no score without verified rules (§9)
--   merchants.access_token is sealed by the app (AES-256-GCM, bound to the
--       shop) before it is written; the database never holds a usable token
--   merchants.token_meta  expiry and refresh state for expiring offline tokens
--   products.shopify_updated_at  a late webhook must not overwrite newer data

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ helpers

-- The merchant a request is for, from the JWT the app server minted. Null for
-- any token without the claim, which makes every merchant policy below false.
create or replace function public.current_merchant_id() returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(coalesce(auth.jwt() ->> 'merchant_id', ''), '')::uuid
$$;

-- ------------------------------------------------------------------ markets

create table public.markets (
  code text primary key check (code in ('EU', 'UK', 'US')),
  name text not null,
  languages text[] not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true
);

insert into public.markets (code, name, languages, currency) values
  ('EU', 'European Union', array['de', 'fr'], 'EUR'),
  ('UK', 'United Kingdom', array['en'], 'GBP'),
  ('US', 'United States', array['en'], 'USD');

-- ------------------------------------------------------------------ merchants

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null unique check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  -- Sealed by the app before it arrives (src/server/crypto.ts). Never selectable
  -- by a merchant: see the column grant below.
  access_token text,
  token_meta jsonb not null default '{}'::jsonb,
  install_state text not null default 'active' check (install_state in ('active', 'needs_reauth', 'uninstalled')),
  plan text,
  origin_market text,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ catalogue

create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  shopify_product_id text not null,
  title text not null,
  -- 'supplements' when detected; null when not (yet) classified.
  category text,
  category_reason text,
  raw_json jsonb not null,
  shopify_updated_at timestamptz,
  extracted jsonb,
  extracted_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (merchant_id, shopify_product_id)
);
create index products_merchant_category on public.products (merchant_id, category);

create table public.product_facts (
  product_id uuid not null references public.products (id) on delete cascade,
  key text not null,
  value jsonb not null,
  source text not null check (source in ('shopify', 'label_upload', 'merchant_input', 'ai_extracted')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- An ai_extracted fact counts only once the merchant confirms it (§6.1).
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (product_id, key)
);

-- ------------------------------------------------------------------ rules

create table public.rules (
  -- Permanent: '{market}.{category}.{rule_key}', lower-case market.
  id text primary key,
  market_code text not null references public.markets (code),
  category text not null,
  rule_key text not null,
  kind text not null check (kind in ('required_field', 'prohibited_substance', 'limit', 'warning_text', 'language', 'registration', 'claim')),
  title text not null,
  fix text not null,
  params jsonb not null,
  applies_if jsonb,
  severity text not null check (severity in ('blocked', 'needs_attention', 'advisory')),
  -- No rule without a citation (§2.1): all four parts are required.
  citation jsonb not null check (
    citation ? 'regulation' and citation ? 'article' and citation ? 'url' and citation ? 'effective_from'
  ),
  confidence text not null check (confidence in ('verified', 'drafted', 'needs_review')),
  version integer not null check (version > 0),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (market_code, category, rule_key)
);

create table public.rule_sources (
  id uuid primary key default gen_random_uuid(),
  market_code text not null references public.markets (code),
  title text not null,
  url text not null check (url ~ '^https://'),
  last_checked_at timestamptz,
  hash text
);

-- ------------------------------------------------------------------ assessments

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  market_code text not null references public.markets (code),
  score text not null check (score in ('ready', 'needs_attention', 'blocked', 'not_assessed')),
  rules_version text not null,
  created_at timestamptz not null default now()
);
create index assessments_product_market on public.assessments (product_id, market_code, created_at desc);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  -- Restrict, not cascade: a rule that a finding cites is retired, never deleted.
  rule_id text not null references public.rules (id) on delete restrict,
  status text not null check (status in ('pass', 'fail', 'not_assessed')),
  scored boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  fix_text text
);
create index findings_assessment on public.findings (assessment_id);

create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  market_code text not null references public.markets (code),
  kind text not null check (kind in ('label_text', 'listing_copy', 'warning_block')),
  language text not null check (language ~ '^[a-z]{2}$'),
  content text not null,
  rules_version text not null,
  created_at timestamptz not null default now()
);

create table public.market_entitlements (
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  market_code text not null references public.markets (code),
  active_until timestamptz,
  primary key (merchant_id, market_code)
);

-- Webhook idempotency: one row per delivery id (src/shopify/idempotency.ts).
create table public.webhook_deliveries (
  webhook_id text primary key,
  shop_domain text not null,
  status text not null check (status in ('processing', 'done', 'failed')),
  started_at timestamptz not null
);
create index webhook_deliveries_shop on public.webhook_deliveries (shop_domain);

-- ------------------------------------------------------------------ RLS

alter table public.markets enable row level security;
alter table public.merchants enable row level security;
alter table public.products enable row level security;
alter table public.product_facts enable row level security;
alter table public.rules enable row level security;
alter table public.rule_sources enable row level security;
alter table public.assessments enable row level security;
alter table public.findings enable row level security;
alter table public.generated_assets enable row level security;
alter table public.market_entitlements enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Start from nothing, then grant exactly what each role reads.
revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.current_merchant_id() from public, anon;
grant execute on function public.current_merchant_id() to authenticated, service_role;

-- Global reference data: read-only to merchants.
grant select on public.markets, public.rules to authenticated;
create policy markets_read on public.markets for select to authenticated using (true);
create policy rules_read on public.rules for select to authenticated using (true);

-- The merchant's own row, without the token column.
grant select (id, shop_domain, install_state, plan, origin_market, installed_at, uninstalled_at, updated_at)
  on public.merchants to authenticated;
create policy merchants_own on public.merchants for select to authenticated
  using (id = public.current_merchant_id());

grant select on public.products, public.product_facts, public.assessments, public.findings,
  public.generated_assets, public.market_entitlements to authenticated;

create policy products_own on public.products for select to authenticated
  using (merchant_id = public.current_merchant_id());

create policy product_facts_own on public.product_facts for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.merchant_id = public.current_merchant_id()));

-- The one merchant write: confirming or correcting a fact (§7.3), on the
-- merchant's own products only. Whatever the merchant writes is confirmed, and
-- a changed value becomes the merchant's (the trigger below) — an edit can
-- never be passed off as something the model extracted.
grant update (value, confirmed, updated_at) on public.product_facts to authenticated;
create policy product_facts_confirm on public.product_facts for update to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.merchant_id = public.current_merchant_id()))
  with check (confirmed);

create or replace function public.product_facts_merchant_edit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.value is distinct from old.value then
      new.source := 'merchant_input';
      new.confidence := null;
    end if;
    new.updated_at := now();
  end if;
  return new;
end
$$;
create trigger product_facts_merchant_edit before update on public.product_facts
  for each row execute function public.product_facts_merchant_edit();

create policy assessments_own on public.assessments for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.merchant_id = public.current_merchant_id()));

create policy findings_own on public.findings for select to authenticated
  using (exists (
    select 1 from public.assessments a join public.products p on p.id = a.product_id
    where a.id = assessment_id and p.merchant_id = public.current_merchant_id()
  ));

create policy generated_assets_own on public.generated_assets for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.merchant_id = public.current_merchant_id()));

create policy market_entitlements_own on public.market_entitlements for select to authenticated
  using (merchant_id = public.current_merchant_id());

-- rule_sources and webhook_deliveries: server only. RLS on, no policies, no grants.

-- ------------------------------------------------------------------ server functions
--
-- Every server write that must be atomic is one function, called over
-- PostgREST RPC with the secret key (src/server/supabaseStore.ts). None is
-- callable by anon or authenticated.

-- Insert or update a merchant by shop domain; returns the row as JSON.
create function public.marketfit_put_merchant(p jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  insert into public.merchants as m (shop_domain, access_token, token_meta, install_state, plan, origin_market, installed_at, uninstalled_at, updated_at)
  values (
    p ->> 'shop_domain', p ->> 'access_token', coalesce(p -> 'token_meta', '{}'::jsonb),
    coalesce(p ->> 'install_state', 'active'), p ->> 'plan', p ->> 'origin_market',
    coalesce((p ->> 'installed_at')::timestamptz, now()), (p ->> 'uninstalled_at')::timestamptz, now()
  )
  on conflict (shop_domain) do update set
    access_token = excluded.access_token, token_meta = excluded.token_meta,
    install_state = excluded.install_state, plan = excluded.plan, origin_market = excluded.origin_market,
    installed_at = excluded.installed_at, uninstalled_at = excluded.uninstalled_at, updated_at = now()
  returning to_jsonb(m)
$$;

create function public.marketfit_get_merchant(p_shop text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(m) from public.merchants m where m.shop_domain = p_shop
$$;

-- Upsert products for a merchant. A row is only overwritten by data at least
-- as new as what it holds (a late webhook must not undo a newer sync). With
-- p_full, products not in the list are removed: a full sync is the truth.
-- Returns how many rows were written and removed.
create function public.marketfit_put_products(p_merchant uuid, p_products jsonb, p_full boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_written integer;
  v_removed integer := 0;
begin
  with incoming as (
    select * from jsonb_to_recordset(p_products) as x(
      shopify_product_id text, title text, category text, category_reason text,
      raw_json jsonb, shopify_updated_at timestamptz
    )
  ), written as (
    insert into public.products as p (merchant_id, shopify_product_id, title, category, category_reason, raw_json, shopify_updated_at, synced_at)
    select p_merchant, i.shopify_product_id, i.title, i.category, i.category_reason, i.raw_json, i.shopify_updated_at, now()
    from incoming i
    on conflict (merchant_id, shopify_product_id) do update set
      title = excluded.title, category = excluded.category, category_reason = excluded.category_reason,
      raw_json = excluded.raw_json, shopify_updated_at = excluded.shopify_updated_at, synced_at = now()
    where p.shopify_updated_at is null
       or excluded.shopify_updated_at is null
       or excluded.shopify_updated_at >= p.shopify_updated_at
    returning 1
  )
  select count(*) into v_written from written;

  if p_full then
    with gone as (
      delete from public.products p
      where p.merchant_id = p_merchant
        and p.shopify_product_id not in (select x ->> 'shopify_product_id' from jsonb_array_elements(p_products) x)
      returning 1
    )
    select count(*) into v_removed from gone;
  end if;

  return jsonb_build_object('written', v_written, 'removed', v_removed);
end
$$;

create function public.marketfit_list_products(p_merchant uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'shopify_product_id', p.shopify_product_id, 'title', p.title,
    'category', p.category, 'category_reason', p.category_reason,
    'shopify_updated_at', p.shopify_updated_at, 'synced_at', p.synced_at
  ) order by p.title), '[]'::jsonb)
  from public.products p where p.merchant_id = p_merchant
$$;

create function public.marketfit_remove_product(p_merchant uuid, p_shopify_product_id text) returns void
language sql security invoker set search_path = '' as $$
  delete from public.products where merchant_id = p_merchant and shopify_product_id = p_shopify_product_id
$$;

-- Claim a webhook delivery. Only one caller gets 'claimed'; a failed delivery,
-- or one abandoned mid-flight, may be claimed again.
create function public.marketfit_claim_delivery(
  p_webhook_id text, p_shop text, p_now timestamptz, p_abandoned_after interval
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
begin
  insert into public.webhook_deliveries as d (webhook_id, shop_domain, status, started_at)
  values (p_webhook_id, p_shop, 'processing', p_now)
  on conflict (webhook_id) do update set status = 'processing', started_at = excluded.started_at
  where d.status = 'failed'
     or (d.status = 'processing' and d.started_at <= p_now - p_abandoned_after);
  if found then
    return 'claimed';
  end if;
  select status into v_status from public.webhook_deliveries where webhook_id = p_webhook_id;
  return case when v_status = 'done' then 'already-processed' else 'in-flight' end;
end
$$;

create function public.marketfit_settle_delivery(p_webhook_id text, p_status text) returns void
language sql security invoker set search_path = '' as $$
  update public.webhook_deliveries set status = p_status where webhook_id = p_webhook_id
$$;

-- shop/redact: everything held for the shop. Products, facts, assessments,
-- findings, assets and entitlements go with the merchant by cascade.
create function public.marketfit_redact_shop(p_shop text) returns void
language sql security invoker set search_path = '' as $$
  delete from public.webhook_deliveries where shop_domain = p_shop;
  delete from public.merchants where shop_domain = p_shop;
$$;

revoke execute on function
  public.marketfit_put_merchant(jsonb),
  public.marketfit_get_merchant(text),
  public.marketfit_put_products(uuid, jsonb, boolean),
  public.marketfit_list_products(uuid),
  public.marketfit_remove_product(uuid, text),
  public.marketfit_claim_delivery(text, text, timestamptz, interval),
  public.marketfit_settle_delivery(text, text),
  public.marketfit_redact_shop(text),
  public.product_facts_merchant_edit()
from public, anon, authenticated;

grant execute on function
  public.marketfit_put_merchant(jsonb),
  public.marketfit_get_merchant(text),
  public.marketfit_put_products(uuid, jsonb, boolean),
  public.marketfit_list_products(uuid),
  public.marketfit_remove_product(uuid, text),
  public.marketfit_claim_delivery(text, text, timestamptz, interval),
  public.marketfit_settle_delivery(text, text),
  public.marketfit_redact_shop(text)
to service_role;

commit;
