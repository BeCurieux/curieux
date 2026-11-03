-- Email suppressions (migration 8). Runs after public.sql.

\set ON_ERROR_STOP on
set client_min_messages = warning;

\ir helpers.sql

insert into auth.users (id, email) values ('13000000-0000-0000-0000-000000000001', 'una@example.test');
insert into public.email_suppressions (email) values ('una@example.test'), ('someone@example.test');
select pg_temp.expect_error($q$insert into public.email_suppressions (email) values ('Mixed@Example.test')$q$, 'uppercase suppression');

begin;
select pg_temp.act_as('13000000-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.email_suppressions) <> 1 then raise exception 'una should see only her own suppression'; end if;
end $$;
select pg_temp.expect_error($q$delete from public.email_suppressions$q$, 'resubscribe through the API');
select pg_temp.expect_error($q$insert into public.email_suppressions (email) values ('x@example.test')$q$, 'suppress someone through the API');
commit;
begin;
select pg_temp.act_as_anon();
do $$ begin
  if (select count(*) from public.email_suppressions) <> 0 then raise exception 'anon reads suppressions'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.email_suppressions) <> 2 then raise exception 'admin should read all suppressions'; end if;
end $$;
commit;
