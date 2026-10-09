-- Row-level security, checked as the roles a real request runs as.
-- Run by `pnpm db:check` after the migration and seed. Any failed assertion
-- raises, and psql runs with ON_ERROR_STOP, so the script exits non-zero.

\set ON_ERROR_STOP on

create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'RLS check failed: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- Two merchants, a product each, a fact each, an assessment each.
insert into public.merchants (id, shop_domain, access_token) values
  ('00000000-0000-0000-0000-00000000000a', 'shop-a.myshopify.com', 'v1.sealed-a'),
  ('00000000-0000-0000-0000-00000000000b', 'shop-b.myshopify.com', 'v1.sealed-b');
insert into public.products (id, merchant_id, shopify_product_id, title, category, raw_json) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'gid://shopify/Product/1', 'A vitamin', 'supplements', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'gid://shopify/Product/2', 'B vitamin', 'supplements', '{}');
insert into public.product_facts (product_id, key, value, source, confidence) values
  ('00000000-0000-0000-0000-0000000000a1', 'net_quantity', '"60 capsules"', 'ai_extracted', 0.9),
  ('00000000-0000-0000-0000-0000000000b1', 'net_quantity', '"90 capsules"', 'ai_extracted', 0.9);
insert into public.assessments (id, product_id, market_code, score, rules_version) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'EU', 'not_assessed', 'r-test'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1', 'EU', 'not_assessed', 'r-test');
insert into public.findings (assessment_id, rule_id, status, scored) values
  ('00000000-0000-0000-0000-0000000000a2', 'eu.supplements.net-quantity', 'pass', false),
  ('00000000-0000-0000-0000-0000000000b2', 'eu.supplements.net-quantity', 'pass', false);

-- ---------------------------------------------------------------- merchant A
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","merchant_id":"00000000-0000-0000-0000-00000000000a"}', false);

select pg_temp.expect((select count(*) from public.products) = 1, 'A sees only its own product');
select pg_temp.expect((select count(*) from public.product_facts) = 1, 'A sees only its own facts');
select pg_temp.expect((select count(*) from public.assessments) = 1, 'A sees only its own assessments');
select pg_temp.expect((select count(*) from public.findings) = 1, 'A sees only its own findings');
select pg_temp.expect((select count(*) from public.merchants) = 1, 'A sees only its own merchant row');
select pg_temp.expect((select count(*) from public.rules) > 0, 'A reads the rules');
select pg_temp.expect((select count(*) from public.markets) = 3, 'A reads the markets');

do $$ begin
  perform access_token from public.merchants;
  raise exception 'RLS check failed: A read access_token';
exception when insufficient_privilege then raise notice 'ok  A cannot read access_token';
end $$;

do $$ begin
  update public.rules set severity = 'advisory';
  raise exception 'RLS check failed: A updated a rule';
exception when insufficient_privilege then raise notice 'ok  A cannot write rules';
end $$;

do $$ begin
  insert into public.assessments (product_id, market_code, score, rules_version)
  values ('00000000-0000-0000-0000-0000000000a1', 'EU', 'ready', 'r-forged');
  raise exception 'RLS check failed: A wrote an assessment';
exception when insufficient_privilege then raise notice 'ok  A cannot write assessments';
end $$;

-- Confirming an extracted fact keeps it the model's; editing it makes it A's.
update public.product_facts set confirmed = true where key = 'net_quantity';
select pg_temp.expect((select source from public.product_facts where key = 'net_quantity') = 'ai_extracted', 'confirming keeps the source');
update public.product_facts set value = '"30 capsules"', confirmed = true where key = 'net_quantity';
select pg_temp.expect((select source from public.product_facts where key = 'net_quantity') = 'merchant_input', 'an edit becomes merchant_input');

do $$ begin
  update public.product_facts set confirmed = false where key = 'net_quantity';
  raise exception 'RLS check failed: A un-confirmed a fact';
exception when insufficient_privilege or check_violation then raise notice 'ok  A cannot write an unconfirmed fact';
end $$;

-- B's fact is untouched by A's updates.
reset role;
select pg_temp.expect(
  (select value #>> '{}' from public.product_facts where product_id = '00000000-0000-0000-0000-0000000000b1') = '90 capsules',
  'B''s fact is untouched by A');

-- ---------------------------------------------------------------- no claim, anon
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.products) = 0, 'a token without merchant_id sees no products');
reset role;

set role anon;
do $$ begin
  perform 1 from public.rules;
  raise exception 'RLS check failed: anon read rules';
exception when insufficient_privilege then raise notice 'ok  anon reads nothing';
end $$;
reset role;

