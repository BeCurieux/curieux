-- Row level security and entitlement tests for the schema migration
-- (20261103000002_schema.sql). Runs after rls.sql in the same database,
-- with its own people. Any failed assertion stops the run.
--
--   Dot  free (signed in, nothing bought)
--   Eve  module0, with the benchmark-pack bump
--   Fay  course, then refunded
--   Gia  founding
--   Hal  admin

\set ON_ERROR_STOP on
set client_min_messages = warning;

\ir helpers.sql

-- A lead arrives before she signs up; the account links to it later.
insert into public.leads (email, source) values ('dot@example.test', 'product_check');

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'dot@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'eve@example.test'),
  ('ffffffff-0000-0000-0000-000000000001', 'fay@example.test'),
  ('99999999-0000-0000-0000-000000000001', 'gia@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'hal@example.test');
insert into public.admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

-- And a lead captured after the account exists links straight away.
insert into public.leads (email, source) values ('eve@example.test', 'hype_check');

do $$ begin
  if (select converted_user_id from public.leads where email = 'dot@example.test') is distinct from 'dddddddd-0000-0000-0000-000000000001' then
    raise exception 'lead not linked when the account was created';
  end if;
  if (select converted_user_id from public.leads where email = 'eve@example.test') is distinct from 'eeeeeeee-0000-0000-0000-000000000001' then
    raise exception 'lead not linked when captured after sign-up';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Products: AUD as the spec prices them, USD converted (migration 3), no GST.

do $$ begin
  if (select string_agg(slug || ':' || tier || ':' || price_aud_cents || ':' || price_usd_cents, ',' order by price_aud_cents, slug) from public.products)
     <> 'product-check:free:0:0,benchmark-pack:benchmark_pack:2900:2000,module-0:module0:4900:3400,course:course:25000:17500,founding:founding:34900:24400' then
    raise exception 'products seed wrong: %', (select string_agg(slug || ':' || price_aud_cents || ':' || price_usd_cents, ',') from public.products);
  end if;
  if (select places_total from public.products where tier = 'founding') <> 30 then raise exception 'founding places_total must be 30'; end if;
  if (select count(*) from public.products where places_total is not null) <> 1 then raise exception 'only founding is limited'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and column_name ~* '(gst|tax)') then
    raise exception 'a tax column exists';
  end if;
end $$;

-- The database refuses a 31st founding place, whatever the app does.
select pg_temp.expect_error($q$update public.products set places_sold = 31 where tier = 'founding'$q$, '31st founding place');
update public.products set places_sold = 30 where tier = 'founding';
update public.products set places_sold = 0 where tier = 'founding';
select pg_temp.expect_error($q$update public.products set places_sold = -1 where tier = 'founding'$q$, 'negative places_sold');

-- Anyone reads active products; nobody but the server changes them.
update public.products set active = false where tier = 'benchmark_pack';
begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.products) <> 4 then raise exception 'anon should see the 4 active products'; end if;
end $$;
select pg_temp.expect_error($q$update public.products set price_aud_cents = 1$q$, 'anon changes a price');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.products set price_aud_cents = 1$q$, 'customer changes a price');
select pg_temp.expect_error($q$update public.products set places_sold = 0$q$, 'customer resets the counter');
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.products) <> 5 then raise exception 'admin should see inactive products too'; end if;
end $$;
commit;
update public.products set active = true where tier = 'benchmark_pack';

-- ---------------------------------------------------------------------------
-- Purchases, as the webhook will write them (service role / SQL).

insert into public.orders (id, user_id, product_id, stripe_session_id, amount_cents, currency, bump_product_id) values
  ('0e000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   (select id from public.products where tier = 'module0'), 'cs_test_eve', 7800, 'aud',
   (select id from public.products where tier = 'benchmark_pack')),
  ('0f000000-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
   (select id from public.products where tier = 'course'), 'cs_test_fay', 25000, 'aud', null),
  ('09000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001',
   (select id from public.products where tier = 'founding'), 'cs_test_gia', 34900, 'aud', null);
