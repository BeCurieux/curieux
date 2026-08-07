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
