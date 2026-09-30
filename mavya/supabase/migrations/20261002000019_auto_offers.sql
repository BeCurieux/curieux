-- Automatic offers (docs/M5_5_AUTO_OFFERS.md): when a spot opens, the
-- best-fitting family with a make-up credit is offered it at once; if they
-- say no or don't answer in time, the next family is. The engine reacts to
-- what happens (an absence, a credit issued or used, an offer answered, a
-- make-up cancelled, the rules saved) and sweeps every five minutes so
-- offers that ran out move on.

-- ------------------------------------------------------------------ offer states

-- 'withdrawn': closed because the child can no longer take it (their credit
-- was used or taken back) or the lesson was cancelled. Unlike a "no", a
-- claim or letting it run out, it doesn't stop the child being offered that
-- lesson again later.
alter table public.vacancy_offers drop constraint vacancy_offers_status_check;
alter table public.vacancy_offers add constraint vacancy_offers_status_check
  check (status in ('offered', 'claimed', 'declined', 'expired', 'filled', 'withdrawn'));

create or replace function private.close_offers_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.vacancy_offers set status = 'withdrawn', responded_at = now()
     where occurrence_id = new.id and status = 'offered';
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------------ rules

create or replace function private.makeup_defaults()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'makeups_enabled', true,
    'minimum_notice_minutes', 120,
    'credit_validity_days', 60,
    'max_active_credits', 2,
    'eligible_level_mode', 'same_level',
    'allow_future_level', false,
    'booking_horizon_days', 14,
    'cancellation_notice_minutes', 120,
    'return_credit_on_valid_cancellation', true,
    'allow_temporary_vacancy_offers', true,
    'waitlist_priority', 'existing_students_first',
    'auto_offer', true,
    'offer_hold_minutes', 120
  )
$$;

