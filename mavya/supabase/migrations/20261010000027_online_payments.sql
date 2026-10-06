-- Card and direct-debit payments (docs/M7_PAYMENTS.md, M7b). Each school
-- connects its own Stripe account; parents pay what's owing on Stripe's own
-- page; Stripe's signed messages, checked by the server, settle payments
-- into the family's account. Only the server (the secret key) writes these
-- tables, through the functions below.

-- ------------------------------------------------------------------ the school's Stripe account

create table public.payment_accounts (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  -- Stripe's say on whether the school can take payments and be paid out.
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_accounts enable row level security;
revoke all on public.payment_accounts from anon, authenticated;
grant select on public.payment_accounts to authenticated;

create policy payment_accounts_select on public.payment_accounts
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

create trigger audit_payment_accounts after insert or update or delete on public.payment_accounts
  for each row execute function private.audit_change();

-- Ovyko's share of each online payment, in hundredths of a percent (50 =
-- 0.5%). One place to change it.
create function private.platform_fee_bps()
returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

revoke all on function private.platform_fee_bps() from public;

-- ------------------------------------------------------------------ payments parents start

create table public.online_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  amount_cents bigint not null check (amount_cents between 50 and 100000000),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  -- started: on Stripe's page; processing: a direct debit on its way.
  status text not null default 'started'
    check (status in ('started', 'processing', 'paid', 'failed', 'expired')),
  stripe_account_id text not null,
  checkout_session_id text unique,
  payment_intent_id text unique,
  method text check (method in ('card', 'direct_debit')),
  refunded_cents bigint not null default 0 check (refunded_cents between 0 and amount_cents),
  started_by uuid references public.users (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, id),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade
);

create index online_payments_family_idx on public.online_payments (family_id, created_at desc);

alter table public.online_payments enable row level security;
revoke all on public.online_payments from anon, authenticated;
grant select on public.online_payments to authenticated;

create policy online_payments_select on public.online_payments
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create trigger audit_online_payments after insert or update or delete on public.online_payments
  for each row execute function private.audit_change();

-- Account lines: direct debit as a method, and the online payment a line
-- came from.
alter table public.ledger_entries drop constraint ledger_entries_method_check;
alter table public.ledger_entries
  add constraint ledger_entries_method_check
    check (method in ('bank_transfer', 'card', 'cash', 'other', 'direct_debit'));
alter table public.ledger_entries
  add column online_payment_id uuid,
  add foreign key (organisation_id, online_payment_id)
    references public.online_payments (organisation_id, id) on delete set null (online_payment_id);

-- Receipts.
alter table public.email_deliveries drop constraint email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check check (kind in (
    'spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder',
    'reenrolment_ask', 'reenrolment_reminder', 'payment_receipt'));

-- ------------------------------------------------------------------ for parents

-- Whether a school can take payments in Ovyko. For its owners and its
-- families; says nothing else about the account.
create function public.can_pay_online(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (private.is_org_member(p_org, array['owner'])
          or p_org in (select private.my_family_org_ids()))
     and exists (select 1 from public.payment_accounts
                  where organisation_id = p_org and charges_enabled)
$$;

revoke all on function public.can_pay_online(uuid) from public, anon;
grant execute on function public.can_pay_online(uuid) to authenticated;

-- What a family owes that isn't already on its way: the balance less
-- direct debits still clearing.
create function private.owing_now(p_family uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(amount_cents) from public.ledger_entries where family_id = p_family), 0)
       - coalesce((select sum(amount_cents) from public.online_payments
                    where family_id = p_family and status = 'processing'), 0)
$$;

revoke all on function private.owing_now(uuid) from public;

