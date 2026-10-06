-- Due dates and fee reminders (docs/M7_PAYMENTS.md, M7c part 1). Every
-- charge has a due date; schools that switch reminders on have Ovyko email
-- families before and after fees fall due; a failed direct debit is chased
-- at once. Owners see what's overdue.

-- ------------------------------------------------------------------ due dates

alter table public.ledger_entries
  add column due_on date,
  add constraint ledger_entries_due_on_check
    check (due_on is null or kind in ('term_fee', 'charge'));

-- Lines added before due dates existed fall due the day they were added.
-- Lines are otherwise never changed (M7a).
alter table public.ledger_entries disable trigger ledger_entries_append_only;
update public.ledger_entries l
   set due_on = (l.created_at at time zone o.timezone)::date
  from public.organisations o
 where o.id = l.organisation_id and l.kind in ('term_fee', 'charge') and l.due_on is null;
alter table public.ledger_entries enable trigger ledger_entries_append_only;

create index ledger_entries_due_idx on public.ledger_entries (organisation_id, due_on)
  where due_on is not null;

-- Term fees fall due on the term's first day, or the day they're added once
-- it's under way (from_day). Otherwise as in M7a.
create or replace function public.create_term_fees(p_term uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms;
  from_day date;
  added integer;
begin
  select * into t from public.terms where id = p_term;
  if not found or not private.is_org_member(t.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  from_day := greatest(t.starts_on, private.school_today(t.organisation_id));
  if from_day > t.ends_on then
    raise exception 'This term has finished.' using hint = 'ledger_invalid';
  end if;

  with places as (
    select e.organisation_id, e.child_id, ch.family_id,
           case when a.answer = 'move' then a.offered_class_id else e.class_id end as class_id
      from public.enrolments e
      join public.children ch on ch.id = e.child_id and ch.active
      left join public.reenrolment_asks a on a.term_id = t.id and a.enrolment_id = e.id
     where e.organisation_id = t.organisation_id
       and e.status = 'active'
       and a.answer is distinct from 'leave'
  ),
  priced as (
    select p.*, c.name as class_name, c.price_per_lesson_cents as unit,
           private.lessons_between(c.weekday, from_day, t.ends_on) as lessons
      from places p
      join public.classes c on c.id = p.class_id and c.active
     where c.price_per_lesson_cents > 0
  ),
  rows as (
    insert into public.ledger_entries
      (organisation_id, family_id, child_id, kind, amount_cents, description,
       term_id, class_id, lessons, unit_cents, charge_key, created_by, due_on)
    select organisation_id, family_id, child_id, 'term_fee', unit::bigint * lessons,
           left(t.name || ' · ' || class_name, 200),
           t.id, class_id, lessons, unit, format('term:%s:%s:%s', t.id, child_id, class_id),
           private.current_user_id(), from_day
      from priced
     where lessons > 0
    on conflict (organisation_id, charge_key) where charge_key is not null do nothing
    returning 1
  )
  select count(*) into added from rows;
  return added;
end;
$$;

-- Other charges fall due the day they're added. Otherwise as in M7a.
create or replace function public.add_account_line(
  p_family uuid, p_kind text, p_amount_cents bigint, p_reason text, p_child uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := private.owned_family(p_family);
  new_id uuid;
begin
  if p_kind is null or p_kind not in ('credit', 'charge')
     or p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000
     or coalesce(trim(p_reason), '') = '' or length(trim(p_reason)) > 200
     or (p_child is not null and not exists (
           select 1 from public.children where id = p_child and family_id = p_family)) then
    raise exception 'Enter an amount and a reason.' using hint = 'ledger_invalid';
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, child_id, kind, amount_cents, description, created_by, due_on)
  values
    (org, p_family, p_child, p_kind,
     case when p_kind = 'credit' then -p_amount_cents else p_amount_cents end,
     trim(p_reason), private.current_user_id(),
     case when p_kind = 'charge' then private.school_today(org) end)
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------------ what's owed when

-- What a family owes (private.owing_now, M7b) that fell due before p_day.
-- Payments count against the oldest charges first, so it is what's owing
-- less charges due on or after p_day (a cancelled charge isn't due).
create function private.overdue(p_family uuid, p_day date)
returns bigint
language sql
stable
set search_path = ''
as $$
  select greatest(0, private.owing_now(p_family)
    - coalesce((select sum(l.amount_cents) from public.ledger_entries l
                 where l.family_id = p_family and l.due_on >= p_day
                   and not exists (select 1 from public.ledger_entries c
                                    where c.cancels_id = l.id)), 0))
$$;

revoke all on function private.overdue(uuid, date) from public;

-- For the owner: every family with a balance, largest first, and how much
-- of it is overdue. Replaces M7a's, which had no overdue column.
drop function public.family_balances(uuid);

create function public.family_balances(p_org uuid)
returns table (family_id uuid, display_name text, balance_cents bigint, overdue_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date;
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  today := private.school_today(p_org);
  return query
    select f.id, f.display_name, sum(l.amount_cents)::bigint, private.overdue(f.id, today)
      from public.ledger_entries l
      join public.families f on f.id = l.family_id
     where l.organisation_id = p_org
     group by f.id, f.display_name
    having sum(l.amount_cents) <> 0
     order by sum(l.amount_cents) desc, f.display_name;
end;
$$;

revoke all on function public.family_balances(uuid) from public, anon;
grant execute on function public.family_balances(uuid) to authenticated;

-- ------------------------------------------------------------------ reminders

alter table public.organisations
  add column fee_reminders boolean not null default false;

create function public.set_fee_reminders(p_org uuid, p_on boolean)
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
  select fee_reminders into was from public.organisations where id = p_org for update;
  if was = p_on then
    return;
  end if;
  update public.organisations set fee_reminders = p_on where id = p_org;
  -- Organisations aren't audited row by row; this choice is.
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('fee_reminders', was), jsonb_build_object('fee_reminders', p_on));
end;
$$;

revoke all on function public.set_fee_reminders(uuid, boolean) from public, anon;
grant execute on function public.set_fee_reminders(uuid, boolean) to authenticated;

alter table public.email_deliveries drop constraint email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check check (kind in (
    'spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder',
    'reenrolment_ask', 'reenrolment_reminder', 'payment_receipt',
    'fee_reminder', 'payment_failed'));

-- At 9am school time, for schools with reminders on: a week before a due
-- date (if anything is owing), on the day, and a week and two weeks after
-- (if still overdue). One email per parent, stage and due date. The sender
-- checks again before sending.
create function private.queue_fee_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  with schools as (
    select o.id, (p_now at time zone o.timezone)::date as today
      from public.organisations o
     where o.fee_reminders
       and extract(hour from p_now at time zone o.timezone) = 9
  ),
  due as (
    select distinct l.family_id, l.organisation_id, l.due_on, s.today,
           case l.due_on - s.today
             when 7 then 'soon' when 0 then 'due' else 'overdue' end as stage
      from public.ledger_entries l
      join schools s on s.id = l.organisation_id
     where l.due_on in (s.today + 7, s.today, s.today - 7, s.today - 14)
       and not exists (select 1 from public.ledger_entries c where c.cancels_id = l.id)
  ),
  owing as (
    select d.* from due d
     where case when d.stage = 'soon' then private.owing_now(d.family_id) > 0
                else private.overdue(d.family_id, d.today + 1) > 0 end
  ),
  queued_rows as (
    insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
    select 'fee_reminder', fm.user_id, o.organisation_id,
           jsonb_build_object('family_id', o.family_id, 'stage', o.stage, 'due_on', o.due_on),
           format('fees:%s:%s:%s:%s', o.family_id, fm.user_id, o.due_on, o.today)
      from owing o
      join public.family_members fm on fm.family_id = o.family_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into queued from queued_rows;
  return queued;
end;
$$;

revoke all on function private.queue_fee_reminders(timestamptz) from public;

-- For the tests and support: the same job for a given moment. Server only.
create function public.queue_fee_reminders_at(p_now timestamptz)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.queue_fee_reminders(p_now)
$$;

revoke all on function public.queue_fee_reminders_at(timestamptz) from public, anon, authenticated;
grant execute on function public.queue_fee_reminders_at(timestamptz) to service_role;

-- For the sender: what a family owes now and has overdue, checked just
-- before a reminder goes. Server only.
create function public.family_dues(p_family uuid)
returns table (owing_cents bigint, overdue_cents bigint, reminders_on boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select private.owing_now(f.id),
         private.overdue(f.id, private.school_today(f.organisation_id) + 1),
         o.fee_reminders
    from public.families f
    join public.organisations o on o.id = f.organisation_id
   where f.id = p_family
$$;

revoke all on function public.family_dues(uuid) from public, anon, authenticated;
grant execute on function public.family_dues(uuid) to service_role;

select cron.schedule('ovyko-fee-reminders', '10 * * * *', 'select private.queue_fee_reminders()');

-- ------------------------------------------------------------------ failed payments

-- As in M7b, and a failed direct debit emails the parent who paid.
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
