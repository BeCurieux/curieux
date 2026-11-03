-- Lead capture and the Hype Check log (migration 7). Runs after commerce.sql.

\set ON_ERROR_STOP on
set client_min_messages = warning;

\ir helpers.sql

-- A new lead, then the same address again from somewhere else: first source
-- and first_seen kept, interests merged.
select public.capture_lead('  Zoe@Example.TEST ', 'product_check', '{}');
select public.capture_lead('zoe@example.test', 'waitlist', array['founding']);
select public.capture_lead('zoe@example.test', 'waitlist', array['future_modules', 'founding']);
do $$ begin
  if (select count(*) from public.leads where email = 'zoe@example.test') <> 1 then raise exception 'duplicate lead'; end if;
  if (select source from public.leads where email = 'zoe@example.test') <> 'product_check' then raise exception 'first source lost'; end if;
  if (select interests from public.leads where email = 'zoe@example.test') <> array['founding', 'future_modules'] then
    raise exception 'interests not merged: %', (select interests from public.leads where email = 'zoe@example.test');
  end if;
end $$;
select pg_temp.expect_error($q$select public.capture_lead('x@example.test', 'waitlist', array['everything'])$q$, 'unknown interest');
select pg_temp.expect_error($q$select public.capture_lead('x@example.test', 'billboard', '{}')$q$, 'unknown source');

-- Only the server captures leads or logs hype checks; only admins read the log.
do $$ begin
  if has_function_privilege('anon', 'public.capture_lead(text, text, text[])', 'execute')
     or has_function_privilege('authenticated', 'public.capture_lead(text, text, text[])', 'execute') then
    raise exception 'capture_lead is callable over the API';
  end if;
end $$;
insert into public.hype_checks (text_redacted, score, rubric_version) values ('Make [money] fast', 80, 'test');
begin;
select pg_temp.act_as_anon();
select pg_temp.expect_error($q$insert into public.hype_checks (text_redacted, score, rubric_version) values ('x', 1, 'x')$q$, 'anon logs a hype check');
do $$ begin
  if (select count(*) from public.hype_checks) <> 0 then raise exception 'anon reads the hype log'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.hype_checks) <> 1 then raise exception 'admin should read the hype log'; end if;
end $$;
commit;
select pg_temp.expect_error($q$insert into public.hype_checks (text_redacted, score, rubric_version) values ('x', 101, 'x')$q$, 'score over 100');
