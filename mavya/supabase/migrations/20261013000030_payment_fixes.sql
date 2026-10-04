-- Fixes from the review of the money code (docs/M7_PAYMENTS.md, "Review
-- fixes"): no paying twice, refunds and chargebacks that can't be lost, terms
-- with fees that can be deleted, and vouchers that can be handed over again.

-- ------------------------------------------------------------------ no paying twice

-- A parent's payment page that may still be open: started, with a page,
-- or being opened right now. The server asks Stripe how each one stands
-- before a new one is opened.
drop function public.start_online_payment(uuid);

create function public.start_online_payment(p_family uuid)
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
  fee bigint;
  open_page public.online_payments;
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

  -- A page already open is handed back, never a second one.
  select * into open_page from public.online_payments p
   where p.family_id = p_family and p.status = 'started'
     and p.checkout_session_id is not null
   order by p.created_at desc limit 1;
  if found then
    return query
      select open_page.id, open_page.amount_cents, open_page.platform_fee_cents,
             open_page.stripe_account_id, o.name, open_page.checkout_session_id
        from public.organisations o where o.id = org;
    return;
  end if;
  if exists (select 1 from public.online_payments p
              where p.family_id = p_family and p.status = 'started'
                and p.checkout_session_id is null
                and p.created_at > now() - interval '2 minutes') then
    raise exception 'Your payment page is already opening. Try again in a minute.'
      using hint = 'payment_opening';
  end if;

  owing := private.owing_now(p_family);
  if owing < 50 then
    raise exception 'There''s nothing to pay right now.' using hint = 'nothing_owing';
  end if;
  if owing > 99999999 then
    raise exception 'That''s more than can be paid online in one go. Contact your activity provider.'
      using hint = 'payment_too_large';
  end if;
  fee := round(owing * private.platform_fee_bps() / 10000.0)::bigint;
  insert into public.online_payments
    (organisation_id, family_id, amount_cents, platform_fee_cents, stripe_account_id, started_by)
  values (org, p_family, owing, fee, acct, private.current_user_id())
  returning id into new_id;
  return query
    select new_id, owing, fee, acct, o.name, null::text
      from public.organisations o where o.id = org;
end;
$$;

revoke all on function public.start_online_payment(uuid) from public, anon;
grant execute on function public.start_online_payment(uuid) to authenticated;

-- ------------------------------------------------------------------ refunds and chargebacks

-- The payment a Stripe payment belongs to, for the server: from the
-- payment's own reference once settled, otherwise from the Ovyko id Stripe
-- carries on it. Returns its status, or null when it isn't Ovyko's.
create function public.online_payment_status(p_account text, p_payment uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.online_payments
   where id = p_payment and stripe_account_id = p_account
$$;

revoke all on function public.online_payment_status(text, uuid) from public, anon, authenticated;
grant execute on function public.online_payment_status(text, uuid) to service_role;

-- A refund that failed after Stripe counted it: the money stayed with the
-- school, so the refund line is undone. Once per refund.
create function public.record_refund_failed(
  p_account text, p_payment_intent text, p_refund text, p_amount_cents bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.online_payments;
  back bigint;
begin
  select * into p from public.online_payments
   where payment_intent_id = p_payment_intent and stripe_account_id = p_account
   for update;
  if not found or p.status <> 'paid' or p_amount_cents is null or p_amount_cents <= 0 then
    return null;
  end if;
  back := least(p_amount_cents, p.refunded_cents);
  if back <= 0 then
    return 0;
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, kind, amount_cents, description, charge_key, online_payment_id)
  values
    (p.organisation_id, p.family_id, 'credit', -back,
     'Refund didn''t go through: the money stayed with your activity provider',
     'refund-failed:' || p_refund, p.id)
  on conflict (organisation_id, charge_key) where charge_key is not null do nothing;
  if not found then
    return 0;
  end if;
  update public.online_payments set refunded_cents = refunded_cents - back, updated_at = now()
   where id = p.id;
  return back;
end;
$$;

revoke all on function public.record_refund_failed(text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.record_refund_failed(text, text, text, bigint) to service_role;

-- A chargeback the school lost: the bank took the money back from the
-- school, so the family owes it again. Once per dispute.
create function public.record_lost_dispute(
  p_account text, p_payment_intent text, p_dispute text, p_amount_cents bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.online_payments;
  amount bigint;
begin
  select * into p from public.online_payments
   where payment_intent_id = p_payment_intent and stripe_account_id = p_account
   for update;
  if not found or p.status <> 'paid' or p_amount_cents is null or p_amount_cents <= 0 then
    return null;
  end if;
  amount := least(p_amount_cents, p.amount_cents);
  insert into public.ledger_entries
    (organisation_id, family_id, kind, amount_cents, description, charge_key, online_payment_id)
  values
    (p.organisation_id, p.family_id, 'charge', amount,
     'Card payment reversed by your bank', 'dispute:' || p_dispute, p.id)
  on conflict (organisation_id, charge_key) where charge_key is not null do nothing;
  return case when found then amount else 0 end;
end;
$$;

revoke all on function public.record_lost_dispute(text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.record_lost_dispute(text, text, text, bigint) to service_role;

-- A school that disconnects Ovyko from its Stripe account can't take
-- payments in Ovyko until it connects again.
create function public.payment_account_disconnected(p_account text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_accounts
     set charges_enabled = false, payouts_enabled = false, updated_at = now()
   where stripe_account_id = p_account and (charges_enabled or payouts_enabled);
  return found;
end;
$$;

revoke all on function public.payment_account_disconnected(text) from public, anon, authenticated;
grant execute on function public.payment_account_disconnected(text) to service_role;

-- ------------------------------------------------------------------ deleting terms, classes, children

-- Lines are never changed, except that deleting a term, class, child or
-- online payment clears the line's reference to it (the line itself stays).
create or replace function private.ledger_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  refs text[] := array['term_id', 'class_id', 'child_id', 'online_payment_id'];
  col text;
begin
  if (to_jsonb(new) - refs) = (to_jsonb(old) - refs) then
    foreach col in array refs loop
      if (to_jsonb(new) ->> col) is distinct from (to_jsonb(old) ->> col)
         and (to_jsonb(new) ->> col) is not null then
        raise exception 'Account lines can''t be changed; cancel the line instead.'
          using errcode = '42501';
      end if;
    end loop;
    return new;
  end if;
  raise exception 'Account lines can''t be changed; cancel the line instead.' using errcode = '42501';
end;
$$;

-- ------------------------------------------------------------------ vouchers

-- A declined code can be handed over again.
alter table public.voucher_claims drop constraint voucher_claims_organisation_id_scheme_code_key;
create unique index voucher_claims_code_idx on public.voucher_claims (organisation_id, scheme, code)
  where status <> 'declined';

create or replace function public.submit_voucher(p_child uuid, p_scheme text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.children;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  new_id uuid;
begin
  select * into ch from public.children where id = p_child;
  if not found or ch.id not in (select private.my_child_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_scheme is null or not exists (
       select 1 from public.organisations
        where id = ch.organisation_id and p_scheme = any (voucher_schemes)) then
    raise exception 'Your activity provider doesn''t take that voucher in Ovyko.'
      using hint = 'voucher_invalid';
  end if;
  if v_code !~ '^[A-Z0-9-]{4,40}$' then
    raise exception 'Enter the voucher''s code as it appears on the voucher.'
      using hint = 'voucher_invalid';
  end if;
  if exists (select 1 from public.voucher_claims
              where organisation_id = ch.organisation_id and scheme = p_scheme
                and code = v_code and status <> 'declined') then
    raise exception 'That voucher has already been handed over.' using hint = 'voucher_used';
  end if;
  insert into public.voucher_claims
    (organisation_id, family_id, child_id, scheme, code, submitted_by)
  values (ch.organisation_id, ch.family_id, ch.id, p_scheme, v_code, private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

-- Cancelling a line, as in M7b; cancelling a voucher's credit (a wrong
-- amount) puts the voucher back to be redeemed again.
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
  update public.voucher_claims
     set status = 'submitted', amount_cents = null, ledger_entry_id = null,
         decided_by = null, decided_at = null
   where ledger_entry_id = e.id;
  return new_id;
end;
$$;
