-- Row level security tests. Each block acts as one customer and proves she
-- sees and changes only her own rows. Any failed assertion stops the run.

\set ON_ERROR_STOP on
set client_min_messages = warning;

grant all on all tables in schema public to service_role;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ava@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bea@example.test');

create function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'expected failure: %', label;
end $$;

-- Ava creates a profile and a product; Bea creates a profile.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.business_profiles (id, brand_name, category, audience, products_summary, market, currency, stage, fulfilment)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ava Linen', 'Home and living', 'New mums', 'Linen aprons', 'United States', 'USD', 'prelaunch', 'physical');
insert into public.products (id, profile_id, name) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Apron');
commit;

begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
insert into public.business_profiles (id, brand_name, category, audience, products_summary, market, currency, stage, fulfilment)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Bea Prints', 'Art and prints', 'Collectors', 'Prints', 'Australia', 'AUD', 'idea', 'digital');
commit;

-- Bea sees only her own profile and none of Ava's rows.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.business_profiles) <> 1 then raise exception 'bea sees other profiles'; end if;
  if (select count(*) from public.products) <> 0 then raise exception 'bea sees ava products'; end if;
  if (select count(*) from public.profile_versions) <> 1 then raise exception 'bea sees other history'; end if;
end $$;
-- Updating or deleting Ava's rows silently affects nothing.
update public.business_profiles set brand_name = 'Stolen' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.products where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
commit;

-- Bea cannot attach a product to Ava's profile, even naming her own user id.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error($q$insert into public.products (profile_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x')$q$, 'product on another profile');
commit;
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error($q$insert into public.products (user_id, profile_id, name) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'x')$q$, 'product as another user');
commit;
-- Nor a photo outside her folder.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error($q$insert into public.products (profile_id, name, image_paths) values ('bbbbbbbb-0000-0000-0000-000000000001', 'x', array['11111111-1111-1111-1111-111111111111/a.png'])$q$, 'image outside folder');
commit;

begin;
do $$ begin
  if (select brand_name from public.business_profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 'Ava Linen' then
    raise exception 'bea changed ava profile';
  end if;
  if (select count(*) from public.products where id = 'aaaaaaaa-0000-0000-0000-0000000000a1') <> 1 then
    raise exception 'bea deleted ava product';
  end if;
end $$;
commit;

-- Saving a profile bumps the version and keeps history; version can't be forged.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
update public.business_profiles set audience = 'New and expecting mums', last_note = 'Edited audience', version = 99
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  if (select version from public.business_profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 2 then
    raise exception 'version not bumped correctly';
  end if;
  if (select count(*) from public.profile_versions where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 2 then
    raise exception 'history not kept';
  end if;
  if (select note from public.profile_versions where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001' and version = 2) <> 'Edited audience' then
    raise exception 'note not kept';
  end if;
end $$;
-- History is read-only.
select pg_temp.expect_error($q$delete from public.profile_versions$q$, 'delete history');
commit;

-- Customers save edits, but cannot write model generations, entitlements,
-- usage, purchases or analytics.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.generations (profile_id, module, status, source, output, profile_version)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'theme_prompts', 'succeeded', 'edit', '{}', 2);
insert into public.generations (profile_id, module, status, source, output, profile_version)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'theme_prompts', 'succeeded', 'restore', '{}', 2);
do $$ begin
  if (select max(version) from public.generations) <> 2 then raise exception 'versions not sequential'; end if;
end $$;
commit;

begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.generations (profile_id, module, status, source, output, profile_version) values ('aaaaaaaa-0000-0000-0000-000000000001', 'theme_prompts', 'succeeded', 'ai', '{}', 2)$q$, 'forge ai generation');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$update public.generations set output = '{"x":1}'$q$, 'rewrite generation');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.entitlements (user_id, product_type, payment_provider, external_purchase_id, status) values ('11111111-1111-1111-1111-111111111111', 'launch_pack', 'manual', 'free', 'active')$q$, 'grant self entitlement');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.usage_ledger (user_id, module, operation) values ('11111111-1111-1111-1111-111111111111', 'theme_prompts', 'generate')$q$, 'write usage');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$select * from public.purchases$q$, 'read purchases');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$select * from public.analytics_events$q$, 'read analytics');
commit;