insert into public.entitlements (user_id, tier, granted_by_order_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'module0', '0e000000-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'benchmark_pack', '0e000000-0000-0000-0000-000000000001'),
  ('ffffffff-0000-0000-0000-000000000001', 'course', '0f000000-0000-0000-0000-000000000001'),
  ('99999999-0000-0000-0000-000000000001', 'founding', '09000000-0000-0000-0000-000000000001');

-- Idempotency: the same checkout session can't make a second order, and the
-- same order can't grant the same tier twice.
select pg_temp.expect_error($q$insert into public.orders (user_id, product_id, stripe_session_id, amount_cents, currency)
  values ('eeeeeeee-0000-0000-0000-000000000001', (select id from public.products where tier = 'module0'), 'cs_test_eve', 4900, 'aud')$q$, 'duplicate session');
select pg_temp.expect_error($q$insert into public.entitlements (user_id, tier, granted_by_order_id)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'module0', '0e000000-0000-0000-0000-000000000001')$q$, 'duplicate grant');
select pg_temp.expect_error($q$insert into public.orders (user_id, product_id, stripe_session_id, amount_cents, currency)
  values ('eeeeeeee-0000-0000-0000-000000000001', (select id from public.products where tier = 'module0'), 'cs_x', 4900, 'gbp')$q$, 'unsupported currency');
select pg_temp.expect_error($q$update public.orders set status = 'refunded' where stripe_session_id = 'cs_test_eve'$q$, 'refund without refunded_at');

-- ---------------------------------------------------------------------------
-- Entitlement resolution: the highest non-revoked tier; the pack is separate.

do $$ begin
  if public.tier_of('dddddddd-0000-0000-0000-000000000001') <> 'free' then raise exception 'dot should be free'; end if;
  if public.tier_of('eeeeeeee-0000-0000-0000-000000000001') <> 'module0' then raise exception 'eve should be module0'; end if;
  if public.tier_of('ffffffff-0000-0000-0000-000000000001') <> 'course' then raise exception 'fay should be course'; end if;
  if public.tier_of('99999999-0000-0000-0000-000000000001') <> 'founding' then raise exception 'gia should be founding'; end if;
  if public.tier_of(null) is not null then raise exception 'nobody has no tier'; end if;

  if public.has_benchmark_pack_of('dddddddd-0000-0000-0000-000000000001') then raise exception 'dot has no pack'; end if;
  if not public.has_benchmark_pack_of('eeeeeeee-0000-0000-0000-000000000001') then raise exception 'eve bought the pack'; end if;
  if not public.has_benchmark_pack_of('ffffffff-0000-0000-0000-000000000001') then raise exception 'course includes the pack'; end if;
  if not public.has_benchmark_pack_of('99999999-0000-0000-0000-000000000001') then raise exception 'founding includes the pack'; end if;
end $$;

-- Highest wins: Eve upgrades to the course and keeps her module0 row.
insert into public.entitlements (user_id, tier) values ('eeeeeeee-0000-0000-0000-000000000001', 'course');
do $$ begin
  if public.tier_of('eeeeeeee-0000-0000-0000-000000000001') <> 'course' then raise exception 'highest tier should win'; end if;
end $$;
-- A hand grant can't be duplicated while it's live.
select pg_temp.expect_error($q$insert into public.entitlements (user_id, tier) values ('eeeeeeee-0000-0000-0000-000000000001', 'course')$q$, 'duplicate hand grant');
update public.entitlements set revoked_at = now()
 where user_id = 'eeeeeeee-0000-0000-0000-000000000001' and tier = 'course';
do $$ begin
  if public.tier_of('eeeeeeee-0000-0000-0000-000000000001') <> 'module0' then raise exception 'revoked course should fall back to module0'; end if;
end $$;

-- A refund revokes immediately: Fay drops to free and loses the pack.
update public.orders set status = 'refunded', refunded_at = now() where stripe_session_id = 'cs_test_fay';
update public.entitlements set revoked_at = now() where granted_by_order_id = '0f000000-0000-0000-0000-000000000001';
do $$ begin
  if public.tier_of('ffffffff-0000-0000-0000-000000000001') <> 'free' then raise exception 'refund should revoke access'; end if;
  if public.has_benchmark_pack_of('ffffffff-0000-0000-0000-000000000001') then raise exception 'refund should revoke the included pack'; end if;
end $$;

-- The caller-only functions answer for the caller; the any-user ones are
-- the server's alone.
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if public.my_tier() <> 'module0' then raise exception 'my_tier wrong for eve'; end if;
  if not public.my_benchmark_pack() then raise exception 'my_benchmark_pack wrong for eve'; end if;
  if not public.can_access('module0') or public.can_access('course') then raise exception 'can_access wrong for eve'; end if;
