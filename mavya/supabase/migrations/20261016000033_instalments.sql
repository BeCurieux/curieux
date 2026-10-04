-- Instalments (docs/M7_PAYMENTS.md, M7c part 2). A parent pays a term's
-- fees in 2 or 4 payments, if the school offers it. The first is paid on
-- Stripe's page and saves the card or bank account; the server takes the
-- rest on their dates. Only the server takes payments or records them.

alter table public.organisations add column instalments_on boolean not null default false;

create function public.set_instalments_on(p_org uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was boolean;
begin
  if p_org is null or p_on is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select instalments_on into was from public.organisations where id = p_org for update;
  if was = p_on then
    return;
  end if;
  update public.organisations set instalments_on = p_on where id = p_org;
  -- Organisations aren't audited row by row; this choice is.
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('instalments_on', was), jsonb_build_object('instalments_on', p_on));
end;
$$;

revoke all on function public.set_instalments_on(uuid, boolean) from public, anon;
grant execute on function public.set_instalments_on(uuid, boolean) to authenticated;

-- Whether a school offers instalments, for its owners and families.
create function public.instalments_offered(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select o.instalments_on from public.organisations o
   where o.id = p_org
     and (private.is_org_member(p_org, array['owner'])
          or p_org in (select private.my_family_org_ids()))
$$;

revoke all on function public.instalments_offered(uuid) from public, anon;
grant execute on function public.instalments_offered(uuid) to authenticated;

-- ------------------------------------------------------------------ plans

create table public.instalment_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  payments integer not null check (payments in (2, 4)),
  total_cents bigint not null check (total_cents > 0),
  -- pending: the first payment isn't in yet; active: the rest will be
  -- taken; completed: all paid; stopped: ended early (failed, paid off,
  -- or the first payment never made).
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'stopped')),
  stripe_customer_id text,
  payment_method_id text,
  payment_method_type text check (payment_method_type in ('card', 'direct_debit')),
  started_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, id),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade
);

-- One plan under way per family.
create unique index instalment_plans_one_open on public.instalment_plans (family_id)
  where status in ('pending', 'active');

create table public.instalments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  plan_id uuid not null,
  family_id uuid not null,
  seq integer not null check (seq between 1 and 4),
  amount_cents bigint not null check (amount_cents > 0),
  due_on date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'started', 'processing', 'paid', 'failed', 'cancelled')),
  online_payment_id uuid unique,
  updated_at timestamptz not null default now(),
  unique (plan_id, seq),
  foreign key (organisation_id, plan_id) references public.instalment_plans (organisation_id, id)
    on delete cascade,
  foreign key (organisation_id, online_payment_id)
    references public.online_payments (organisation_id, id) on delete set null (online_payment_id)
);

create index instalments_due_idx on public.instalments (due_on) where status = 'scheduled';

alter table public.instalment_plans enable row level security;
alter table public.instalments enable row level security;
revoke all on public.instalment_plans, public.instalments from anon, authenticated;
grant select on public.instalment_plans, public.instalments to authenticated;

create policy instalment_plans_select on public.instalment_plans
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create policy instalments_select on public.instalments
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create trigger audit_instalment_plans after insert or update or delete on public.instalment_plans
  for each row execute function private.audit_change();
create trigger audit_instalments after insert or update or delete on public.instalments
  for each row execute function private.audit_change();

-- What a family owes, less direct debits on their way and payments the
-- server is taking now (M7b): what a plan's instalments come out of.
create function private.owing_before_plan(p_family uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(amount_cents) from public.ledger_entries where family_id = p_family), 0)
       - coalesce((select sum(p.amount_cents) from public.online_payments p
                    where p.family_id = p_family
                      and (p.status = 'processing'
                           or (p.status = 'started'
                               and exists (select 1 from public.instalments i
                                            where i.online_payment_id = p.id and i.seq > 1)))), 0)
$$;

revoke all on function private.owing_before_plan(uuid) from public;

