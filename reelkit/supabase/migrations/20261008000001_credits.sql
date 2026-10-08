-- Accounts and credits.
--
-- A credit buys one AI-written set of three ads. Everyone starts with
-- FREE_CREDITS; more come from Stripe Checkout. The balance lives on
-- `accounts` and every change to it is a row in `credit_ledger`, written in
-- the same statement, so the two cannot disagree and a balance can always be
-- explained line by line.
--
-- Nothing here is writable by a signed-in user. They can read their own
-- account and ledger; every change goes through a function that only the
-- server's secret key may call, after the server has checked who is asking
-- (or, for purchases, that the message really came from Stripe).

create table public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null check (reason in ('signup', 'purchase', 'spend', 'refund')),
  -- What the change is about: the Checkout session for a purchase, the
  -- server's request id for a spend and its refund.
  ref text,
  amount_cents integer,
  currency text,
  created_at timestamptz not null default now()
);

create index credit_ledger_user on public.credit_ledger (user_id, created_at desc);

-- The idempotency keys. Stripe delivers webhooks at least once, and a
-- refund retried after a timeout must not pay out twice.
create unique index credit_ledger_purchase_once on public.credit_ledger (ref) where reason = 'purchase';
create unique index credit_ledger_refund_once on public.credit_ledger (ref) where reason = 'refund';
create unique index credit_ledger_spend_once on public.credit_ledger (ref) where reason = 'spend';

alter table public.accounts enable row level security;
alter table public.credit_ledger enable row level security;

create policy "read own account" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own ledger" on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.accounts, public.credit_ledger from anon, authenticated;
grant select on public.accounts, public.credit_ledger to authenticated;

-- ---------------------------------------------------------------- sign-up

create function public.free_credits() returns integer
  language sql immutable as $$ select 3 $$;

create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accounts (user_id, credits) values (new.id, public.free_credits());
  insert into public.credit_ledger (user_id, delta, balance_after, reason)
    values (new.id, public.free_credits(), public.free_credits(), 'signup');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- spend

-- Takes one credit. Returns the new balance, or null when there was none to
-- take. The `credits >= 1` guard is in the UPDATE itself, so two requests
-- racing for the last credit cannot both win.
create function public.spend_credit(p_user uuid, p_ref text) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  update public.accounts set credits = credits - 1
    where user_id = p_user and credits >= 1
    returning credits into v_balance;
  if v_balance is null then
    return null;
  end if;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
    values (p_user, -1, v_balance, 'spend', p_ref);
  return v_balance;
end $$;

-- Gives back the credit a spend took, once, and only for a spend that
-- happened. Returns the new balance, or null when there was nothing to refund.
create function public.refund_credit(p_user uuid, p_ref text) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user and reason = 'spend' and ref = p_ref
  ) then
    return null;
  end if;
  update public.accounts set credits = credits + 1
    where user_id = p_user
    returning credits into v_balance;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref)
    values (p_user, 1, v_balance, 'refund', p_ref);
  return v_balance;
exception when unique_violation then
  return null;
end $$;

-- ---------------------------------------------------------------- purchase

-- Adds a paid pack, once per Checkout session. Returns true when credits were
-- added, false when this session was already counted (a repeated webhook).
create function public.grant_purchase(
  p_user uuid,
  p_session text,
  p_credits integer,
  p_amount_cents integer,
  p_currency text
) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'a purchase must add credits';
  end if;
  if exists (select 1 from public.credit_ledger where reason = 'purchase' and ref = p_session) then
    return false;
  end if;
  update public.accounts set credits = credits + p_credits
    where user_id = p_user
    returning credits into v_balance;
  if v_balance is null then
    raise exception 'no account for user %', p_user;
  end if;
  insert into public.credit_ledger (user_id, delta, balance_after, reason, ref, amount_cents, currency)
    values (p_user, p_credits, v_balance, 'purchase', p_session, p_amount_cents, p_currency);
  return true;
exception when unique_violation then
  -- Two deliveries of the same webhook raced past the check above; the
  -- second one's whole transaction, balance update included, is undone.
  return false;
end $$;

revoke execute on function public.spend_credit(uuid, text) from public, anon, authenticated;
revoke execute on function public.refund_credit(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_purchase(uuid, text, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.spend_credit(uuid, text) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;
grant execute on function public.grant_purchase(uuid, text, integer, integer, text) to service_role;
