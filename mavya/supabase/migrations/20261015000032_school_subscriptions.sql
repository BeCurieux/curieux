-- Ovyko's plan (docs/SUBSCRIPTIONS.md): what schools pay Ovyko, through
-- Stripe Billing on Ovyko's own Stripe account. Only the server records a
-- school's plan, from Stripe's own word; owners read it. Nothing about a
-- school's lessons or families depends on it.

create table public.school_subscriptions (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_subscription_id text unique,
  -- Stripe's subscription status: trialing, active, past_due, unpaid,
  -- canceled, incomplete, incomplete_expired, paused; null before a plan.
  status text,
  locations integer check (locations is null or locations > 0),
  price_cents integer check (price_cents is null or price_cents >= 0),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_subscriptions enable row level security;
revoke all on public.school_subscriptions from anon, authenticated;
grant select on public.school_subscriptions to authenticated;

create policy school_subscriptions_select on public.school_subscriptions
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

create trigger audit_school_subscriptions after insert or update or delete
  on public.school_subscriptions
  for each row execute function private.audit_change();

-- The school's free trial: 30 days from when it joined Ovyko.
create function private.trial_ends(p_org uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select created_at + interval '30 days' from public.organisations where id = p_org
$$;

revoke all on function private.trial_ends(uuid) from public;

-- For owners: where the school's plan stands, in one word, and what to
-- show. trial (in the free trial, no plan yet), ok (a plan that's paid or
-- trialing), attention (payment problem), none (trial over, no plan),
-- demo (not billed).
create function public.school_plan_state(p_org uuid)
returns table (state text, trial_ends timestamptz, locations integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.school_subscriptions;
  demo boolean;
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select is_demo into demo from public.organisations where id = p_org;
  select * into s from public.school_subscriptions where organisation_id = p_org;
  return query select
    case
      when demo then 'demo'
      when s.status in ('active', 'trialing') then 'ok'
      when s.status in ('past_due', 'unpaid', 'incomplete') then 'attention'
      when private.trial_ends(p_org) > now() then 'trial'
      else 'none'
    end,
    private.trial_ends(p_org),
    (select count(*)::integer from public.locations l where l.organisation_id = p_org);
end;
$$;

revoke all on function public.school_plan_state(uuid) from public, anon;
grant execute on function public.school_plan_state(uuid) to authenticated;

-- For the server: the school's Stripe customer, created once.
create function public.save_school_customer(p_org uuid, p_customer text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept text;
begin
  insert into public.school_subscriptions (organisation_id, stripe_customer_id)
  values (p_org, p_customer)
  on conflict (organisation_id) do nothing;
  select stripe_customer_id into kept from public.school_subscriptions where organisation_id = p_org;
  return kept;
end;
$$;

revoke all on function public.save_school_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.save_school_customer(uuid, text) to service_role;

-- For the server: Stripe's own word on a school's subscription. A customer
-- no school uses changes nothing.
create function public.save_school_subscription(
  p_customer text, p_subscription text, p_status text, p_locations integer,
  p_price_cents integer, p_trial_end timestamptz, p_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.school_subscriptions
     set stripe_subscription_id = p_subscription, status = p_status,
         locations = p_locations, price_cents = p_price_cents,
         trial_end = p_trial_end, current_period_end = p_period_end,
         cancel_at_period_end = coalesce(p_cancel_at_period_end, false), updated_at = now()
   where stripe_customer_id = p_customer
     and (stripe_subscription_id is null or stripe_subscription_id = p_subscription
          or p_status not in ('canceled', 'incomplete_expired'));
  return found;
end;
$$;

revoke all on function public.save_school_subscription(
  text, text, text, integer, integer, timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.save_school_subscription(
  text, text, text, integer, integer, timestamptz, timestamptz, boolean
) to service_role;

-- ------------------------------------------------------------------ Ovyko's totals

-- As in migration 31, with paying schools and monthly recurring revenue.
drop function public.platform_totals();

create function public.platform_totals()
returns table (
  schools bigint,
  schools_teaching bigint,
  schools_taking_payments bigint,
  schools_paying bigint,
  monthly_recurring_cents bigint,
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
  ),
  paying as (
    select s.locations, s.price_cents from public.school_subscriptions s
      join real_orgs r on r.id = s.organisation_id
     where s.status in ('active', 'past_due')
  )
  select
    (select count(*) from real_orgs),
    (select count(distinct c.organisation_id)
       from public.class_occurrences c join real_orgs r on r.id = c.organisation_id
      where c.status = 'scheduled'
        and c.starts_at between now() and now() + interval '14 days'),
    (select count(*) from public.payment_accounts a
       join real_orgs r on r.id = a.organisation_id where a.charges_enabled),
    (select count(*) from paying),
    (select coalesce(sum(coalesce(locations, 1)::bigint * coalesce(price_cents, 0)), 0)::bigint
       from paying),
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
