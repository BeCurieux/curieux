-- Just enough of a Supabase project for the migrations to run against a
-- plain Postgres: the auth schema's users table, auth.uid(), and the three
-- API roles. Used by tests/db.test.ts; never applied to a real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
