-- Public pages (build step 6): lead capture from /check, /hype and
-- /waitlist, and the Hype Check's anonymised log.

-- What someone on the waitlist is waiting for.
alter table public.leads
  add column interests text[] not null default '{}'
  check (interests <@ array['founding', 'future_modules']::text[]);

-- One call for every lead form. A new address gets a row with this source;
-- an address we've seen keeps its first source and first_seen, and gains
-- any new interests. Server only.
create function public.capture_lead(p_email text, p_source text, p_interests text[] default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.leads (email, source, interests)
  values (lower(trim(p_email)), p_source, coalesce(p_interests, '{}'))
  on conflict (email) do update
    set interests = array(
      select distinct unnest(public.leads.interests || excluded.interests) order by 1
    );
$$;

revoke all on function public.capture_lead(text, text, text[]) from public, anon, authenticated;
grant execute on function public.capture_lead(text, text, text[]) to service_role;

-- Hype Check runs, for tuning the rubric later (SPEC.md → Email, keywords
-- and lead capture: "log anonymised inputs"). The text is stored with
-- emails, links, @handles and phone numbers removed, and nothing ties a
-- row to a person: no user id, no IP.
create table public.hype_checks (
  id uuid primary key default gen_random_uuid(),
  text_redacted text not null check (char_length(text_redacted) <= 5000),
  score integer not null check (score between 0 and 100),
  signals jsonb not null default '{}'::jsonb,
  rubric_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger hype_checks_updated_at before update on public.hype_checks
  for each row execute function public.set_updated_at();

alter table public.hype_checks enable row level security;
revoke insert, update, delete, truncate on public.hype_checks from anon, authenticated;

create policy "hype_checks: admins read all" on public.hype_checks
  for select to authenticated
  using ((select public.is_admin()));