-- Bea sees none of Ava's generations; anonymous visitors see nothing at all.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.generations) <> 0 then raise exception 'bea sees ava generations'; end if;
end $$;
select pg_temp.expect_error($q$insert into public.generations (profile_id, module, status, source, output, profile_version) values ('aaaaaaaa-0000-0000-0000-000000000001', 'theme_prompts', 'succeeded', 'edit', '{}', 1)$q$, 'edit on another profile');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select * from public.business_profiles$q$, 'anon reads profiles');
commit;

-- Entitlements written by the server are visible only to their owner.
insert into public.entitlements (user_id, product_type, payment_provider, external_purchase_id, status)
values ('11111111-1111-1111-1111-111111111111', 'launch_pack', 'gumroad', 'sale-1', 'active'),
       ('22222222-2222-2222-2222-222222222222', 'library:income-fit-report', 'gumroad', 'sale-2', 'active');
select pg_temp.expect_error($q$insert into public.entitlements (user_id, product_type, payment_provider, external_purchase_id, status) values ('22222222-2222-2222-2222-222222222222', 'launch_pack', 'gumroad', 'sale-1', 'active')$q$, 'duplicate purchase id');
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.entitlements) <> 1 then raise exception 'bea sees other entitlements'; end if;
end $$;
commit;

-- At most five profiles per account, whatever the app says.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
insert into public.business_profiles (brand_name, category, audience, products_summary, market, currency, stage, fulfilment)
select 'B' || g, 'Other', 'x', 'x', 'US', 'USD', 'idea', 'digital' from generate_series(2, 5) g;
select pg_temp.expect_error($q$insert into public.business_profiles (brand_name, category, audience, products_summary, market, currency, stage, fulfilment) values ('B6', 'Other', 'x', 'x', 'US', 'USD', 'idea', 'digital')$q$, 'sixth profile');
commit;

-- Fit Finder results are private to their owner.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
insert into public.fit_results (answers, engine_version) values ('{"country":"Australia"}', 'v1.4');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into public.fit_results (answers, engine_version) values ('{"country":"Canada"}', 'v1.4');
do $$ begin
  if (select count(*) from public.fit_results) <> 1 then raise exception 'ava sees other fit results'; end if;
end $$;
update public.fit_results set progress = '{"x":1}' where answers->>'country' = 'Australia';
commit;
do $$ begin
  if (select progress from public.fit_results where answers->>'country' = 'Australia') <> '{}'::jsonb then
    raise exception 'ava changed bea fit result';
  end if;
end $$;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.fit_results (user_id, answers, engine_version) values ('22222222-2222-2222-2222-222222222222', '{}', 'v1.4')$q$, 'fit result as another user');
commit;

-- Trigger functions aren't callable over the API (they still fire: the
-- inserts and updates above went through them).
do $$
declare f text;
begin
  foreach f in array array['limit_profiles', 'bump_profile_version', 'snapshot_profile', 'check_product_images', 'assign_generation_version'] loop
    if has_function_privilege('anon', 'public.' || f || '()', 'execute')
      or has_function_privilege('authenticated', 'public.' || f || '()', 'execute') then
      raise exception 'trigger function % is executable by API roles', f;
    end if;
  end loop;
end $$;

-- Deleting a login removes everything she owns.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select count(*) from public.business_profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 0 then
    raise exception 'profiles survived account deletion';
  end if;
  if (select count(*) from public.generations) <> 0 then raise exception 'generations survived'; end if;
  if (select count(*) from public.fit_results where user_id = '11111111-1111-1111-1111-111111111111') <> 0 then raise exception 'fit results survived'; end if;
end $$;

\echo 'row level security: all checks passed'
