-- Fill Empty Spots (docs/M5_FILL_SPOTS.md): offering a place an absence
-- freed to a family holding a make-up credit, claiming it once, the tally,
-- a preview before cancelling a day, and the instructor clash check.
--
-- Every write goes through a function below that checks who is calling.
-- Claiming books a make-up with the same locks and the same check_makeup as
-- M4, so the last place can't go twice.

-- ------------------------------------------------------------------ offers

create table public.vacancy_offers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  occurrence_id uuid not null,
  child_id uuid not null,
  -- The claim code's SHA-256, in hex. The code itself is never stored.
  code_hash text not null unique,
  status text not null default 'offered'
    check (status in ('offered', 'claimed', 'declined', 'expired', 'filled')),
  expires_at timestamptz not null,
  booking_id uuid references public.makeup_bookings (id) on delete set null,
  offered_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, occurrence_id) references public.class_occurrences (organisation_id, id) on delete cascade
);

-- One open offer per child per lesson.
create unique index vacancy_offers_one_open_idx on public.vacancy_offers (occurrence_id, child_id)
  where status = 'offered';
create index vacancy_offers_child_id_idx on public.vacancy_offers (child_id);

alter table public.vacancy_offers enable row level security;

revoke all on public.vacancy_offers from anon, authenticated;
grant select on public.vacancy_offers to authenticated;

-- Owners see their school's offers; parents see their own children's.
create policy vacancy_offers_select on public.vacancy_offers
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_child_ids())
  );

create trigger audit_vacancy_offers after insert or update or delete on public.vacancy_offers
  for each row execute function private.audit_change();

-- Families hear about offers in the app.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('skill_achieved', 'lesson_cancelled', 'spot_offered'));

-- ------------------------------------------------------------------ open spots

-- Places in a lesson an absence freed that no make-up has taken, and that
-- are really free.
create function private.open_spot_count(p_occurrence uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, least(
    (select count(*) from public.absences a
       join public.class_occurrences o on o.id = a.occurrence_id
       join public.enrolments e on e.child_id = a.child_id and e.class_id = o.class_id and e.status = 'active'
      where a.occurrence_id = p_occurrence)::integer
    - (select count(*) from public.makeup_bookings b
        where b.target_occurrence_id = p_occurrence and b.status = 'booked')::integer,
    private.free_places(p_occurrence)
  ))
$$;

revoke all on function private.open_spot_count(uuid) from public;
grant execute on function private.open_spot_count(uuid) to authenticated;

