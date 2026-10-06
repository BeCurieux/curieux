-- Ovyko's own totals (docs/PLATFORM_TOTALS.md): numbers across every
-- school, for the people who run Ovyko, and only numbers: never a name, a
-- family or a child (CLAUDE.md rule 15). Only listed platform admins see
-- them, and only after two-step sign-in.

-- Demo schools are left out of the totals.
alter table public.organisations add column is_demo boolean not null default false;
-- The schools that exist when this runs are the demo (migration 24).
update public.organisations set is_demo = true;

-- The people who run Ovyko. Added only in the database's SQL editor; no
-- one can read or change this list through the app.
create table public.platform_admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = private.current_user_id())
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

revoke all on function private.is_platform_admin() from public;

-- Two-step sign-in is needed by owners of schools that require it (M6d)
-- and by platform admins.
create or replace function public.owner_two_step_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    exists (
      select 1
      from public.staff_memberships m
      join public.organisations o on o.id = m.organisation_id
      where m.user_id = private.current_user_id()
        and m.status = 'active'
        and m.role = 'owner'
        and o.owner_two_step_required
    )
    or exists (select 1 from public.platform_admins where user_id = private.current_user_id())
  ) and coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
$$;

-- Whether the signed-in person runs Ovyko (for the app to show the page).
create function public.am_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
$$;

revoke all on function public.am_platform_admin() from public, anon;
grant execute on function public.am_platform_admin() to authenticated;

-- The totals, over real (not demo) schools.
create function public.platform_totals()
returns table (
  schools bigint,
  schools_teaching bigint,
  schools_taking_payments bigint,
  families bigint,
  children_enrolled bigint,
  fees_charged_365d_cents bigint,
  paid_online_30d_cents bigint,
  paid_online_365d_cents bigint,
  ovyko_fees_30d_cents bigint,
  ovyko_fees_365d_cents bigint,
  recorded_payments_365d_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with real_orgs as (
    select o.id from public.organisations o where not o.is_demo and o.status = 'active'
  ),
  paid as (
    select p.amount_cents, p.platform_fee_cents, p.paid_at
      from public.online_payments p
      join real_orgs r on r.id = p.organisation_id
     where p.status = 'paid' and p.paid_at > now() - interval '365 days'
  )
  select
    (select count(*) from real_orgs),
    (select count(distinct c.organisation_id)
       from public.class_occurrences c join real_orgs r on r.id = c.organisation_id
      where c.status = 'scheduled'
        and c.starts_at between now() and now() + interval '14 days'),
    (select count(*) from public.payment_accounts a
       join real_orgs r on r.id = a.organisation_id where a.charges_enabled),
    (select count(*) from public.families f join real_orgs r on r.id = f.organisation_id),
    (select count(distinct e.child_id) from public.enrolments e
       join real_orgs r on r.id = e.organisation_id where e.status = 'active'),
    (select coalesce(sum(l.amount_cents), 0)::bigint from public.ledger_entries l
       join real_orgs r on r.id = l.organisation_id
      where l.kind in ('term_fee', 'charge') and l.created_at > now() - interval '365 days'
        and not exists (select 1 from public.ledger_entries c where c.cancels_id = l.id)),
    (select coalesce(sum(amount_cents), 0)::bigint from paid
      where paid_at > now() - interval '30 days'),
    (select coalesce(sum(amount_cents), 0)::bigint from paid),
    (select coalesce(sum(platform_fee_cents), 0)::bigint from paid
      where paid_at > now() - interval '30 days'),
    (select coalesce(sum(platform_fee_cents), 0)::bigint from paid),
    (select coalesce(-sum(l.amount_cents), 0)::bigint from public.ledger_entries l
       join real_orgs r on r.id = l.organisation_id
      where l.kind = 'payment' and l.online_payment_id is null
        and l.created_at > now() - interval '365 days'
        and not exists (select 1 from public.ledger_entries c where c.cancels_id = l.id));
end;
$$;

revoke all on function public.platform_totals() from public, anon;
grant execute on function public.platform_totals() to authenticated;

-- Month by month for the last 12 months: new schools, money paid online,
-- and Ovyko's share.
create function public.platform_months()
returns table (month date, new_schools bigint, paid_online_cents bigint, ovyko_fees_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with months as (
    select generate_series(
      date_trunc('month', now() - interval '11 months'), date_trunc('month', now()),
      interval '1 month')::date as m
  )
  select ms.m,
         (select count(*) from public.organisations o
           where not o.is_demo and date_trunc('month', o.created_at)::date = ms.m),
         (select coalesce(sum(p.amount_cents), 0)::bigint from public.online_payments p
            join public.organisations o on o.id = p.organisation_id and not o.is_demo
           where p.status = 'paid' and date_trunc('month', p.paid_at)::date = ms.m),
         (select coalesce(sum(p.platform_fee_cents), 0)::bigint from public.online_payments p
            join public.organisations o on o.id = p.organisation_id and not o.is_demo
           where p.status = 'paid' and date_trunc('month', p.paid_at)::date = ms.m)
    from months ms
   order by ms.m;
end;
$$;

revoke all on function public.platform_months() from public, anon;
grant execute on function public.platform_months() to authenticated;