-- A parent starts paying what their family owes. Returns what the server
-- needs to open Stripe's payment page; the server then attaches the page
-- (attach_checkout_session).
create function public.start_online_payment(p_family uuid)
returns table (payment_id uuid, amount_cents bigint, platform_fee_cents bigint,
               stripe_account_id text, school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  acct text;
  owing bigint;
  fee bigint;
  new_id uuid;
begin
  if p_family is null or p_family not in (select private.my_family_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select f.organisation_id into org from public.families f where f.id = p_family;
  select a.stripe_account_id into acct from public.payment_accounts a
   where a.organisation_id = org and a.charges_enabled;
  if acct is null then
    raise exception 'Your activity provider doesn''t take payments in Ovyko yet.'
      using hint = 'payments_off';
  end if;
  -- One at a time per family, so two taps can't start two payments.
  perform 1 from public.families where id = p_family for update;
  owing := private.owing_now(p_family);
  if owing < 50 then
    raise exception 'There''s nothing to pay right now.' using hint = 'nothing_owing';
  end if;
  fee := round(owing * private.platform_fee_bps() / 10000.0)::bigint;
  insert into public.online_payments
    (organisation_id, family_id, amount_cents, platform_fee_cents, stripe_account_id, started_by)
  values (org, p_family, owing, fee, acct, private.current_user_id())
  returning id into new_id;
  return query
    select new_id, owing, fee, acct, o.name from public.organisations o where o.id = org;
end;
$$;

revoke all on function public.start_online_payment(uuid) from public, anon;
grant execute on function public.start_online_payment(uuid) to authenticated;

-- ------------------------------------------------------------------ for the server only

-- Records the Stripe account the server created for a school, or Stripe's
-- latest say on it. Keeps the first account if two were created at once.
create function public.save_payment_account(
  p_org uuid, p_account text, p_charges boolean, p_payouts boolean, p_details boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept text;
begin
  insert into public.payment_accounts
    (organisation_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted)
  values (p_org, p_account, p_charges, p_payouts, p_details)
  on conflict (organisation_id) do nothing;
  select stripe_account_id into kept from public.payment_accounts where organisation_id = p_org;
  if kept = p_account then
    update public.payment_accounts
       set charges_enabled = p_charges, payouts_enabled = p_payouts,
           details_submitted = p_details, updated_at = now()
     where organisation_id = p_org
       and (charges_enabled, payouts_enabled, details_submitted)
           is distinct from (p_charges, p_payouts, p_details);
  end if;
  return kept;
end;
$$;

revoke all on function public.save_payment_account(uuid, text, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.save_payment_account(uuid, text, boolean, boolean, boolean)
  to service_role;

-- Stripe's say on an account it told us about (account.updated). An
-- account no school uses changes nothing.
create function public.update_payment_account(
  p_account text, p_charges boolean, p_payouts boolean, p_details boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_accounts
     set charges_enabled = p_charges, payouts_enabled = p_payouts,
         details_submitted = p_details, updated_at = now()
   where stripe_account_id = p_account
     and (charges_enabled, payouts_enabled, details_submitted)
         is distinct from (p_charges, p_payouts, p_details);
  return found;
end;
$$;

revoke all on function public.update_payment_account(text, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_payment_account(text, boolean, boolean, boolean)
  to service_role;

create function public.attach_checkout_session(p_payment uuid, p_session text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.online_payments set checkout_session_id = p_session, updated_at = now()
   where id = p_payment and status = 'started' and checkout_session_id is null;
  if not found then
    raise exception 'That payment can''t take a payment page.' using hint = 'payment_invalid';
  end if;
end;
$$;

revoke all on function public.attach_checkout_session(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, text) to service_role;

-- What Stripe says happened to a payment page. Counts only when it comes
-- from the school's own Stripe account, for the page Ovyko opened, for the
-- amount Ovyko asked; saying it twice changes nothing. p_status: paid,
-- processing, failed or expired. Returns the payment's status afterwards,
-- or null when the message doesn't match a payment.
create function public.settle_online_payment(
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
  -- Paid is final; anything else may still become paid (a late message).
  if p.status = 'paid' or p.status = p_status then
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

revoke all on function public.settle_online_payment(uuid, text, text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_online_payment(uuid, text, text, bigint, text, text, text)
  to service_role;

-- Stripe's running total refunded on a payment (charge.refunded). Adds a
-- refund line for whatever is new; the same total twice adds nothing.
create function public.record_online_refund(
  p_account text, p_payment_intent text, p_refunded_cents bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.online_payments;
  extra bigint;
begin
  select * into p from public.online_payments
   where payment_intent_id = p_payment_intent and stripe_account_id = p_account
   for update;
  if not found or p.status <> 'paid' or p_refunded_cents is null
     or p_refunded_cents > p.amount_cents then
    return null;
  end if;
  extra := p_refunded_cents - p.refunded_cents;
  if extra <= 0 then
    return 0;
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, kind, amount_cents, description, charge_key, online_payment_id)
  values
    (p.organisation_id, p.family_id, 'refund', extra, 'Refunded to your card or bank',
     format('refund:%s:%s', p.id, p_refunded_cents), p.id);
  update public.online_payments
     set refunded_cents = p_refunded_cents, updated_at = now()
   where id = p.id;
  return extra;
end;
$$;

revoke all on function public.record_online_refund(text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.record_online_refund(text, text, bigint) to service_role;

-- ------------------------------------------------------------------ cancelling lines

-- As in M7a, except money taken or refunded online: that is changed by a
-- refund in Stripe, never by saying it didn't happen.
create or replace function public.cancel_ledger_entry(p_entry uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.ledger_entries;
  new_id uuid;
begin
  select * into e from public.ledger_entries where id = p_entry for update;
  if not found or not private.is_org_member(e.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if e.online_payment_id is not null then
    raise exception 'Online payments and refunds are changed in Stripe: refund the payment there.'
      using hint = 'online_line';
  end if;
  if coalesce(trim(p_reason), '') = '' or length(trim(p_reason)) > 200 then
    raise exception 'Say why the line is being cancelled.' using hint = 'ledger_invalid';
  end if;
  if e.kind = 'cancellation'
     or exists (select 1 from public.ledger_entries where cancels_id = e.id) then
    raise exception 'That line has already been cancelled.' using hint = 'already_cancelled';
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, child_id, kind, amount_cents, description, cancels_id, created_by)
  values
    (e.organisation_id, e.family_id, e.child_id, 'cancellation', -e.amount_cents,
     'Cancelled: ' || left(trim(p_reason), 187), e.id, private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;