end $$;
select pg_temp.expect_error($q$select public.tier_of('99999999-0000-0000-0000-000000000001')$q$, 'customer asks about another user');
select pg_temp.expect_error($q$select public.has_benchmark_pack_of('99999999-0000-0000-0000-000000000001')$q$, 'customer asks about another pack');
commit;
begin;
select pg_temp.act_as_anon();
select pg_temp.expect_error($q$select public.my_tier()$q$, 'anon my_tier');
select pg_temp.expect_error($q$select public.can_access('free')$q$, 'anon can_access');
commit;

-- ---------------------------------------------------------------------------
-- Orders and entitlements: her own, read-only.

begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.orders) <> 1 then raise exception 'eve should see only her order'; end if;
  if (select count(*) from public.entitlements) <> 3 then raise exception 'eve should see only her entitlements'; end if;
end $$;
select pg_temp.expect_error($q$insert into public.entitlements (user_id, tier) values ('eeeeeeee-0000-0000-0000-000000000001', 'founding')$q$, 'self-grant founding');
select pg_temp.expect_error($q$update public.entitlements set revoked_at = null$q$, 'un-revoke');
select pg_temp.expect_error($q$insert into public.orders (user_id, product_id, stripe_session_id, amount_cents, currency)
  values ('eeeeeeee-0000-0000-0000-000000000001', (select id from public.products where tier = 'course'), 'cs_fake', 0, 'aud')$q$, 'fake order');
select pg_temp.expect_error($q$delete from public.orders$q$, 'delete order');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'dot sees other orders'; end if;
  if (select count(*) from public.entitlements) <> 0 then raise exception 'dot sees other entitlements'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.orders) <> 3 then raise exception 'admin should read all orders'; end if;
  if (select count(*) from public.entitlements) <> 5 then raise exception 'admin should read all entitlements'; end if;
end $$;
select pg_temp.expect_error($q$insert into public.entitlements (user_id, tier) values ('aaaaaaaa-0000-0000-0000-000000000001', 'course')$q$, 'admin grants through the API');
commit;
begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'anon sees orders'; end if;
  if (select count(*) from public.entitlements) <> 0 then raise exception 'anon sees entitlements'; end if;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Content: modules and lessons readable by anyone, the unlocking columns not.

insert into public.modules (id, slug, number, title, position) values
  ('00000000-0000-0000-0000-0000000000a0', 'module-0', 0, 'Module 0', 0),
  ('00000000-0000-0000-0000-0000000000a1', 'module-1', 1, 'Module 1', 1);
insert into public.lessons (id, module_id, slug, number, title, min_tier, position, video_provider, video_id, script_md) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a0', 'landed-cost', '0.1', 'Free lesson', 'free', 1, 'bunny', 'vid-free', 'free script'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a0', 'price-ladder', '0.3', 'Module 0 lesson', 'module0', 3, 'youtube', 'vid-m0', 'm0 script'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'cash', '1.1', 'Course lesson', 'course', 1, 'bunny', 'vid-course', 'course script');
insert into public.lesson_assets (lesson_id, label, storage_path, kind) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cash sheet', 'module-1/cash.xlsx', 'sheet');
insert into public.calculators (slug, name, module_id, min_tier) values
  ('landed-cost', 'Landed Cost', '00000000-0000-0000-0000-0000000000a0', 'free'),
  ('price-ladder', 'Price Ladder', '00000000-0000-0000-0000-0000000000a0', 'module0'),
  ('cash-cycle', 'Cash Cycle', '00000000-0000-0000-0000-0000000000a1', 'course');

select pg_temp.expect_error($q$insert into public.lessons (module_id, slug, number, title, min_tier, position) values
  ('00000000-0000-0000-0000-0000000000a1', 'x', '1.9', 'x', 'founding', 9)$q$, 'founding as a lesson tier');
select pg_temp.expect_error($q$insert into public.lessons (module_id, slug, number, title, position, video_provider) values
  ('00000000-0000-0000-0000-0000000000a1', 'y', '1.8', 'y', 8, 'bunny')$q$, 'video provider without an id');

begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.modules) <> 2 then raise exception 'anon should read modules'; end if;
  if (select count(*) from (select id, title, summary, min_tier, video_provider, duration_sec from public.lessons) l) <> 3 then
    raise exception 'anon should read lesson outlines';
  end if;
  if (select count(*) from (select id, label, kind from public.lesson_assets) a) <> 1 then raise exception 'anon should read asset labels'; end if;
  if (select count(*) from public.calculators) <> 3 then raise exception 'anon should read calculators'; end if;
