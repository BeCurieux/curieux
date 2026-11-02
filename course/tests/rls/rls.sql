-- Row level security tests for the foundation tables. Each block acts as
-- one person and proves what she can and cannot see or change. Any failed
-- assertion stops the run (scripts/rls-test.sh).

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
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

-- Three people sign in for the first time. Cleo is the founder.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ava@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bea@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@example.test');
insert into public.admins (user_id) values ('33333333-3333-3333-3333-333333333333');

-- The trigger made exactly one profile each, with her email.
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'trigger did not create profiles'; end if;
  if (select email from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 'ava@example.test' then
    raise exception 'profile email wrong';
  end if;
  if (select marketing_opt_in from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'marketing opt-in must default to false';
  end if;
end $$;

-- Trigger functions can't be called over the API.
do $$ begin
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') then raise exception 'handle_new_user callable'; end if;
  if has_function_privilege('anon', 'public.handle_new_user()', 'execute') then raise exception 'handle_new_user callable by anon'; end if;
  if has_function_privilege('authenticated', 'public.handle_user_email_change()', 'execute') then raise exception 'email trigger callable'; end if;
  if has_function_privilege('authenticated', 'public.set_updated_at()', 'execute') then raise exception 'set_updated_at callable'; end if;
  if has_function_privilege('anon', 'public.is_admin()', 'execute') then raise exception 'is_admin callable by anon'; end if;
end $$;

-- Ava sees only her own profile, is not an admin, and sees no admins.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'ava sees other profiles'; end if;
  if (select user_id from public.profiles) <> '11111111-1111-1111-1111-111111111111' then raise exception 'ava sees the wrong profile'; end if;
  if public.is_admin() then raise exception 'ava is not an admin'; end if;
  if (select count(*) from public.admins) <> 0 then raise exception 'ava sees admins'; end if;
end $$;
commit;

-- Ava can change her name, country and email preference.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
update public.profiles set first_name = 'Ava', country = 'AU', marketing_opt_in = true
  where user_id = '11111111-1111-1111-1111-111111111111';
commit;
do $$ begin
  if (select first_name || country || marketing_opt_in::text from public.profiles
      where user_id = '11111111-1111-1111-1111-111111111111') <> 'AvaAUtrue' then
    raise exception 'ava could not update her own profile';
  end if;
  if (select updated_at > created_at from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') is not true then
    raise exception 'updated_at not maintained';
  end if;
end $$;

-- ...but not the account the row belongs to, or its email.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$update public.profiles set user_id = '22222222-2222-2222-2222-222222222222'$q$, 'reassign profile');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$update public.profiles set email = 'x@example.test'$q$, 'change profile email');
commit;
-- Nor a country that isn't a two-letter code.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$update public.profiles set country = 'Australia'$q$, 'bad country');
commit;

-- She can't create or delete profiles, or make herself an admin.
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.profiles (user_id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.test')$q$, 'insert profile');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($q$insert into public.admins (user_id) values ('11111111-1111-1111-1111-111111111111')$q$, 'self-promote to admin');
commit;
begin;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
delete from public.profiles;
delete from public.admins;
commit;
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'ava deleted profiles'; end if;
  if (select count(*) from public.admins) <> 1 then raise exception 'ava deleted an admin'; end if;
end $$;

-- Bea can't read or change Ava's profile: the update silently matches nothing.
begin;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
update public.profiles set first_name = 'Stolen' where user_id = '11111111-1111-1111-1111-111111111111';
commit;
do $$ begin
  if (select first_name from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 'Ava' then
    raise exception 'bea changed ava profile';
  end if;
end $$;

-- Cleo, the admin, reads everything but changes nothing that isn't hers.
begin;
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
do $$ begin
  if not public.is_admin() then raise exception 'cleo should be an admin'; end if;
  if (select count(*) from public.profiles) <> 3 then raise exception 'admin should read all profiles'; end if;
  if (select count(*) from public.admins) <> 1 then raise exception 'admin should see admins'; end if;
end $$;
update public.profiles set first_name = 'Changed' where user_id = '11111111-1111-1111-1111-111111111111';
commit;
do $$ begin
  if (select first_name from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 'Ava' then
    raise exception 'admin changed another profile through the API';
  end if;
end $$;

-- Signed out: nothing.
begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'anon sees profiles'; end if;
  if (select count(*) from public.admins) <> 0 then raise exception 'anon sees admins'; end if;
end $$;
commit;

-- An email change in Supabase Auth follows through to the profile.
update auth.users set email = 'ava.new@example.test' where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select email from public.profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 'ava.new@example.test' then
    raise exception 'profile email not synced';
  end if;
end $$;

-- Deleting the account removes her profile and any admin row.
delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
do $$ begin
  if exists (select 1 from public.profiles where user_id = '33333333-3333-3333-3333-333333333333') then
    raise exception 'profile survived account deletion';
  end if;
  if exists (select 1 from public.admins) then raise exception 'admin row survived account deletion'; end if;
end $$;
