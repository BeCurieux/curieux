-- The founding-schools waitlist (docs/WAITLIST_PAGE.md). Anyone can join
-- from the public website; only the people who run Ovyko (platform admins,
-- after two-step sign-in) can read it. Nobody reads or changes it directly.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  school text not null check (length(school) between 1 and 120),
  suburb text not null check (length(suburb) between 1 and 80),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  phone text check (phone is null or length(phone) between 6 and 30),
  swimmers text check (swimmers in ('under_200', '200_500', '500_1000', 'over_1000')),
  current_system text check (current_system in
    ('iclasspro', 'simplyswim', 'class_manager', 'spreadsheets', 'other')),
  next_break text check (next_break is null or length(next_break) between 1 and 80),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per email: joining again updates the details.
create unique index waitlist_signups_email_idx on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from anon, authenticated;

-- Joining (or updating) the waitlist, from the website. Consent to be
-- emailed is required (the Spam Act). Says nothing about who else is on it.
create function public.join_waitlist(
  p_name text, p_school text, p_suburb text, p_email text, p_phone text,
  p_swimmers text, p_current_system text, p_next_break text, p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_consent is not true then
    raise exception 'Tick the box so we can email you about founding places.'
      using hint = 'waitlist_invalid';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_school), '') = ''
     or coalesce(trim(p_suburb), '') = '' then
    raise exception 'Fill in your name, school and suburb.' using hint = 'waitlist_invalid';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Check your email address.' using hint = 'waitlist_invalid';
  end if;
  insert into public.waitlist_signups
    (name, school, suburb, email, phone, swimmers, current_system, next_break, consented_at)
  values
    (left(trim(p_name), 100), left(trim(p_school), 120), left(trim(p_suburb), 80), v_email,
     nullif(left(trim(coalesce(p_phone, '')), 30), ''), nullif(p_swimmers, ''),
     nullif(p_current_system, ''), nullif(left(trim(coalesce(p_next_break, '')), 80), ''), now())
  on conflict (lower(email)) do update
     set name = excluded.name, school = excluded.school, suburb = excluded.suburb,
         phone = coalesce(excluded.phone, public.waitlist_signups.phone),
         swimmers = coalesce(excluded.swimmers, public.waitlist_signups.swimmers),
         current_system = coalesce(excluded.current_system, public.waitlist_signups.current_system),
         next_break = coalesce(excluded.next_break, public.waitlist_signups.next_break),
         consented_at = now(), updated_at = now();
exception
  when check_violation then
    raise exception 'Check the details and try again.' using hint = 'waitlist_invalid';
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean)
  from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text, text, boolean)
  to anon, authenticated;

-- The waitlist, newest first, for the people who run Ovyko.
create function public.waitlist()
returns setof public.waitlist_signups
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from public.waitlist_signups order by created_at desc;
end;
$$;

revoke all on function public.waitlist() from public, anon;
grant execute on function public.waitlist() to authenticated;
