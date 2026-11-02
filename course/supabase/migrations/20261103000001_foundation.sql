-- Foundation: profiles (one per signed-in person, created by trigger on her
-- first sign-in) and admins (who may see everything).
--
-- Every table follows SPEC.md → Data model: id uuid, created_at, updated_at,
-- row level security on, users read and write only their own rows, admins
-- read everything. The remaining tables arrive in the schema migration.

-- ---------------------------------------------------------------------------
-- Shared: keep updated_at honest on every update.

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admins: just the founder for now. Rows are added by hand or with
-- `npm run admin:add -- <email>`, never from the app.

create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admins_updated_at before update on public.admins
  for each row execute function public.set_updated_at();

alter table public.admins enable row level security;

-- An admin can see that she is one (the app asks before showing /admin).
-- Nobody can add, change or remove admins through the API: there are no
-- insert, update or delete policies, so only the service role or SQL can.
create policy "admins: read own row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- is_admin() is what every "admins read everything" policy calls. Security
-- definer so it can read admins without recursing through that table's own
-- policy; it only ever answers for the caller.
create function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins: admins read all" on public.admins
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- profiles

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  first_name text check (first_name is null or char_length(first_name) <= 80),
  -- ISO 3166-1 alpha-2, from Vercel's geo header at sign-up (used for AUD/USD).
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles: admins read all" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- She may change her name, country and email preference, not which account
-- the row belongs to or the email it was created with (that follows
-- auth.users). Column grants enforce it; the policy enforces whose row.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, country, marketing_opt_in) on public.profiles to authenticated;

-- No insert or delete policies: the trigger below creates the row, and
-- deleting the auth user (delete account, in /account later) cascades.

-- ---------------------------------------------------------------------------
-- Profile on first sign-in. Magic-link sign-in creates the auth.users row
-- the first time she asks for a link, so this runs exactly once per person.

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger functions aren't for calling over the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile's email in step if she changes it in Supabase Auth.
create function public.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where user_id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();