end $$;
select pg_temp.expect_error($q$select video_id from public.lessons$q$, 'anon reads video ids');
select pg_temp.expect_error($q$select script_md from public.lessons$q$, 'anon reads scripts');
select pg_temp.expect_error($q$select storage_path from public.lesson_assets$q$, 'anon reads storage paths');
select pg_temp.expect_error($q$select * from public.lessons$q$, 'anon selects every lesson column');
select pg_temp.expect_error($q$select * from public.lesson_content('00000000-0000-0000-0000-0000000000b1')$q$, 'anon gets lesson content');
select pg_temp.expect_error($q$update public.lessons set title = 'x'$q$, 'anon edits a lesson');
commit;

-- Signed in, the same: the columns are closed even to a founding member.
begin;
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select video_id from public.lessons$q$, 'member reads video ids directly');
select pg_temp.expect_error($q$select storage_path from public.lesson_assets$q$, 'member reads storage paths directly');
select pg_temp.expect_error($q$update public.calculators set min_tier = 'free'$q$, 'member unlocks a calculator');
commit;

-- lesson_content hands over the video and script only at the right tier.
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
do $$ begin
  if (select video_id from public.lesson_content('00000000-0000-0000-0000-0000000000b1')) <> 'vid-free' then raise exception 'free user should get the free lesson'; end if;
  if exists (select 1 from public.lesson_content('00000000-0000-0000-0000-0000000000b3')) then raise exception 'free user got a module0 lesson'; end if;
  if exists (select 1 from public.lesson_content('00000000-0000-0000-0000-0000000000c1')) then raise exception 'free user got a course lesson'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if (select script_md from public.lesson_content('00000000-0000-0000-0000-0000000000b3')) <> 'm0 script' then raise exception 'module0 user should get module0 lessons'; end if;
  if exists (select 1 from public.lesson_content('00000000-0000-0000-0000-0000000000c1')) then raise exception 'module0 user got a course lesson'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
do $$ begin
  if (select video_id from public.lesson_content('00000000-0000-0000-0000-0000000000c1')) <> 'vid-course' then raise exception 'founding should get course lessons'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
do $$ begin
  if exists (select 1 from public.lesson_content('00000000-0000-0000-0000-0000000000c1')) then raise exception 'refunded user still gets the course'; end if;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- lesson_progress: hers, only on lessons she can open.

begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000b1');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000c1')$q$, 'complete a locked lesson');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.lesson_progress (user_id, lesson_id) values ('eeeeeeee-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1')$q$, 'progress for someone else');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000b1')$q$, 'complete twice');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.lesson_progress) <> 0 then raise exception 'eve sees dot progress'; end if;
end $$;
delete from public.lesson_progress;
commit;
do $$ begin
  if (select count(*) from public.lesson_progress) <> 1 then raise exception 'eve deleted dot progress'; end if;
end $$;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
delete from public.lesson_progress;
commit;
do $$ begin
  if (select count(*) from public.lesson_progress) <> 0 then raise exception 'dot could not unmark her lesson'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- calc_runs: hers, on calculators her tier reaches.

begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
insert into public.calc_runs (calculator_slug, inputs_json, outputs_json) values ('landed-cost', '{"unit_cost": 4}', '{"true_cost": 6.1}');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.calc_runs (calculator_slug, inputs_json, outputs_json) values ('price-ladder', '{}', '{}')$q$, 'free user runs a module0 calculator');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.calc_runs set outputs_json = '{}'$q$, 'edit a saved run');
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.calc_runs (calculator_slug, inputs_json, outputs_json, currency) values ('landed-cost', '{}', '{}', 'GBP')$q$, 'unsupported currency');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
insert into public.calc_runs (calculator_slug, inputs_json, outputs_json, verdict, currency) values ('price-ladder', '{}', '{}', 'amber', 'USD');
select pg_temp.expect_error($q$insert into public.calc_runs (calculator_slug, inputs_json, outputs_json) values ('cash-cycle', '{}', '{}')$q$, 'module0 user runs a course calculator');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.calc_runs) <> 1 then raise exception 'eve should see only her run'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.calc_runs) <> 2 then raise exception 'admin should read all runs'; end if;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- verdicts: module0 and above; sending for review is founding only; the
-- review is the founder's and the server's.

begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.verdicts (product_name, verdict) values ('Candles', 'green')$q$, 'free user writes a verdict');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
insert into public.verdicts (id, product_name, verdict, reasons_json)
  values ('0e000000-0000-0000-0000-0000000000f1', 'Linen aprons', 'amber', '["Margin is 48%"]');
update public.verdicts set verdict = 'green' where id = '0e000000-0000-0000-0000-0000000000f1';
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.verdicts set submitted_at = now()$q$, 'module0 sends for review');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.verdicts set review_md = 'Great!', reviewed_at = now()$q$, 'customer writes her own review');
commit;
begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.verdicts (user_id, product_name, verdict) values ('99999999-0000-0000-0000-000000000001', 'x', 'red')$q$, 'verdict as someone else');
commit;

begin;
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
insert into public.verdicts (id, product_name, verdict, submitted_at)
  values ('09000000-0000-0000-0000-0000000000f1', 'Soy candles', 'green', now());
commit;
-- Once sent, it's fixed: edits and deletes match nothing.
begin;
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
update public.verdicts set verdict = 'red', submitted_at = null;
delete from public.verdicts;
commit;
do $$ begin
  if (select verdict::text || (submitted_at is not null)::text from public.verdicts where id = '09000000-0000-0000-0000-0000000000f1') <> 'greentrue' then
    raise exception 'a sent verdict was changed';
  end if;
end $$;

begin;
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.verdicts) <> 1 then raise exception 'eve sees other verdicts'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.verdicts) <> 2 then raise exception 'admin should read all verdicts'; end if;
end $$;
-- The admin reviews through the server, not the API.
select pg_temp.expect_error($q$update public.verdicts set review_md = 'x', reviewed_at = now() where id = '09000000-0000-0000-0000-0000000000f1'$q$, 'admin reviews through the API');
commit;
-- The server writes the review.
update public.verdicts set review_md = 'Strong margin; check the wax supplier.', reviewed_at = now()
 where id = '09000000-0000-0000-0000-0000000000f1';
select pg_temp.expect_error($q$update public.verdicts set review_md = 'x', reviewed_at = now() where id = '0e000000-0000-0000-0000-0000000000f1'$q$, 'review of an unsent verdict');

-- After a refund she can't keep writing verdicts.
begin;
select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.verdicts (product_name, verdict) values ('x', 'red')$q$, 'refunded user writes a verdict');
commit;

-- ---------------------------------------------------------------------------
-- leads and email_events: the server's; admins read.

begin;
select pg_temp.act_as_anon();
select pg_temp.expect_error($q$insert into public.leads (email, source) values ('spam@example.test', 'waitlist')$q$, 'anon inserts a lead');
do $$ begin
  if (select count(*) from public.leads) <> 0 then raise exception 'anon reads leads'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.leads) <> 0 then raise exception 'customer reads leads'; end if;
  if (select count(*) from public.email_events) <> 0 then raise exception 'customer reads email events'; end if;
end $$;
commit;
select pg_temp.expect_error($q$insert into public.leads (email, source) values ('Mixed@Example.test', 'waitlist')$q$, 'lead email not lowercased');
select pg_temp.expect_error($q$insert into public.leads (email, source) values ('x@example.test', 'billboard')$q$, 'unknown lead source');

insert into public.email_events (user_id, template) values ('eeeeeeee-0000-0000-0000-000000000001', 'onboarding_2');
insert into public.email_events (lead_email, template) values ('dot@example.test', 'nudge_2');
select pg_temp.expect_error($q$insert into public.email_events (user_id, template) values ('eeeeeeee-0000-0000-0000-000000000001', 'onboarding_2')$q$, 'same email twice');
select pg_temp.expect_error($q$insert into public.email_events (lead_email, template) values ('dot@example.test', 'nudge_2')$q$, 'same lead email twice');
select pg_temp.expect_error($q$insert into public.email_events (template) values ('onboarding_2')$q$, 'email with no recipient');
select pg_temp.expect_error($q$insert into public.email_events (user_id, lead_email, template) values ('eeeeeeee-0000-0000-0000-000000000001', 'eve@example.test', 'x')$q$, 'email with two recipients');

begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.leads) <> 2 then raise exception 'admin should read leads'; end if;
  if (select count(*) from public.email_events) <> 2 then raise exception 'admin should read email events'; end if;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Every table in public has row level security on, and updated_at moves.

do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity) then
    raise exception 'table without RLS: %', (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity);
  end if;
  if exists (
    select 1 from pg_tables t where t.schemaname = 'public'
      and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'updated_at')
  ) then raise exception 'table without updated_at'; end if;
  if exists (
    select 1 from pg_tables t where t.schemaname = 'public'
      and not exists (select 1 from pg_trigger g where g.tgrelid = format('public.%I', t.tablename)::regclass
                       and g.tgname = t.tablename || '_updated_at')
  ) then raise exception 'table without an updated_at trigger'; end if;
end $$;

-- Trigger and server-only functions aren't callable over the API.
do $$
declare
  fn text;
begin
  foreach fn in array array['public.link_lead_on_profile()', 'public.link_new_lead()', 'public.verdicts_guard_submit()',
                            'public.tier_of(uuid)', 'public.has_benchmark_pack_of(uuid)'] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute') then
      raise exception '% is callable over the API', fn;
    end if;
  end loop;
end $$;

-- Deleting an account keeps her orders (sales record) but nothing personal.
delete from auth.users where id = '99999999-0000-0000-0000-000000000001';
do $$ begin
  if (select user_id from public.orders where stripe_session_id = 'cs_test_gia') is not null then raise exception 'order should lose its user'; end if;
  if exists (select 1 from public.entitlements where user_id = '99999999-0000-0000-0000-000000000001') then raise exception 'entitlements survived'; end if;
  if exists (select 1 from public.verdicts where user_id = '99999999-0000-0000-0000-000000000001') then raise exception 'verdicts survived'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lesson access in one place (migration 5): tier, or the benchmark pack for
-- library lessons that say so.

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'pia@example.test'),
  ('cccccccc-0000-0000-0000-000000000001', 'quin@example.test');
-- Pia bought only the benchmark pack (say, a hand grant); Quin is free.
insert into public.entitlements (user_id, tier) values ('bbbbbbbb-0000-0000-0000-000000000001', 'benchmark_pack');
insert into public.modules (id, slug, number, title, position, hidden)
  values ('00000000-0000-0000-0000-0000000000a9', 'library', 9, 'Library', 9, true);
insert into public.lessons (id, module_id, slug, number, title, min_tier, position, opens_with_benchmark_pack, script_md) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a9', 'benchmarks', '9.1', 'Benchmarks', 'course', 1, true, 'benchmarks'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a9', 'templates', '9.2', 'Templates', 'course', 2, false, 'templates');

do $$ begin
  if not public.user_can_open_lesson('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1') then
    raise exception 'pack owner should open the benchmark lesson';
  end if;
  if public.user_can_open_lesson('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2') then
    raise exception 'pack owner should not open other course lessons';
  end if;
  if public.user_can_open_lesson('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1') then
    raise exception 'free user opened the benchmark lesson';
  end if;
  if not public.user_can_open_lesson('eeeeeeee-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1') then
    raise exception 'module0 buyer with the bump should open the benchmark lesson';
  end if;
  if public.user_can_open_lesson('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000') then
    raise exception 'a missing lesson opened';
  end if;
  if has_function_privilege('authenticated', 'public.user_can_open_lesson(uuid, uuid)', 'execute') then
    raise exception 'user_can_open_lesson is callable over the API';
  end if;
end $$;

begin;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  if (select script_md from public.lesson_content('00000000-0000-0000-0000-0000000000d1')) <> 'benchmarks' then
    raise exception 'pack owner should get the benchmark lesson content';
  end if;
  if exists (select 1 from public.lesson_content('00000000-0000-0000-0000-0000000000d2')) then
    raise exception 'pack owner got another course lesson';
  end if;
  if not public.can_open_lesson('00000000-0000-0000-0000-0000000000d1') then raise exception 'can_open_lesson wrong'; end if;
end $$;
insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($q$insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000d2')$q$, 'pack owner completes a course lesson');
commit;
begin;
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000d1')$q$, 'free user completes a pack lesson');
commit;
-- The flag is part of the public outline, so /learn can show the pack opens it.
begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.lessons where opens_with_benchmark_pack) <> 1 then
    raise exception 'anon should read opens_with_benchmark_pack';
  end if;
end $$;
commit;
