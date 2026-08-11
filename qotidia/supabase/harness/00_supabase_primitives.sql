-- What Supabase provides, stubbed, so the migrations can be applied to a
-- plain PostgreSQL before they are ever applied to a real project.
--
-- This is not a simulation of Supabase and does not try to be. It is the
-- narrow set of objects our migrations reference — the auth schema, the
-- storage schema, the roles the GRANTs name — defined faithfully enough that
-- a migration which would fail in production fails here first.
--
-- The value is entirely in that ordering. A migration that drops a column
-- and rewrites every policy on the table it belonged to is not a thing to
-- discover in production at 9pm; 0019 does exactly that, and until this
-- existed the whole chain had never been executed by anything.
--
-- Two things are deliberately faithful rather than convenient:
--
--   auth.uid() reads a session setting, so a test can become a particular
--   user and watch row-level security actually refuse them. A stub that
--   returned a constant would make every RLS policy trivially pass and the
--   harness would certify nothing.
--
--   The roles are real roles with real GRANTs, because "permission denied
--   for table" is one of the two ways a policy goes wrong and the other one
--   is the policy itself.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ roles

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ------------------------------------------------------------------- auth

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

/**
 * The current user, from a session setting.
 *
 * Supabase sets request.jwt.claims from the verified JWT. The harness sets
 * it directly, which is the same shape and lets a test say "now I am
 * Grandpa" and find out what Grandpa can actually read.
 */
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

-- ---------------------------------------------------------------- storage

create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

/** Path segments of an object name, as Supabase's own helper returns them. */
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
$$;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