-- A cited rule cannot be deleted, only retired.
do $$ begin
  delete from public.rules where id = 'eu.supplements.net-quantity';
  raise exception 'RLS check failed: a cited rule was deleted';
exception when foreign_key_violation then raise notice 'ok  a cited rule cannot be deleted';
end $$;

-- ---------------------------------------------------------------- server functions
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","merchant_id":"00000000-0000-0000-0000-00000000000a"}', false);
do $$ begin
  perform public.marketfit_get_merchant('shop-a.myshopify.com');
  raise exception 'RLS check failed: a merchant called a server function';
exception when insufficient_privilege then raise notice 'ok  merchants cannot call server functions';
end $$;
reset role;

set role service_role;
select pg_temp.expect(
  (public.marketfit_put_merchant('{"shop_domain":"shop-c.myshopify.com","access_token":"v1.x"}') ->> 'install_state') = 'active',
  'put_merchant inserts');
select pg_temp.expect(
  (public.marketfit_put_merchant('{"shop_domain":"shop-c.myshopify.com","access_token":"v1.y","install_state":"needs_reauth"}') ->> 'access_token') = 'v1.y',
  'put_merchant updates by shop');
select pg_temp.expect(public.marketfit_get_merchant('nobody.myshopify.com') is null, 'get_merchant: unknown shop is null');

do $$
declare m uuid := (public.marketfit_get_merchant('shop-c.myshopify.com') ->> 'id')::uuid;
begin
  perform pg_temp.expect((public.marketfit_put_products(m, '[
    {"shopify_product_id":"gid://shopify/Product/10","title":"Ten","category":"supplements","raw_json":{},"shopify_updated_at":"2026-10-01T00:00:00Z"},
    {"shopify_product_id":"gid://shopify/Product/11","title":"Eleven","category":null,"raw_json":{},"shopify_updated_at":"2026-10-01T00:00:00Z"}
  ]', true) ->> 'written')::int = 2, 'put_products writes a sync');
  perform pg_temp.expect((public.marketfit_put_products(m, '[
    {"shopify_product_id":"gid://shopify/Product/10","title":"Stale","category":null,"raw_json":{},"shopify_updated_at":"2026-09-01T00:00:00Z"}
  ]', false) ->> 'written')::int = 0, 'put_products refuses older data');
  perform pg_temp.expect((select title from public.products where merchant_id = m and shopify_product_id = 'gid://shopify/Product/10') = 'Ten', 'the newer row survives');
  perform pg_temp.expect((public.marketfit_put_products(m, '[
    {"shopify_product_id":"gid://shopify/Product/10","title":"Ten v2","category":"supplements","raw_json":{},"shopify_updated_at":"2026-10-02T00:00:00Z"}
  ]', true) ->> 'removed')::int = 1, 'a full sync removes products no longer in the shop');
  perform pg_temp.expect(jsonb_array_length(public.marketfit_list_products(m)) = 1, 'list_products');
  perform public.marketfit_remove_product(m, 'gid://shopify/Product/10');
  perform pg_temp.expect(jsonb_array_length(public.marketfit_list_products(m)) = 0, 'remove_product');
end $$;

select pg_temp.expect(public.marketfit_claim_delivery('w1', 'shop-c.myshopify.com', now(), interval '5 minutes') = 'claimed', 'claim: first');
select pg_temp.expect(public.marketfit_claim_delivery('w1', 'shop-c.myshopify.com', now(), interval '5 minutes') = 'in-flight', 'claim: in flight');
select pg_temp.expect(public.marketfit_claim_delivery('w1', 'shop-c.myshopify.com', now() + interval '6 minutes', interval '5 minutes') = 'claimed', 'claim: abandoned');
select public.marketfit_settle_delivery('w1', 'failed');
select pg_temp.expect(public.marketfit_claim_delivery('w1', 'shop-c.myshopify.com', now(), interval '5 minutes') = 'claimed', 'claim: failed is retryable');
select public.marketfit_settle_delivery('w1', 'done');
select pg_temp.expect(public.marketfit_claim_delivery('w1', 'shop-c.myshopify.com', now(), interval '5 minutes') = 'already-processed', 'claim: done');

select public.marketfit_redact_shop('shop-a.myshopify.com');
reset role;
select pg_temp.expect(
  not exists (select 1 from public.merchants where shop_domain = 'shop-a.myshopify.com')
  and not exists (select 1 from public.products where merchant_id = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.assessments where id = '00000000-0000-0000-0000-0000000000a2'),
  'redact_shop removes the shop and everything under it');
select pg_temp.expect(exists (select 1 from public.products where merchant_id = '00000000-0000-0000-0000-00000000000b'), 'redact_shop leaves other shops alone');