-- What a family owes now: as above, less instalments a plan will take
-- later, but never less than nothing (M7b, M7c).
create or replace function private.owing_now(p_family uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  with b as (select private.owing_before_plan(p_family) as owing)
  select b.owing - least(greatest(b.owing, 0),
           coalesce((select sum(i.amount_cents) from public.instalments i
                       join public.instalment_plans pl on pl.id = i.plan_id
                      where i.family_id = p_family and pl.status = 'active'
                        and i.status = 'scheduled'), 0))
    from b
$$;

-- A payment that pays off what's left of a plan ends the plan once it's
-- paid or on its way, not before (a page left unpaid changes nothing).
alter table public.online_payments
  add column pays_off_plan uuid references public.instalment_plans (id) on delete set null;

-- What a family can pay now, and what paying off its plan would come to,
-- for the family's parents and the school's owners.
create function public.family_owing(p_family uuid)
returns table (owing_now bigint, owing_with_plan bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_family is null
     or not (p_family in (select private.my_family_ids())
             or private.is_org_member(private.family_org(p_family), array['owner'])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select private.owing_now(p_family), private.owing_before_plan(p_family);
end;
$$;

revoke all on function public.family_owing(uuid) from public, anon;
grant execute on function public.family_owing(uuid) to authenticated;

-- Ends a family's plan early: the instalments not yet taken are cancelled
-- and simply owed.
create function private.stop_plan(p_plan uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.instalments set status = 'cancelled', updated_at = now()
   where plan_id = p_plan and status = 'scheduled';
  update public.instalment_plans set status = 'stopped', updated_at = now()
   where id = p_plan and status in ('pending', 'active');
$$;

revoke all on function private.stop_plan(uuid) from public;

-- A payment's status changing carries through to its instalment and plan.
create function private.sync_instalment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.instalments;
begin
  if new.pays_off_plan is not null and new.status in ('paid', 'processing') then
    perform private.stop_plan(new.pays_off_plan);
  end if;
  select * into i from public.instalments where online_payment_id = new.id;
  if not found then
    return null;
  end if;
  update public.instalments
     set status = case new.status
                    when 'paid' then 'paid'
                    when 'processing' then 'processing'
                    when 'failed' then 'failed'
                    when 'expired' then 'cancelled'
                    else status end,
         updated_at = now()
   where id = i.id;
  if new.status in ('failed', 'expired') then
    perform private.stop_plan(i.plan_id);
  elsif new.status in ('paid', 'processing') and i.seq = 1 then
    update public.instalment_plans set status = 'active', updated_at = now()
     where id = i.plan_id and status = 'pending';
  end if;
  if not exists (select 1 from public.instalments
                  where plan_id = i.plan_id and status <> 'paid') then
    update public.instalment_plans set status = 'completed', updated_at = now()
     where id = i.plan_id and status = 'active';
  end if;
  return null;
end;
$$;

revoke all on function private.sync_instalment() from public;

create trigger online_payments_sync_instalment
  after update of status on public.online_payments
  for each row when (old.status is distinct from new.status)
  execute function private.sync_instalment();

-- ------------------------------------------------------------------ starting

-- A parent starts paying in 2 or 4 instalments. Like start_online_payment
-- (M7b), it returns the first payment for the server to open on Stripe's
-- page, or a page already open.
create function public.start_instalment_plan(p_family uuid, p_payments integer)
returns table (payment_id uuid, amount_cents bigint, platform_fee_cents bigint,
               stripe_account_id text, school_name text, checkout_session_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  acct text;
  owing bigint;
  each_cents bigint;
  first_cents bigint;
  today date;
  v_plan uuid;
  pay_id uuid;
  fee bigint;
  k integer;
begin
  if p_family is null or p_family not in (select private.my_family_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_payments not in (2, 4) then
    raise exception 'Choose 2 or 4 payments.' using hint = 'plan_invalid';
  end if;
  select f.organisation_id into org from public.families f where f.id = p_family;
  if not (select instalments_on from public.organisations where id = org) then
    raise exception 'Your activity provider doesn''t offer instalments.' using hint = 'plan_invalid';
  end if;
  select a.stripe_account_id into acct from public.payment_accounts a
   where a.organisation_id = org and a.charges_enabled;
  if acct is null then
    raise exception 'Your activity provider doesn''t take payments in Ovyko yet.'
      using hint = 'payments_off';
  end if;
  perform 1 from public.families where id = p_family for update;
  -- A payment page already open is handed back, never a second one.
  if exists (select 1 from public.online_payments p
              where p.family_id = p_family and p.status = 'started'
                and p.checkout_session_id is not null) then
    return query select * from public.start_online_payment(p_family);
    return;
  end if;
  if exists (select 1 from public.instalment_plans
              where family_id = p_family and status in ('pending', 'active')) then
    raise exception 'You''re already paying in instalments.' using hint = 'plan_invalid';
  end if;
  owing := private.owing_now(p_family);
  if owing < 10000 then
    raise exception 'Instalments are for $100 or more.' using hint = 'plan_invalid';
  end if;
  if owing > 99999999 then
    raise exception 'That''s more than can be paid online. Contact your activity provider.'
      using hint = 'payment_too_large';
  end if;
  each_cents := owing / p_payments;
  first_cents := owing - each_cents * (p_payments - 1);
  today := private.school_today(org);
  insert into public.instalment_plans (organisation_id, family_id, payments, total_cents, started_by)
  values (org, p_family, p_payments, owing, private.current_user_id())
  returning id into v_plan;
  for k in 1..p_payments loop
    insert into public.instalments (organisation_id, plan_id, family_id, seq, amount_cents, due_on)
    values (org, v_plan, p_family, k,
            case when k = 1 then first_cents else each_cents end,
            today + (k - 1) * case when p_payments = 2 then 28 else 14 end);
  end loop;
  fee := round(first_cents * private.platform_fee_bps() / 10000.0)::bigint;
  insert into public.online_payments
    (organisation_id, family_id, amount_cents, platform_fee_cents, stripe_account_id, started_by)
  values (org, p_family, first_cents, fee, acct, private.current_user_id())
  returning id into pay_id;
  update public.instalments set status = 'started', online_payment_id = pay_id
   where public.instalments.plan_id = v_plan and seq = 1;
  return query
    select pay_id, first_cents, fee, acct, o.name, null::text
      from public.organisations o where o.id = org;
end;
$$;

revoke all on function public.start_instalment_plan(uuid, integer) from public, anon;
grant execute on function public.start_instalment_plan(uuid, integer) to authenticated;

-- Paying the rest now: everything the family owes, the plan's instalments
-- included, as one payment on Stripe's page. The plan ends only once that
-- payment is paid or on its way (the trigger above).
create function public.pay_rest_of_plan(p_family uuid)
returns table (payment_id uuid, amount_cents bigint, platform_fee_cents bigint,
               stripe_account_id text, school_name text, checkout_session_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  acct text;
  open_plan uuid;
  owing bigint;
  fee bigint;
  new_id uuid;
begin
  if p_family is null or p_family not in (select private.my_family_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select f.organisation_id into org from public.families f where f.id = p_family;
  perform 1 from public.families where id = p_family for update;
  select id into open_plan from public.instalment_plans
   where family_id = p_family and status = 'active';
  -- No plan, or a page already open: as an ordinary payment (M7b).
  if open_plan is null
     or exists (select 1 from public.online_payments p
                 where p.family_id = p_family and p.status = 'started'
                   and p.checkout_session_id is not null
                   and p.checkout_session_id not like 'instalment:%') then
    return query select * from public.start_online_payment(p_family);
    return;
  end if;
  if exists (select 1 from public.instalments
              where plan_id = open_plan and status in ('started', 'processing')) then
    raise exception 'A payment is on its way. Try again once it has gone through.'
      using hint = 'plan_invalid';
  end if;
  if exists (select 1 from public.online_payments p
              where p.family_id = p_family and p.status = 'started'
                and p.checkout_session_id is null
                and p.created_at > now() - interval '2 minutes') then
    raise exception 'Your payment page is already opening. Try again in a minute.'
      using hint = 'payment_opening';
  end if;
  select a.stripe_account_id into acct from public.payment_accounts a
   where a.organisation_id = org and a.charges_enabled;
  if acct is null then
    raise exception 'Your activity provider doesn''t take payments in Ovyko yet.'
      using hint = 'payments_off';
  end if;
  owing := private.owing_before_plan(p_family);
  if owing < 50 then
    raise exception 'There''s nothing to pay right now.' using hint = 'nothing_owing';
  end if;
  if owing > 99999999 then
    raise exception 'That''s more than can be paid online in one go. Contact your activity provider.'
      using hint = 'payment_too_large';
  end if;
  fee := round(owing * private.platform_fee_bps() / 10000.0)::bigint;
  insert into public.online_payments
    (organisation_id, family_id, amount_cents, platform_fee_cents, stripe_account_id,
     started_by, pays_off_plan)
  values (org, p_family, owing, fee, acct, private.current_user_id(), open_plan)
  returning id into new_id;
  return query
    select new_id, owing, fee, acct, o.name, null::text
      from public.organisations o where o.id = org;
end;
$$;

revoke all on function public.pay_rest_of_plan(uuid) from public, anon;
grant execute on function public.pay_rest_of_plan(uuid) to authenticated;

-- ------------------------------------------------------------------ for the server only

-- The card or bank account saved with a plan's first payment, for the
-- rest. If nothing usable was saved (no customer, or a way of paying Ovyko
-- can't take again), the plan stops and what's left is simply owed.
create function public.attach_plan_payment_method(
  p_payment uuid, p_account text,
  p_customer text default null, p_payment_method text default null, p_type text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  select i.plan_id into v_plan
    from public.instalments i
    join public.online_payments p on p.id = i.online_payment_id
    join public.instalment_plans pl on pl.id = i.plan_id
   where i.online_payment_id = p_payment and i.seq = 1
     and p.stripe_account_id = p_account and pl.payment_method_id is null
     and pl.status in ('pending', 'active')
   for update of pl;
  if v_plan is null then
    return false;
  end if;
  if p_customer is null or p_payment_method is null
     or p_type is null or p_type not in ('card', 'direct_debit') then
    perform private.stop_plan(v_plan);
    return false;
  end if;
  update public.instalment_plans
     set stripe_customer_id = p_customer, payment_method_id = p_payment_method,
         payment_method_type = p_type, updated_at = now()
   where id = v_plan;
  return true;
end;
$$;

revoke all on function public.attach_plan_payment_method(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.attach_plan_payment_method(uuid, text, text, text, text)
  to service_role;

-- A plan's later payments, for the server to take:
-- * instalments due today (school time) on active plans, each turned into a
--   payment once; never more than the family still owes, and a plan with
--   nothing left to take stops;
-- * payments claimed before whose outcome never came back (the server
--   stopped, or Stripe didn't answer), tried again after 15 minutes with the
--   same payment id, so Stripe never charges twice.
-- A family with a payment page open is left until the page is done.
create function public.claim_due_instalments(p_limit integer default 50)
returns table (payment_id uuid, amount_cents bigint, platform_fee_cents bigint,
               stripe_account_id text, stripe_customer_id text, payment_method_id text,
               school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  acct text;
  pay_id uuid;
  fee bigint;
  amount bigint;
  owing bigint;
begin
  -- Tried before, no answer yet.
  for r in
    select p.id, p.amount_cents, p.platform_fee_cents, p.stripe_account_id,
           pl.stripe_customer_id, pl.payment_method_id, o.name
      from public.online_payments p
      join public.instalments i on i.online_payment_id = p.id
      join public.instalment_plans pl on pl.id = i.plan_id
      join public.organisations o on o.id = p.organisation_id
     where p.status = 'started' and i.seq > 1 and p.checkout_session_id is null
       and p.updated_at < now() - interval '15 minutes'
     order by p.updated_at
     limit p_limit
     for update of p skip locked
  loop
    update public.online_payments set updated_at = now() where id = r.id;
    payment_id := r.id;
    amount_cents := r.amount_cents;
    platform_fee_cents := r.platform_fee_cents;
    stripe_account_id := r.stripe_account_id;
    stripe_customer_id := r.stripe_customer_id;
    payment_method_id := r.payment_method_id;
    school_name := r.name;
    return next;
  end loop;

  -- Due today.
  for r in
    select i.id, i.plan_id, i.organisation_id, i.family_id, i.amount_cents,
           pl.stripe_customer_id, pl.payment_method_id, pl.started_by, o.name
      from public.instalments i
      join public.instalment_plans pl on pl.id = i.plan_id
      join public.organisations o on o.id = i.organisation_id
     where i.status = 'scheduled' and pl.status = 'active'
       and pl.payment_method_id is not null
       and i.due_on <= private.school_today(i.organisation_id)
       and not exists (select 1 from public.online_payments p
                        where p.family_id = i.family_id and p.status = 'started'
                          and p.checkout_session_id is not null
                          and p.checkout_session_id not like 'instalment:%'
                          and p.created_at > now() - interval '2 hours')
     order by i.due_on
     limit p_limit
     for update of i skip locked
  loop
    select a.stripe_account_id into acct from public.payment_accounts a
     where a.organisation_id = r.organisation_id and a.charges_enabled;
    continue when acct is null;
    -- Never more than the family still owes (a voucher or a cancelled fee
    -- since the plan started); nothing left ends the plan.
    owing := private.owing_before_plan(r.family_id);
    amount := least(r.amount_cents, owing);
    if amount < 50 then
      perform private.stop_plan(r.plan_id);
      continue;
    end if;
    fee := round(amount * private.platform_fee_bps() / 10000.0)::bigint;
    insert into public.online_payments
      (organisation_id, family_id, amount_cents, platform_fee_cents, stripe_account_id, started_by)
    values (r.organisation_id, r.family_id, amount, fee, acct, r.started_by)
    returning id into pay_id;
    update public.instalments
       set status = 'started', online_payment_id = pay_id, amount_cents = amount, updated_at = now()
     where id = r.id;
    payment_id := pay_id;
    amount_cents := amount;
    platform_fee_cents := fee;
    stripe_account_id := acct;
    stripe_customer_id := r.stripe_customer_id;
    payment_method_id := r.payment_method_id;
    school_name := r.name;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_due_instalments(integer) from public, anon, authenticated;
grant execute on function public.claim_due_instalments(integer) to service_role;

-- What Stripe says happened to an instalment taken by the server (no
-- payment page): counts only for the school's account, the payment Ovyko
-- made and its amount; repeats change nothing. The method is the plan's.
-- A failure recorded without Stripe's own reference ('failed:…') gives way
-- to Stripe's word on the real payment.
create function public.settle_instalment_payment(
  p_payment uuid, p_account text, p_payment_intent text, p_amount_cents bigint, p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.online_payments;
  method text;
begin
  select * into p from public.online_payments where id = p_payment for update;
  select pl.payment_method_type into method
    from public.instalments i join public.instalment_plans pl on pl.id = i.plan_id
   where i.online_payment_id = p_payment and i.seq > 1;
  if not found or method is null
     or coalesce(p.checkout_session_id, 'instalment:' || p.id) <> 'instalment:' || p.id
     or p.stripe_account_id is distinct from p_account
     or p.amount_cents is distinct from p_amount_cents
     or (p.payment_intent_id is not null and p.payment_intent_id not like 'failed:%'
         and p.payment_intent_id <> p_payment_intent)
     or p_status not in ('paid', 'processing', 'failed') then
    return null;
  end if;
  update public.online_payments
     set checkout_session_id = 'instalment:' || p.id,
         payment_intent_id = case when payment_intent_id like 'failed:%' then null
                                  else payment_intent_id end
   where id = p.id;
  return public.settle_online_payment(
    p.id, p_account, 'instalment:' || p.id, p_amount_cents, p_status, p_payment_intent, method);
end;
$$;

revoke all on function public.settle_instalment_payment(uuid, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.settle_instalment_payment(uuid, text, text, bigint, text)
  to service_role;

-- As in migration 28, except that a failed payment stays failed unless
-- Stripe says it was paid: a late "on its way" message can't bring it back
-- and hide what's owed.
create or replace function public.settle_online_payment(
  p_payment uuid, p_account text, p_session text, p_amount_cents bigint,
  p_status text, p_payment_intent text default null, p_method text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.online_payments;
  line uuid;
begin
  select * into p from public.online_payments where id = p_payment for update;
  if not found or p.stripe_account_id is distinct from p_account
     or p.checkout_session_id is distinct from p_session
     or p.amount_cents is distinct from p_amount_cents
     or p_status not in ('paid', 'processing', 'failed', 'expired') then
    return null;
  end if;
  -- Paid is final; failed becomes only paid; anything else may still change.
  if p.status = 'paid' or p.status = p_status
     or (p.status = 'failed' and p_status <> 'paid') then
    return p.status;
  end if;
  if p_status = 'paid' then
    if p_method is null or p_method not in ('card', 'direct_debit') then
      return null;
    end if;
    insert into public.ledger_entries
      (organisation_id, family_id, kind, amount_cents, description, method, paid_on,
       charge_key, online_payment_id, created_by)
    values
      (p.organisation_id, p.family_id, 'payment', -p.amount_cents,
       case when p_method = 'card' then 'Paid online by card' else 'Paid by direct debit' end,
       p_method, private.school_today(p.organisation_id),
       'online:' || p.id, p.id, p.started_by)
    on conflict (organisation_id, charge_key) where charge_key is not null do nothing
    returning id into line;
    if p.started_by is not null then
      insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
      values ('payment_receipt', p.started_by, p.organisation_id,
              jsonb_build_object('payment_id', p.id), 'receipt:' || p.id)
      on conflict (dedupe_key) do nothing;
    end if;
  elsif p_status = 'failed' and p.started_by is not null then
    -- Chased at once (M7c): it's the parent's own payment.
    insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
    values ('payment_failed', p.started_by, p.organisation_id,
            jsonb_build_object('payment_id', p.id), 'failed:' || p.id)
    on conflict (dedupe_key) do nothing;
  elsif p_status = 'expired' and p.status <> 'started' then
    -- A page that expired after it was used: nothing changes.
    return p.status;
  end if;
  update public.online_payments
     set status = p_status,
         payment_intent_id = coalesce(p_payment_intent, payment_intent_id),
         method = coalesce(p_method, method),
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         updated_at = now()
   where id = p.id;
  return p_status;
end;
$$;

-- Every hour, if instalments are due or waiting on an answer, asks the
-- server to take them.
create function private.kick_instalments()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'ovyko_app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'ovyko_cron_secret';
  if app_url is null or secret is null then
    return;
  end if;
  if not exists (
    select 1 from public.instalments i
      join public.instalment_plans pl on pl.id = i.plan_id
     where i.status = 'scheduled' and pl.status = 'active'
       and i.due_on <= private.school_today(i.organisation_id)
       and extract(hour from now() at time zone
             (select timezone from public.organisations where id = i.organisation_id)) >= 9
  ) and not exists (
    select 1 from public.online_payments p
      join public.instalments i on i.online_payment_id = p.id
     where p.status = 'started' and i.seq > 1 and p.checkout_session_id is null
       and p.updated_at < now() - interval '15 minutes'
  ) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(app_url, '/') || '/api/payments/instalments',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function private.kick_instalments() from public;

select cron.schedule('ovyko-take-instalments', '20 * * * *', 'select private.kick_instalments()');
