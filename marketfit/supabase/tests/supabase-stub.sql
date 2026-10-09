-- Just enough of a Supabase project for the migration and the RLS checks to
-- run on a bare Postgres: the three API roles and `auth.jwt()`, which reads the
-- claims PostgREST puts in `request.jwt.claims`. Used by `pnpm db:check` only;
-- never applied to a real project, which has all of this already.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