-- The organisation's lessons in the next p_days with open spots, for its
-- owners.
create function public.open_spots(p_org uuid, p_days integer default 7)
returns table (occurrence_id uuid, class_id uuid, starts_at timestamptz, spots integer,
               offers_open integer, offers_claimed integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select o.id, o.class_id, o.starts_at, private.open_spot_count(o.id),
           (select count(*) from public.vacancy_offers v
             where v.occurrence_id = o.id and v.status = 'offered' and v.expires_at > now())::integer,
           (select count(*) from public.vacancy_offers v
             where v.occurrence_id = o.id and v.status = 'claimed')::integer
      from public.class_occurrences o
      join public.classes c on c.id = o.class_id
     where o.organisation_id = p_org
       and o.status = 'scheduled'
       and c.active
       and o.starts_at > now()
       and o.starts_at <= now() + make_interval(days => least(greatest(p_days, 1), 60))
       and private.open_spot_count(o.id) > 0
     order by o.starts_at;
end;
$$;

revoke all on function public.open_spots(uuid, integer) from public, anon;
grant execute on function public.open_spots(uuid, integer) to authenticated;

-- A child's soonest-expiring credit that check_makeup allows for a lesson,
-- or null. The caller must be able to act for the child.
create function private.usable_credit(p_child uuid, p_occurrence uuid)
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
    if cardinality(public.check_makeup(cr.id, p_occurrence)) = 0 then
      return cr.id;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function private.usable_credit(uuid, uuid) from public;
grant execute on function private.usable_credit(uuid, uuid) to authenticated;

-- Children at the lesson's school who hold a credit check_makeup allows for
-- it: who to offer the spot to. Soonest-expiring credit first. For owners.
create function public.vacancy_candidates(p_occurrence uuid)
returns table (child_id uuid, first_name text, last_name text, family_name text,
               credit_expires_at timestamptz, missed_at timestamptz, offer_status text)
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
           (select case when v.status = 'offered' and v.expires_at <= now() then 'expired' else v.status end
              from public.vacancy_offers v
             where v.occurrence_id = lesson.id and v.child_id = ch.id
             order by v.created_at desc limit 1)
      from fits
      join public.children ch on ch.id = fits.child_id
      join public.families f on f.id = ch.family_id
      join public.makeup_credits cr on cr.id = fits.credit_id
      left join public.class_occurrences src on src.id = cr.source_occurrence_id
     where fits.credit_id is not null
     order by cr.expires_at, ch.first_name;
end;
$$;

revoke all on function public.vacancy_candidates(uuid) from public, anon;
grant execute on function public.vacancy_candidates(uuid) to authenticated;

-- A claim code: 256 random bits, as hex.
create function private.new_claim_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

create function private.claim_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
$$;

revoke all on function private.new_claim_code() from public;
revoke all on function private.claim_code_hash(text) from public;

-- Offers an open spot to a child's family. The family hears about it in the
-- app, with a claim link only they can use. For owners. Returns the offer.
create function public.offer_spot(p_occurrence uuid, p_child uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson record;
  code text := private.new_claim_code();
  offer uuid;
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
  -- An earlier offer that lapsed makes way for a new one.
  update public.vacancy_offers set status = 'expired'
   where occurrence_id = lesson.id and child_id = p_child and status = 'offered';

  insert into public.vacancy_offers (organisation_id, occurrence_id, child_id, code_hash, expires_at, offered_by)
  values (lesson.organisation_id, lesson.id, p_child, private.claim_code_hash(code),
          least(now() + interval '24 hours', lesson.starts_at), private.current_user_id())
  returning id into offer;

  -- The code travels only to the family: in their notification here, and in
  -- the email M6 sends.
  insert into public.notifications (recipient_user_id, organisation_id, type, payload_json)
  select fm.user_id, lesson.organisation_id, 'spot_offered',
         jsonb_build_object('offer_id', offer, 'occurrence_id', lesson.id, 'child_id', p_child, 'code', code)
    from public.children ch
    join public.family_members fm on fm.family_id = ch.family_id
   where ch.id = p_child;

  return offer;
end;
$$;

revoke all on function public.offer_spot(uuid, uuid) from public, anon;
grant execute on function public.offer_spot(uuid, uuid) to authenticated;

-- What a claim link offers, for the offer's own family only. Nothing when
-- the code is wrong or isn't theirs, so a code reveals nothing to anyone
-- else. Never who is away or why.
create function public.offer_details(p_code text)
returns table (offer_id uuid, status text, child_id uuid, child_first_name text,
               class_name text, level_name text, location_name text, timezone text,
               instructor_first_name text, starts_at timestamptz, ends_at timestamptz,
               expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
    select v.id,
           case when v.status = 'offered' and (v.expires_at <= now() or o.starts_at <= now())
                then 'expired' else v.status end,
           ch.id, ch.first_name, c.name, lv.name, loc.name, loc.timezone,
           nullif(split_part(u.name, ' ', 1), ''), o.starts_at, o.ends_at, v.expires_at
      from public.vacancy_offers v
      join public.children ch on ch.id = v.child_id
      join public.class_occurrences o on o.id = v.occurrence_id
      join public.classes c on c.id = o.class_id
      join public.levels lv on lv.id = c.level_id
      join public.locations loc on loc.id = c.location_id
      left join public.staff_memberships m on m.id = c.instructor_id
      left join public.users u on u.id = m.user_id
     where v.code_hash = private.claim_code_hash(p_code)
       and ch.family_id in (select private.my_family_ids());
end;
$$;

revoke all on function public.offer_details(text) from public, anon;
grant execute on function public.offer_details(text) to authenticated;

-- Claims an offered spot: books the make-up with the child's soonest-
-- expiring credit that fits, under the same locks as book_makeup. Works
-- once, only for the offer's family, only before it expires. Returns what
-- happened: 'claimed' (with the booking), 'taken', 'expired' or 'closed'.
create function public.claim_offer(p_code text)
returns table (outcome text, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  lesson record;
  credit uuid;
  booking uuid;
begin
  select vo.id, vo.organisation_id, vo.occurrence_id, vo.child_id, vo.status, vo.expires_at into v
    from public.vacancy_offers vo
    join public.children ch on ch.id = vo.child_id
   where vo.code_hash = private.claim_code_hash(p_code)
     and ch.family_id in (select private.my_family_ids())
     for update of vo;
  if v.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.status <> 'offered' then
    return query select 'closed'::text, null::uuid;
    return;
  end if;

  -- Lock the lesson, so two families can't take its last place at once.
  select o.id, o.starts_at, o.status into lesson
    from public.class_occurrences o where o.id = v.occurrence_id for update;
  if v.expires_at <= now() or lesson.starts_at <= now() or lesson.status <> 'scheduled' then
    update public.vacancy_offers set status = 'expired', responded_at = now() where id = v.id;
    return query select 'expired'::text, null::uuid;
    return;
  end if;
  if private.free_places(lesson.id) < 1 then
    update public.vacancy_offers set status = 'filled', responded_at = now() where id = v.id;
    return query select 'taken'::text, null::uuid;
    return;
  end if;

  credit := private.usable_credit(v.child_id, lesson.id);
  if credit is null then
    raise exception 'Your child can''t take this spot with their make-up credits.' using hint = 'makeup_refused';
  end if;
  perform 1 from public.makeup_credits where id = credit for update;

  insert into public.makeup_bookings (organisation_id, credit_id, child_id, target_occurrence_id, created_by)
  values (v.organisation_id, credit, v.child_id, lesson.id, private.current_user_id())
  returning id into booking;
  update public.makeup_credits set status = 'redeemed' where id = credit;
  update public.vacancy_offers
     set status = 'claimed', booking_id = booking, responded_at = now()
   where id = v.id;

  -- No spots left: the lesson's other offers close.
  if private.open_spot_count(lesson.id) < 1 or private.free_places(lesson.id) < 1 then
    update public.vacancy_offers set status = 'filled', responded_at = now()
     where occurrence_id = lesson.id and status = 'offered';
  end if;

  return query select 'claimed'::text, booking;
end;
$$;

revoke all on function public.claim_offer(text) from public, anon;
grant execute on function public.claim_offer(text) to authenticated;

-- "No thanks". Only the offer's family, only while it's open.
create function public.decline_offer(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select vo.id, vo.status into v
    from public.vacancy_offers vo
    join public.children ch on ch.id = vo.child_id
   where vo.code_hash = private.claim_code_hash(p_code)
     and ch.family_id in (select private.my_family_ids())
     for update of vo;
  if v.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v.status <> 'offered' then
    return false;
  end if;
  update public.vacancy_offers set status = 'declined', responded_at = now() where id = v.id;
  return true;
end;
$$;

revoke all on function public.decline_offer(text) from public, anon;
grant execute on function public.decline_offer(text) to authenticated;

-- ------------------------------------------------------------------ tally

-- What filling spots added up to over the last p_days: make-ups delivered
-- in lessons that have started, the families whose child didn't miss out,
-- and offers claimed. For the organisation's owners.
create function public.fill_tally(p_org uuid, p_days integer default 84)
returns table (makeups_delivered integer, families integer, offers_claimed integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    with delivered as (
      select b.child_id from public.makeup_bookings b
        join public.class_occurrences o on o.id = b.target_occurrence_id
       where b.organisation_id = p_org
         and b.status in ('booked', 'completed')
         and o.status <> 'cancelled'
         and o.starts_at <= now()
         and o.starts_at > now() - make_interval(days => p_days)
    )
    select (select count(*) from delivered)::integer,
           (select count(distinct ch.family_id) from delivered d
              join public.children ch on ch.id = d.child_id)::integer,
           (select count(*) from public.vacancy_offers v
             where v.organisation_id = p_org and v.status = 'claimed'
               and v.responded_at > now() - make_interval(days => p_days))::integer;
end;
$$;

revoke all on function public.fill_tally(uuid, integer) from public, anon;
grant execute on function public.fill_tally(uuid, integer) to authenticated;

-- ------------------------------------------------------------------ cancelling a day: preview

-- What cancel_lessons would do, changing nothing: lessons, children and
-- families affected, credits it would issue and make-ups it would cancel.
create function public.preview_cancel_lessons(p_location uuid, p_date date)
returns table (lessons integer, children integer, families integer, credits integer, makeups integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  loc record;
  policy jsonb;
begin
  select l.id, l.organisation_id, l.timezone into loc from public.locations l where l.id = p_location;
  if loc.id is null or not private.is_org_member(loc.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  policy := private.makeup_policy(loc.organisation_id);

  return query
    with day as (
      select o.id, o.class_id from public.class_occurrences o
        join public.classes c on c.id = o.class_id
       where c.location_id = loc.id
         and o.status = 'scheduled'
         and o.starts_at > now()
         and (o.starts_at at time zone loc.timezone)::date = p_date
    ),
    enrolled as (
      select day.id as occurrence_id, e.child_id from day
        join public.enrolments e on e.class_id = day.class_id and e.status = 'active'
    ),
    booked as (
      select b.target_occurrence_id as occurrence_id, b.child_id from public.makeup_bookings b
       where b.target_occurrence_id in (select id from day) and b.status = 'booked'
    ),
    affected as (
      select child_id from enrolled union select child_id from booked
    )
    select (select count(*) from day)::integer,
           (select count(*) from affected)::integer,
           (select count(distinct ch.family_id) from affected a
              join public.children ch on ch.id = a.child_id)::integer,
           case when (policy ->> 'makeups_enabled')::boolean then
             (select count(*) from enrolled en
               where not exists (
                 select 1 from public.makeup_credits cr
                  where cr.child_id = en.child_id and cr.source_occurrence_id = en.occurrence_id
                    and cr.status in ('available', 'redeemed')
               ))::integer
           else 0 end,
           (select count(*) from booked)::integer;
end;
$$;

revoke all on function public.preview_cancel_lessons(uuid, date) from public, anon;
grant execute on function public.preview_cancel_lessons(uuid, date) to authenticated;

-- Cancelling a lesson also closes the offers for it.
create function private.close_offers_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.vacancy_offers set status = 'expired', responded_at = now()
     where occurrence_id = new.id and status = 'offered';
  end if;
  return null;
end;
$$;

revoke all on function private.close_offers_on_cancel() from public;

create trigger class_occurrences_close_offers
  after update of status on public.class_occurrences
  for each row execute function private.close_offers_on_cancel();

-- ------------------------------------------------------------------ instructor clash

-- An instructor can't teach two classes at the same time on the same day,
-- at any location. Checked whenever a class is added or its instructor,
-- day, time, length or running state changes.
create function private.refuse_instructor_clash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other record;
  days text[] := array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
begin
  if not new.active or new.instructor_id is null then
    return new;
  end if;
  select c.name, c.start_time, loc.name as location, split_part(u.name, ' ', 1) as instructor into other
    from public.classes c
    join public.locations loc on loc.id = c.location_id
    join public.staff_memberships m on m.id = c.instructor_id
    left join public.users u on u.id = m.user_id
   where c.instructor_id = new.instructor_id
     and c.id <> new.id
     and c.active
     and c.weekday = new.weekday
     -- In minutes after midnight, so a late class can't wrap round.
     and extract(epoch from c.start_time) / 60 < extract(epoch from new.start_time) / 60 + new.duration_minutes
     and extract(epoch from new.start_time) / 60 < extract(epoch from c.start_time) / 60 + c.duration_minutes
   limit 1;
  if found then
    raise exception '% already teaches % at % on %s at %.',
      coalesce(nullif(other.instructor, ''), 'This instructor'), other.name,
      lower(to_char(other.start_time, 'FMHH12:MIAM')), days[new.weekday], other.location
      using hint = 'instructor_clash';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_instructor_clash() from public;

create trigger classes_instructor_clash
  before insert or update of instructor_id, weekday, start_time, duration_minutes, active
  on public.classes
  for each row execute function private.refuse_instructor_clash();
