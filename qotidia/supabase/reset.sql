-- Start the database over.
--
-- ⚠️  THIS DELETES EVERY TABLE AND EVERY ROW IN THE PUBLIC SCHEMA.
--
-- Only for a project that has nothing in it worth keeping. If a real family
-- has ever used this project, do not run this — there is no undo, and the
-- point of the whole product is that their archive cannot be lost.
--
-- What it is for: setup.sql is a single paste that builds the schema from
-- nothing, and it stops at the first object that already exists —
--
--     ERROR: 42710: type "memory_type" already exists
--
-- which means a previous attempt got part of the way in. Rather than trying
-- to work out how far, this clears the slate so the next paste starts from
-- the same empty database the file assumes.
--
-- Accounts are untouched: Supabase keeps users in the `auth` schema and
-- uploaded files in `storage`, and neither is dropped here. Anybody who has
-- signed up will still be able to sign in afterwards — into an empty
-- archive.
--
-- Run this, then run setup.sql.

drop schema public cascade;
create schema public;

-- The roles Supabase connects as. Without these the API returns "permission
-- denied for schema public" on every request, which looks like a broken
-- deployment rather than a missing grant.
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all   on schema public to postgres, anon, authenticated, service_role;

-- And the default privileges, which are the part this originally missed.
--
-- A schema carries the rules for what *newly created* tables are readable
-- by, and Supabase sets those up when it builds a project. Dropping the
-- schema takes them with it, so setup.sql then built thirty-three perfectly
-- good tables that the API's own roles were not allowed to touch — and
-- nothing said so. The tables were there, the policies were there, the
-- dashboard looked right, and every single request failed with
-- "permission denied for table families".
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;

-- Storage keeps its policies in its own schema, so the drop above does not
-- reach them and they would still be there on the next run. The migration
-- that creates them now drops them first, which makes this belt and braces
-- rather than load-bearing — but a reset that leaves half the rules standing
-- is not a reset.
drop policy if exists "media owner select" on storage.objects;
drop policy if exists "media owner insert" on storage.objects;
drop policy if exists "media owner update" on storage.objects;
drop policy if exists "media owner delete" on storage.objects;