-- As in M4, plus auto_offer and offer_hold_minutes.
create or replace function public.save_makeup_policy(p_org uuid, p_config jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := '{}';
  next_version integer;
  flag text;
  key text;
  lo integer;
  hi integer;
  v integer;
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Yes/no settings.
  foreach flag in array array['makeups_enabled', 'allow_future_level',
                              'return_credit_on_valid_cancellation', 'auto_offer'] loop
    if p_config ? flag then
      if jsonb_typeof(p_config -> flag) <> 'boolean' then
        raise exception 'Some of those settings aren''t valid.' using hint = 'invalid_policy';
      end if;
      cfg := cfg || jsonb_build_object(flag, p_config -> flag);
    end if;
  end loop;

  -- Whole numbers within sensible bounds.
  for key, lo, hi in
    select * from (values
      ('minimum_notice_minutes', 0, 10080),
      ('credit_validity_days', 1, 365),
      ('max_active_credits', 1, 20),
      ('booking_horizon_days', 1, 90),
      ('cancellation_notice_minutes', 0, 10080),
      ('offer_hold_minutes', 15, 1440)
    ) as limits(k, l, h)
  loop
    if p_config ? key then
      if jsonb_typeof(p_config -> key) <> 'number' then
        raise exception 'Some of those settings aren''t valid.' using hint = 'invalid_policy';
      end if;
      v := (p_config ->> key)::numeric::integer;
      if v < lo or v > hi or (p_config ->> key)::numeric <> v then
        raise exception 'Some of those settings aren''t valid.' using hint = 'invalid_policy';
      end if;
      cfg := cfg || jsonb_build_object(key, v);
    end if;
  end loop;

  select coalesce(max(version), 0) + 1 into next_version
    from public.policy_sets where organisation_id = p_org and policy_type = 'makeup';
  update public.policy_sets set active = false
   where organisation_id = p_org and policy_type = 'makeup' and active;
  insert into public.policy_sets (organisation_id, policy_type, config_json, version, active, created_by)
  values (p_org, 'makeup', cfg, next_version, true, private.current_user_id());
  return next_version;
end;
$$;

-- ------------------------------------------------------------------ one eligibility check

-- check_makeup's rules, without its caller check, so the engine can apply
-- them with no one signed in. The rules are unchanged from M4.
create function private.makeup_reasons(p_credit uuid, p_occurrence uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cr record;
  lesson record;
  policy jsonb;
  reasons text[] := '{}';
  levels uuid[];
begin
  select c.id, c.organisation_id, c.child_id, c.status, c.expires_at into cr
    from public.makeup_credits c where c.id = p_credit;
  if cr.id is null then
    return array['This credit is no longer valid.'];
  end if;
  policy := private.makeup_policy(cr.organisation_id);

  if not (policy ->> 'makeups_enabled')::boolean then
    reasons := array_append(reasons, 'Make-ups aren''t offered at the moment.');
  end if;
  if cr.status = 'redeemed' then
    reasons := array_append(reasons, 'This credit has already been used.');
  elsif cr.status <> 'available' then
    reasons := array_append(reasons, 'This credit is no longer valid.');
  elsif cr.expires_at <= now() then
    reasons := array_append(reasons, 'This credit has expired.');
  end if;

  select o.id, o.organisation_id, o.class_id, o.starts_at, o.ends_at, o.status, c.level_id, lv.program_id, lv.sort_order
    into lesson
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
    join public.levels lv on lv.id = c.level_id
   where o.id = p_occurrence;
  if lesson.id is null or lesson.organisation_id <> cr.organisation_id then
    return array_append(reasons, 'That lesson isn''t at your child''s provider.');
  end if;

  if lesson.status = 'cancelled' then
    reasons := array_append(reasons, 'That lesson is cancelled.');
  end if;
  if lesson.starts_at <= now() then
    reasons := array_append(reasons, 'That lesson has already started.');
  elsif lesson.starts_at > now() + make_interval(days => (policy ->> 'booking_horizon_days')::integer) then
    reasons := array_append(reasons, format('Make-ups can be booked up to %s days ahead.', policy ->> 'booking_horizon_days'));
  end if;
  if lesson.starts_at > cr.expires_at then
    reasons := array_append(reasons, 'The credit expires before that lesson.');
  end if;

  select array_agg(l) into levels from private.child_level_ids(cr.child_id) l;
  if not (
    lesson.level_id = any (coalesce(levels, '{}'))
    or ((policy ->> 'allow_future_level')::boolean and exists (
      select 1 from public.levels cur
       where cur.id = any (coalesce(levels, '{}'))
         and cur.program_id = lesson.program_id
         and lesson.sort_order = (
           select min(nx.sort_order) from public.levels nx
            where nx.program_id = cur.program_id and nx.active and nx.sort_order > cur.sort_order
         )
    ))
  ) then
    reasons := array_append(reasons, 'That class is a different level.');
  end if;

  if exists (
    select 1 from public.enrolments e
     where e.child_id = cr.child_id and e.class_id = lesson.class_id and e.status = 'active'
  ) then
    reasons := array_append(reasons, 'Your child is already in that class.');
  end if;

  if exists (
    select 1 from public.class_occurrences o
      join public.enrolments e on e.class_id = o.class_id and e.child_id = cr.child_id and e.status = 'active'
     where o.id <> lesson.id and o.status <> 'cancelled'
       and o.starts_at < lesson.ends_at and o.ends_at > lesson.starts_at
       and not exists (select 1 from public.absences a where a.occurrence_id = o.id and a.child_id = cr.child_id)
    union all
    select 1 from public.makeup_bookings b
      join public.class_occurrences o on o.id = b.target_occurrence_id
     where b.child_id = cr.child_id and b.status = 'booked' and b.credit_id <> cr.id
       and o.starts_at < lesson.ends_at and o.ends_at > lesson.starts_at
  ) then
    reasons := array_append(reasons, 'Your child has another lesson at that time.');
  end if;

  if private.free_places(lesson.id) < 1 then
    reasons := array_append(reasons, 'That lesson is full.');
  end if;

  return reasons;
end;
$$;

revoke all on function private.makeup_reasons(uuid, uuid) from public;
grant execute on function private.makeup_reasons(uuid, uuid) to authenticated;

-- The same check for a signed-in caller, who must be able to act for the
-- credit's child.
create or replace function public.check_makeup(p_credit uuid, p_occurrence uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  child uuid;
begin
  select c.child_id into child from public.makeup_credits c where c.id = p_credit;
  if child is null or not private.can_act_for_child(child) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.makeup_reasons(p_credit, p_occurrence);
end;
$$;

create or replace function private.usable_credit(p_child uuid, p_occurrence uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cr record;
begin
  for cr in
    select c.id from public.makeup_credits c
     where c.child_id = p_child and c.status = 'available' and c.expires_at > now()
     order by c.expires_at, c.issued_at
  loop
    if cardinality(private.makeup_reasons(cr.id, p_occurrence)) = 0 then
      return cr.id;
    end if;
  end loop;
  return null;
end;
$$;

-- ------------------------------------------------------------------ making an offer

-- Creates an offer and tells the family, with a claim code only they get.
-- offered_by is null for an automatic offer.
create function private.create_offer(p_occurrence uuid, p_child uuid, p_offered_by uuid, p_expires timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  code text := private.new_claim_code();
  offer uuid;
begin
  select o.organisation_id into org from public.class_occurrences o where o.id = p_occurrence;
  -- An earlier offer that lapsed makes way for a new one.
  update public.vacancy_offers set status = 'expired', responded_at = now()
   where occurrence_id = p_occurrence and child_id = p_child and status = 'offered';

  insert into public.vacancy_offers (organisation_id, occurrence_id, child_id, code_hash, expires_at, offered_by)
  values (org, p_occurrence, p_child, private.claim_code_hash(code), p_expires, p_offered_by)
  returning id into offer;

  insert into public.notifications (recipient_user_id, organisation_id, type, payload_json)
  select fm.user_id, org, 'spot_offered',
         jsonb_build_object('offer_id', offer, 'occurrence_id', p_occurrence, 'child_id', p_child, 'code', code)
    from public.children ch
    join public.family_members fm on fm.family_id = ch.family_id
   where ch.id = p_child;
  return offer;
end;
$$;

revoke all on function private.create_offer(uuid, uuid, uuid, timestamptz) from public;

-- An owner's offer, as in M5.
create or replace function public.offer_spot(p_occurrence uuid, p_child uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson record;
begin
  select o.id, o.organisation_id, o.starts_at, o.status into lesson
    from public.class_occurrences o where o.id = p_occurrence;
  if lesson.id is null or not private.is_org_member(lesson.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children ch where ch.id = p_child and ch.organisation_id = lesson.organisation_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if lesson.status <> 'scheduled' or lesson.starts_at <= now() then
    raise exception 'That lesson has already started or been cancelled.' using hint = 'no_open_spot';
  end if;
  if private.open_spot_count(lesson.id) < 1 then
    raise exception 'That lesson has no open spots now.' using hint = 'no_open_spot';
  end if;
  if private.usable_credit(p_child, lesson.id) is null then
    raise exception 'That child can''t take this spot with their make-up credits.' using hint = 'makeup_refused';
  end if;
  if exists (
    select 1 from public.vacancy_offers v
     where v.occurrence_id = lesson.id and v.child_id = p_child and v.status = 'offered' and v.expires_at > now()
  ) then
    raise exception 'That family already has an offer for this lesson.' using hint = 'already_offered';
  end if;
  return private.create_offer(lesson.id, p_child, private.current_user_id(),
                              least(now() + interval '24 hours', lesson.starts_at));
end;
$$;

-- ------------------------------------------------------------------ the engine

-- Offers a lesson's open spots, one family per spot, to the best-fitting
-- families who haven't been offered it yet. Returns how many it offered.
create function private.auto_offer(p_occurrence uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson record;
  policy jsonb;
  need integer;
  made integer := 0;
  cand record;
begin
  select o.id, o.organisation_id, o.starts_at, o.status, c.active into lesson
    from public.class_occurrences o join public.classes c on c.id = o.class_id
   where o.id = p_occurrence;
  if lesson.id is null or lesson.status <> 'scheduled' or not lesson.active
     or lesson.starts_at <= now() + interval '45 minutes' then
    return 0;
  end if;
  policy := private.makeup_policy(lesson.organisation_id);
  if not (policy ->> 'makeups_enabled')::boolean or not (policy ->> 'auto_offer')::boolean
     or lesson.starts_at > now() + make_interval(days => (policy ->> 'booking_horizon_days')::integer) then
    return 0;
  end if;

  need := private.open_spot_count(lesson.id)
        - (select count(*) from public.vacancy_offers v
            where v.occurrence_id = lesson.id and v.status = 'offered' and v.expires_at > now())::integer;
  if need < 1 then
    return 0;
  end if;

  for cand in
    select fits.child_id
      from (
        select ch.id as child_id, private.usable_credit(ch.id, lesson.id) as credit_id
          from public.children ch
         where ch.organisation_id = lesson.organisation_id
           -- Someone who can answer.
           and exists (select 1 from public.family_members fm where fm.family_id = ch.family_id)
           and exists (
             select 1 from public.makeup_credits c
              where c.child_id = ch.id and c.status = 'available' and c.expires_at > now()
           )
           -- Not already offered this lesson, and didn't say no, claim it or
           -- let it run out.
           and not exists (
             select 1 from public.vacancy_offers v
              where v.occurrence_id = lesson.id and v.child_id = ch.id
                and v.status in ('offered', 'declined', 'expired', 'claimed')
           )
           -- No more open offers than credits to take them with.
           and (select count(*) from public.vacancy_offers v
                 where v.child_id = ch.id and v.status = 'offered' and v.expires_at > now())
             < (select count(*) from public.makeup_credits c
                 where c.child_id = ch.id and c.status = 'available' and c.expires_at > now())
      ) fits
      join public.makeup_credits cr on cr.id = fits.credit_id
      left join public.class_occurrences src on src.id = cr.source_occurrence_id
     order by cr.expires_at, src.starts_at nulls last, fits.child_id
     limit need
  loop
    perform private.create_offer(lesson.id, cand.child_id, null,
      least(now() + make_interval(mins => (policy ->> 'offer_hold_minutes')::integer),
            lesson.starts_at - interval '30 minutes'));
    made := made + 1;
  end loop;
  return made;
end;
$$;

revoke all on function private.auto_offer(uuid) from public;

-- An organisation's sweep: offers that ran out close (which moves each on
-- to the next family), then every open spot in the booking window without
-- an offer gets one.
create function private.auto_offer_org(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  policy jsonb := private.makeup_policy(p_org);
  lesson record;
begin
  update public.vacancy_offers set status = 'expired', responded_at = now()
   where organisation_id = p_org and status = 'offered' and expires_at <= now();
  if not (policy ->> 'makeups_enabled')::boolean or not (policy ->> 'auto_offer')::boolean then
    return;
  end if;
  for lesson in
    select o.id from public.class_occurrences o
     where o.organisation_id = p_org
       and o.status = 'scheduled'
       and o.starts_at > now() + interval '45 minutes'
       and o.starts_at <= now() + make_interval(days => (policy ->> 'booking_horizon_days')::integer)
       and private.open_spot_count(o.id) > 0
     order by o.starts_at
  loop
    perform private.auto_offer(lesson.id);
  end loop;
end;
$$;

revoke all on function private.auto_offer_org(uuid) from public;

create function private.advance_auto_offers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  for org in select id from public.organisations loop
    perform private.auto_offer_org(org);
  end loop;
end;
$$;

revoke all on function private.advance_auto_offers() from public;

-- A child's open offers they can no longer take (their credit was used or
-- taken back) close.
create function private.close_unusable_offers(p_child uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vacancy_offers set status = 'withdrawn', responded_at = now()
   where child_id = p_child and status = 'offered'
     and private.usable_credit(p_child, occurrence_id) is null
$$;

revoke all on function private.close_unusable_offers(uuid) from public;

-- ------------------------------------------------------------------ what sets it going

-- An absence opens a spot.
create function private.on_absence_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.auto_offer(new.occurrence_id);
  return null;
end;
$$;

create trigger absences_auto_offer after insert on public.absences
  for each row execute function private.on_absence_reported();

-- A credit that becomes usable can fill a spot; one that's used or taken
-- back closes its child's open offers.
create function private.on_credit_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'available' and (tg_op = 'INSERT' or old.status <> 'available') then
    perform private.auto_offer_org(new.organisation_id);
  elsif tg_op = 'UPDATE' and old.status = 'available' and new.status <> 'available' then
    perform private.close_unusable_offers(new.child_id);
  end if;
  return null;
end;
$$;

create trigger makeup_credits_auto_offer after insert or update of status on public.makeup_credits
  for each row execute function private.on_credit_changed();

-- A cancelled make-up gives its place back.
create function private.on_booking_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'booked' and new.status = 'cancelled' then
    perform private.auto_offer(new.target_occurrence_id);
  end if;
  return null;
end;
$$;

create trigger makeup_bookings_auto_offer after update of status on public.makeup_bookings
  for each row execute function private.on_booking_cancelled();

-- An offer answered (or run out) moves the spot on to the next family, and
-- frees that family to be offered another spot.
create function private.on_offer_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'offered' and new.status <> 'offered' then
    perform private.auto_offer_org(new.organisation_id);
  end if;
  return null;
end;
$$;

create trigger vacancy_offers_auto_offer after update of status on public.vacancy_offers
  for each row execute function private.on_offer_closed();

-- New rules (automatic offers turned on, say) apply straight away.
create function private.on_policy_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and new.policy_type = 'makeup' then
    perform private.auto_offer_org(new.organisation_id);
  end if;
  return null;
end;
$$;

create trigger policy_sets_auto_offer after insert on public.policy_sets
  for each row execute function private.on_policy_saved();

do $$
declare fn text;
begin
  foreach fn in array array[
    'private.on_absence_reported()', 'private.on_credit_changed()', 'private.on_booking_cancelled()',
    'private.on_offer_closed()', 'private.on_policy_saved()'
  ] loop
    execute format('revoke all on function %s from public', fn);
  end loop;
end $$;

-- ------------------------------------------------------------------ what the owner sees

-- As in M5, plus whether the latest offer was automatic and when it runs out.
drop function public.vacancy_candidates(uuid);
create function public.vacancy_candidates(p_occurrence uuid)
returns table (child_id uuid, first_name text, last_name text, family_name text,
               credit_expires_at timestamptz, missed_at timestamptz, offer_status text,
               offer_automatic boolean, offer_expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  lesson record;
begin
  select o.id, o.organisation_id into lesson from public.class_occurrences o where o.id = p_occurrence;
  if lesson.id is null or not private.is_org_member(lesson.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
    with fits as (
      select ch.id as child_id, private.usable_credit(ch.id, lesson.id) as credit_id
        from public.children ch
       where ch.organisation_id = lesson.organisation_id
         and exists (
           select 1 from public.makeup_credits c
            where c.child_id = ch.id and c.status = 'available' and c.expires_at > now()
         )
    )
    select ch.id, ch.first_name, ch.last_name, f.display_name, cr.expires_at, src.starts_at,
           case when latest.status = 'offered' and latest.expires_at <= now() then 'expired' else latest.status end,
           latest.id is not null and latest.offered_by is null,
           latest.expires_at
      from fits
      join public.children ch on ch.id = fits.child_id
      join public.families f on f.id = ch.family_id
      join public.makeup_credits cr on cr.id = fits.credit_id
      left join public.class_occurrences src on src.id = cr.source_occurrence_id
      left join lateral (
        select v.id, v.status, v.expires_at, v.offered_by from public.vacancy_offers v
         where v.occurrence_id = lesson.id and v.child_id = ch.id
         order by v.created_at desc limit 1
      ) latest on true
     where fits.credit_id is not null
     order by cr.expires_at, ch.first_name;
end;
$$;

revoke all on function public.vacancy_candidates(uuid) from public, anon;
grant execute on function public.vacancy_candidates(uuid) to authenticated;

-- ------------------------------------------------------------------ every five minutes

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('ovyko-advance-auto-offers', '*/5 * * * *', 'select private.advance_auto_offers()');
