-- Give the roles access to the tables again.
--
-- Run this if the app or `npm run seed` fails with
--
--     permission denied for table families
--
-- Safe to run at any time, on any project, as many times as you like. It
-- grants and never revokes, and touches no data.
--
-- What happened: reset.sql drops and recreates the `public` schema, and a
-- schema carries the *default privileges* that decide what newly created
-- tables are readable by. Supabase configures those when it builds a
-- project. Dropping the schema takes them with it — so setup.sql then
-- creates thirty-three perfectly good tables that the API's own roles are
-- not allowed to touch.
--
-- Nothing about that is visible. The tables are there, the policies are
-- there, the dashboard looks right, and every request fails.
--
-- reset.sql restores the default privileges itself now, so this is only
-- needed for a database that was already reset before that fix. It is kept
-- because it is also the answer to "permission denied" arriving from any
-- other direction.

-- The four roles Supabase connects as. `postgres` owns things; `anon` and
-- `authenticated` are what the API uses for signed-out and signed-in
-- callers, and are held in check by row-level security rather than by
-- these grants; `service_role` bypasses row-level security and is what
-- background jobs and the seed use.
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables    in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;

-- And for everything created from here on, so the next migration does not
-- reintroduce the same silence.
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
