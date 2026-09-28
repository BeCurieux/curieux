-- Users: the application's view of a person who can sign in.
--
-- Supabase Auth owns credentials in auth.users. This table holds the profile
-- the product reads, linked by auth_id, and is created automatically on
-- sign-up so the two can never drift apart.
--
-- Every table in this schema enables row level security in the migration
-- that creates it. With no policy, RLS refuses everything, so a table is
-- never readable before its policy exists (see ..._policies_and_grants.sql).

create schema if not exists private;
revoke all on schema private from public;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (auth_id, email, name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.phone
  );
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();
