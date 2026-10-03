-- Family accounts (docs/M7_PAYMENTS.md, M7a): a price per lesson on each
-- class, and a ledger per family where every amount is a line that is never
-- changed. Term fees are worked out from the timetable; the owner records
-- money taken elsewhere, credits, charges and cancellations. No money moves
-- through Ovyko yet.

alter table public.classes
  add column price_per_lesson_cents integer
    check (price_per_lesson_cents is null or price_per_lesson_cents between 0 and 100000);

-- ------------------------------------------------------------------ the ledger

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  child_id uuid,
  kind text not null
    check (kind in ('term_fee', 'charge', 'payment', 'credit', 'refund', 'cancellation')),
  -- Positive adds to what the family owes; negative reduces it.
  amount_cents bigint not null check (amount_cents <> 0 and abs(amount_cents) <= 100000000),
  description text not null check (length(trim(description)) between 1 and 200),
  -- Term fees: which term and class, and how it was worked out.
  term_id uuid,
  class_id uuid,
  lessons integer check (lessons is null or lessons > 0),
  unit_cents integer check (unit_cents is null or unit_cents >= 0),
  -- Payments: how and when the school was paid.
  method text check (method in ('bank_transfer', 'card', 'cash', 'other')),
  paid_on date,
  -- A cancellation points at the line it cancels; each line once.
  cancels_id uuid unique references public.ledger_entries (id) on delete cascade,
  -- Stops the same term fee being created twice.
  charge_key text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind in ('term_fee', 'charge', 'refund') and amount_cents > 0)
    or (kind in ('payment', 'credit') and amount_cents < 0)
    or kind = 'cancellation'
  ),
  check ((kind = 'cancellation') = (cancels_id is not null)),
  check (kind <> 'payment' or (method is not null and paid_on is not null)),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id)
    on delete set null (child_id),
  foreign key (organisation_id, term_id) references public.terms (organisation_id, id)
    on delete set null (term_id),
  foreign key (organisation_id, class_id) references public.classes (organisation_id, id)
    on delete set null (class_id)
);

create unique index ledger_entries_charge_key_idx on public.ledger_entries (organisation_id, charge_key)
  where charge_key is not null;
create index ledger_entries_family_idx on public.ledger_entries (family_id, created_at desc);

-- Lines are read-only to people; only the functions below add them, and no
-- one changes one (deleting a family removes its account).
alter table public.ledger_entries enable row level security;
revoke all on public.ledger_entries from anon, authenticated;
grant select on public.ledger_entries to authenticated;

create policy ledger_entries_select on public.ledger_entries
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create function private.ledger_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Account lines can''t be changed; cancel the line instead.' using errcode = '42501';
end;
$$;

revoke all on function private.ledger_is_append_only() from public;

create trigger ledger_entries_append_only before update on public.ledger_entries
  for each row execute function private.ledger_is_append_only();

create trigger audit_ledger_entries after insert or update or delete on public.ledger_entries
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ term fees

-- How many times a class meets between two dates (its weekday, inclusive).
create function private.lessons_between(p_weekday integer, p_from date, p_to date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_to < p_from then 0
         else (select count(*)::integer
                 from generate_series(p_from, p_to, interval '1 day') as d
                where extract(isodow from d) = p_weekday)
         end
$$;

revoke all on function private.lessons_between(integer, date, date) from public;

-- Charges each child for the term, per class: price per lesson × lessons
-- from the term's first day (or today, once it's under way) to its last.
-- Children leaving that term (M6e) aren't charged; children moving up are
-- charged for their new class. Running it again adds only what's missing.
-- Returns how many charges it added.
create function public.create_term_fees(p_term uuid)
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
       term_id, class_id, lessons, unit_cents, charge_key, created_by)
    select organisation_id, family_id, child_id, 'term_fee', unit::bigint * lessons,
           left(t.name || ' · ' || class_name, 200),
           t.id, class_id, lessons, unit, format('term:%s:%s:%s', t.id, child_id, class_id),
           private.current_user_id()
      from priced
     where lessons > 0
    on conflict (organisation_id, charge_key) where charge_key is not null do nothing
    returning 1
  )
  select count(*) into added from rows;
  return added;
end;
$$;

revoke all on function public.create_term_fees(uuid) from public, anon;
grant execute on function public.create_term_fees(uuid) to authenticated;

-- ------------------------------------------------------------------ owners' lines

create function private.owned_family(p_family uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organisation_id into org from public.families where id = p_family;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return org;
end;
$$;

revoke all on function private.owned_family(uuid) from public;

-- Money the school took elsewhere (bank transfer, card terminal, cash).
create function public.record_payment(
  p_family uuid, p_amount_cents bigint, p_method text, p_paid_on date, p_note text default null
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
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000
     or p_method is null or p_method not in ('bank_transfer', 'card', 'cash', 'other')
     or p_paid_on is null or p_paid_on > private.school_today(org)
     or length(coalesce(p_note, '')) > 200 then
    raise exception 'Enter an amount, how it was paid and a date that isn''t in the future.'
      using hint = 'ledger_invalid';
  end if;
  insert into public.ledger_entries
    (organisation_id, family_id, kind, amount_cents, description, method, paid_on, created_by)
  values
    (org, p_family, 'payment', -p_amount_cents,
     coalesce(nullif(trim(p_note), ''), 'Payment received'), p_method, p_paid_on,
     private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.record_payment(uuid, bigint, text, date, text) from public, anon;
grant execute on function public.record_payment(uuid, bigint, text, date, text) to authenticated;

-- A credit (a discount, a voucher, goodwill) or another charge, with a reason.
create function public.add_account_line(
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
    (organisation_id, family_id, child_id, kind, amount_cents, description, created_by)
  values
    (org, p_family, p_child, p_kind,
     case when p_kind = 'credit' then -p_amount_cents else p_amount_cents end,
     trim(p_reason), private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_account_line(uuid, text, bigint, text, uuid) from public, anon;
grant execute on function public.add_account_line(uuid, text, bigint, text, uuid) to authenticated;

-- Cancels a line by adding its opposite. Both stay on the statement.
create function public.cancel_ledger_entry(p_entry uuid, p_reason text)
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

revoke all on function public.cancel_ledger_entry(uuid, text) from public, anon;
grant execute on function public.cancel_ledger_entry(uuid, text) to authenticated;

-- For the owner: every family with a balance, largest first.
create function public.family_balances(p_org uuid)
returns table (family_id uuid, display_name text, balance_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select f.id, f.display_name, sum(l.amount_cents)::bigint
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
