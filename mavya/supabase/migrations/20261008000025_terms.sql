-- Term re-enrolment (docs/M6_MIGRATION_PILOT.md, M6e): a school's terms,
-- lessons only inside them if the school chooses, and asking every family
-- whether they're staying next term (or moving up a class), applied on the
-- new term's first day.

-- ------------------------------------------------------------------ terms

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  -- Asking families about this term: when, by whom, and the reply-by date.
  reply_by date,
  asked_at timestamptz,
  asked_by uuid references public.users (id) on delete set null,
  -- When the answers took effect (the term's first day).
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (reply_by is null or reply_by < starts_on),
  unique (organisation_id, id)
);

create index terms_organisation_starts_idx on public.terms (organisation_id, starts_on);

alter table public.organisations
  add column lessons_in_term_only boolean not null default false;

-- ------------------------------------------------------------------ asks

-- One question per current enrolment: keep this place next term? With an
-- optional offer of a different class (moving up a level). No answer by the
-- term's start keeps the place.
create table public.reenrolment_asks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  term_id uuid not null,
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  child_id uuid not null,
  class_id uuid not null,
  offered_class_id uuid,
  answer text check (answer in ('stay', 'move', 'leave')),
  answered_by uuid references public.users (id) on delete set null,
  answered_at timestamptz,
  -- When it was first in an email to the family.
  emailed_at timestamptz,
  -- What happened on the term's first day.
  outcome text check (outcome in ('kept', 'moved', 'left', 'move_failed')),
  created_at timestamptz not null default now(),
  unique (term_id, enrolment_id),
  check (answer is distinct from 'move' or offered_class_id is not null),
  check (offered_class_id is distinct from class_id),
  foreign key (organisation_id, term_id) references public.terms (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, class_id) references public.classes (organisation_id, id) on delete cascade,
  foreign key (organisation_id, offered_class_id) references public.classes (organisation_id, id)
    on delete set null (offered_class_id)
);

create index reenrolment_asks_child_idx on public.reenrolment_asks (child_id);
create index reenrolment_asks_class_idx on public.reenrolment_asks (class_id);
create index reenrolment_asks_offered_idx on public.reenrolment_asks (offered_class_id)
  where offered_class_id is not null;

-- Read-only to people; every change goes through the functions below.
alter table public.terms enable row level security;
alter table public.reenrolment_asks enable row level security;
revoke all on public.terms, public.reenrolment_asks from anon, authenticated;
grant select on public.terms, public.reenrolment_asks to authenticated;

create policy terms_select on public.terms
  for select to authenticated
  using (private.is_org_member(organisation_id) or organisation_id in (select private.my_family_org_ids()));

create policy reenrolment_asks_select on public.reenrolment_asks
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_child_ids())
  );

create trigger audit_terms after insert or update or delete on public.terms
  for each row execute function private.audit_change();
create trigger audit_reenrolment_asks after insert or update or delete on public.reenrolment_asks
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ emails

alter table public.email_deliveries drop constraint email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check check (kind in (
    'spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder',
    'reenrolment_ask', 'reenrolment_reminder'));

-- ------------------------------------------------------------------ scheduling

-- Whether a school runs lessons on this (local) day: always, or only inside
-- one of its terms if it chose lessons in term only.
create function private.runs_on(p_org uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not o.lessons_in_term_only
         or exists (select 1 from public.terms t
                     where t.organisation_id = p_org and p_day between t.starts_on and t.ends_on)
    from public.organisations o
   where o.id = p_org
$$;

revoke all on function private.runs_on(uuid, date) from public;

-- As before (M1): schedules a class's lessons for the next `weeks` weeks,
-- in its location's timezone; lessons that already exist are left alone.
-- Now skips days the school doesn't run (lessons in term only).
create or replace function private.schedule_occurrences(p_class_id uuid, p_weeks integer default 12)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  day date;
  starts timestamptz;
  weeks integer := 0;
begin
  select cl.id, cl.organisation_id, cl.weekday, cl.start_time, cl.duration_minutes, cl.active, l.timezone
    into c
    from public.classes cl
    join public.locations l on l.id = cl.location_id
   where cl.id = p_class_id;
  if not found or not c.active then
    return;
  end if;

  day := (now() at time zone c.timezone)::date;
  day := day + ((c.weekday - extract(isodow from day)::integer + 7) % 7);

  while weeks < p_weeks loop
    starts := (day + c.start_time) at time zone c.timezone;
    if starts > now() then
      weeks := weeks + 1;
      if private.runs_on(c.organisation_id, day) then
        insert into public.class_occurrences (organisation_id, class_id, starts_at, ends_at)
        values (c.organisation_id, c.id, starts, starts + make_interval(mins => c.duration_minutes))
        on conflict (class_id, starts_at) do nothing;
      end if;
    end if;
    day := day + 7;
  end loop;
end;
$$;

-- Keeps every running class's lessons scheduled 12 weeks ahead. Daily.
create function private.top_up_schedules()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cl uuid;
begin
  for cl in select id from public.classes where active loop
    perform private.schedule_occurrences(cl);
  end loop;
end;
$$;

revoke all on function private.top_up_schedules() from public;

-- After a school's terms or its term-only choice change: removes upcoming
-- lessons on days it no longer runs, unless something already hangs on
-- them (an absence, a make-up, an offer, attendance), which the owner can
-- cancel by hand so families get their make-up credits; then fills in the
-- schedule.
create function private.replan_school(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cl uuid;
begin
  delete from public.class_occurrences o
   using public.classes c, public.locations l
   where o.class_id = c.id
     and l.id = c.location_id
     and o.organisation_id = p_org
     and o.status = 'scheduled'
     and o.starts_at > now()
     and not private.runs_on(p_org, (o.starts_at at time zone l.timezone)::date)
     and not exists (select 1 from public.absences a where a.occurrence_id = o.id)
     and not exists (select 1 from public.makeup_bookings b where b.target_occurrence_id = o.id)
     and not exists (select 1 from public.vacancy_offers v where v.occurrence_id = o.id)
     and not exists (select 1 from public.attendance at where at.occurrence_id = o.id);

  for cl in select id from public.classes where organisation_id = p_org and active loop
    perform private.schedule_occurrences(cl);
  end loop;
end;
$$;

revoke all on function private.replan_school(uuid) from public;

-- The school's local date today.
create function private.school_today(p_org uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(o.timezone, 'Australia/Sydney'))::date
    from public.organisations o where o.id = p_org
$$;

revoke all on function private.school_today(uuid) from public;

-- ------------------------------------------------------------------ owners: terms

-- Adds a term, or changes one (p_term). Terms can't overlap. Once families
-- have been asked about a term, only its name can change.
create function public.save_term(
  p_org uuid, p_name text, p_starts_on date, p_ends_on date, p_term uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms;
  term_id uuid := p_term;
begin
  if p_term is not null then
    select * into t from public.terms where id = p_term;
    if not found then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    p_org := t.organisation_id;
  end if;
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 60
     or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on
     or p_ends_on > p_starts_on + 366 then
    raise exception 'Give the term a name, a first day and a last day on or after it.'
      using hint = 'term_invalid';
  end if;

  -- One change at a time per school, so two terms can't be saved overlapping.
  perform 1 from public.organisations where id = p_org for update;

  if p_term is not null and t.asked_at is not null
     and (p_starts_on, p_ends_on) is distinct from (t.starts_on, t.ends_on) then
    raise exception 'Families have been asked about this term, so its dates can''t change.'
      using hint = 'term_locked';
  end if;
  if exists (select 1 from public.terms x
              where x.organisation_id = p_org and x.id is distinct from p_term
                and x.starts_on <= p_ends_on and x.ends_on >= p_starts_on) then
    raise exception 'That overlaps another term.' using hint = 'term_overlap';
  end if;

  if p_term is null then
    insert into public.terms (organisation_id, name, starts_on, ends_on)
    values (p_org, trim(p_name), p_starts_on, p_ends_on)
    returning id into term_id;
  else
    update public.terms set name = trim(p_name), starts_on = p_starts_on, ends_on = p_ends_on
     where id = p_term;
  end if;

  if (select lessons_in_term_only from public.organisations where id = p_org) then
    perform private.replan_school(p_org);
  end if;
  return term_id;
end;
$$;

revoke all on function public.save_term(uuid, text, date, date, uuid) from public, anon;
grant execute on function public.save_term(uuid, text, date, date, uuid) to authenticated;

-- Removes a term families haven't been asked about.
create function public.delete_term(p_term uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms;
begin
  select * into t from public.terms where id = p_term;
  if not found or not private.is_org_member(t.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if t.asked_at is not null then
    raise exception 'Families have been asked about this term, so it can''t be removed.'
      using hint = 'term_locked';
  end if;
  perform 1 from public.organisations where id = t.organisation_id for update;
  delete from public.terms where id = p_term;
  if (select lessons_in_term_only from public.organisations where id = t.organisation_id) then
    perform private.replan_school(t.organisation_id);
  end if;
end;
$$;

revoke all on function public.delete_term(uuid) from public, anon;
grant execute on function public.delete_term(uuid) to authenticated;

-- The school's choice: lessons all year, or only inside its terms. Turning
-- it on needs a term that hasn't ended.
create function public.set_lessons_in_term_only(p_org uuid, p_on boolean)
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
  select lessons_in_term_only into was from public.organisations where id = p_org for update;
  if was = p_on then
    return;
  end if;
  if p_on and not exists (select 1 from public.terms
                           where organisation_id = p_org and ends_on >= private.school_today(p_org)) then
    raise exception 'Add your terms first, so Ovyko knows when lessons run.' using hint = 'term_none';
  end if;
  update public.organisations set lessons_in_term_only = p_on where id = p_org;
  -- Organisations aren't audited row by row; this choice is.
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('lessons_in_term_only', was), jsonb_build_object('lessons_in_term_only', p_on));
  perform private.replan_school(p_org);
end;
$$;

revoke all on function public.set_lessons_in_term_only(uuid, boolean) from public, anon;
grant execute on function public.set_lessons_in_term_only(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------ places next term

-- How many places a class will have taken next term: the children in it
-- now, less those leaving or moving out, plus those offered a move into it
-- who haven't said no. Offers hold their place, so a class can't be
-- over-offered.
create function private.taken_next_term(p_term uuid, p_class uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer from public.enrolments e
           where e.class_id = p_class and e.status = 'active'
             and not exists (select 1 from public.reenrolment_asks a
                              where a.term_id = p_term and a.enrolment_id = e.id
                                and a.answer in ('leave', 'move')))
       + (select count(*)::integer from public.reenrolment_asks a
           where a.term_id = p_term and a.offered_class_id = p_class
             and (a.answer is null or a.answer = 'move'))
$$;

revoke all on function private.taken_next_term(uuid, uuid) from public;

-- For the owner: each class's answers so far and its places next term.
create function public.term_summary(p_term uuid)
returns table (
  class_id uuid, capacity integer, staying integer, moving_out integer, leaving integer,
  waiting integer, moving_in integer, free_next_term integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organisation_id into org from public.terms where id = p_term;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select c.id, c.capacity,
           (select count(*)::integer from public.reenrolment_asks a
             where a.term_id = p_term and a.class_id = c.id and a.answer = 'stay'),
           (select count(*)::integer from public.reenrolment_asks a
             where a.term_id = p_term and a.class_id = c.id and a.answer = 'move'),
           (select count(*)::integer from public.reenrolment_asks a
             where a.term_id = p_term and a.class_id = c.id and a.answer = 'leave'),
           (select count(*)::integer from public.reenrolment_asks a
             where a.term_id = p_term and a.class_id = c.id and a.answer is null),
           (select count(*)::integer from public.reenrolment_asks a
             where a.term_id = p_term and a.offered_class_id = c.id and (a.answer is null or a.answer = 'move')),
           greatest(c.capacity - private.taken_next_term(p_term, c.id), 0)
      from public.classes c
     where c.organisation_id = org and c.active
     order by c.weekday, c.start_time, c.name;
end;
$$;

revoke all on function public.term_summary(uuid) from public, anon;
grant execute on function public.term_summary(uuid) to authenticated;

-- ------------------------------------------------------------------ owners: asking

-- Makes sure every child in a class now has a question for the term (active
-- or paused places in running classes). Safe to run again: it only adds
-- the questions for places added since. Returns how many it added.
create function private.add_term_asks(p_term uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  with rows as (
    insert into public.reenrolment_asks (organisation_id, term_id, enrolment_id, child_id, class_id)
    select e.organisation_id, t.id, e.id, e.child_id, e.class_id
      from public.terms t
      join public.enrolments e on e.organisation_id = t.organisation_id
      join public.classes c on c.id = e.class_id and c.active
      join public.children ch on ch.id = e.child_id and ch.active
     where t.id = p_term and e.status in ('active', 'paused')
    on conflict (term_id, enrolment_id) do nothing
    returning 1
  )
  select count(*) into added from rows;
  return added;
end;
$$;

revoke all on function private.add_term_asks(uuid) from public;

-- Checks the term is the owner's and still open for asking and answers.
create function private.open_term(p_term uuid)
returns public.terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms;
begin
  select * into t from public.terms where id = p_term;
  if not found or not private.is_org_member(t.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if t.applied_at is not null or t.starts_on <= private.school_today(t.organisation_id) then
    raise exception 'This term has started, so its answers are final.' using hint = 'term_started';
  end if;
  return t;
end;
$$;

revoke all on function private.open_term(uuid) from public;

-- Gets the questions ready before asking, so the owner can offer moves up
-- first. Families don't see anything yet.
create function public.prepare_term_asks(p_term uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.open_term(p_term);
  return private.add_term_asks(p_term);
end;
$$;

revoke all on function public.prepare_term_asks(uuid) from public, anon;
grant execute on function public.prepare_term_asks(uuid) to authenticated;

-- Asks families: one email per parent for the questions they haven't been
-- emailed about yet, and the questions show in Ovyko. Asking again later
-- reaches children added since. Returns how many families were emailed.
create function public.ask_families(p_term uuid, p_reply_by date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms := private.open_term(p_term);
  emailed integer;
begin
  if p_reply_by is null or p_reply_by < private.school_today(t.organisation_id)
     or p_reply_by >= t.starts_on then
    raise exception 'Choose a reply-by date from today to the day before the term starts.'
      using hint = 'reply_by_invalid';
  end if;
  perform private.add_term_asks(p_term);
  update public.terms
     set reply_by = p_reply_by,
         asked_at = coalesce(asked_at, now()),
         asked_by = coalesce(asked_by, private.current_user_id())
   where id = p_term;

  with fresh as (
    update public.reenrolment_asks set emailed_at = now()
     where term_id = p_term and emailed_at is null
    returning child_id
  ),
  families as (
    select distinct ch.family_id from fresh join public.children ch on ch.id = fresh.child_id
  ),
  queued as (
    insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
    select 'reenrolment_ask', fm.user_id, t.organisation_id,
           jsonb_build_object('term_id', p_term),
           format('reenrol:%s:%s:%s', p_term, fm.user_id, now()::date)
      from families f
      join public.family_members fm on fm.family_id = f.family_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into emailed from families;
  return emailed;
end;
$$;

revoke all on function public.ask_families(uuid, date) from public, anon;
grant execute on function public.ask_families(uuid, date) to authenticated;

-- Emails the parents of families who haven't answered every question.
-- At most once a day per term. Returns how many families.
create function public.remind_term_families(p_term uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.terms := private.open_term(p_term);
  reminded integer;
begin
  if t.asked_at is null then
    raise exception 'Ask families first.' using hint = 'term_not_asked';
  end if;
  with families as (
    select distinct ch.family_id
      from public.reenrolment_asks a
      join public.children ch on ch.id = a.child_id
     where a.term_id = p_term and a.answer is null and a.emailed_at is not null
  ),
  queued as (
    insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
    select 'reenrolment_reminder', fm.user_id, t.organisation_id,
           jsonb_build_object('term_id', p_term),
           format('reenrol-remind:%s:%s:%s', p_term, fm.user_id, private.school_today(t.organisation_id))
      from families f
      join public.family_members fm on fm.family_id = f.family_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into reminded from families;
  return reminded;
end;
$$;

revoke all on function public.remind_term_families(uuid) from public, anon;
grant execute on function public.remind_term_families(uuid) to authenticated;

-- Offers a child a different class next term (p_class), or takes the
-- offer back (null). The class must have a place next term; the offer
-- holds it until the family says no or the term starts.
create function public.offer_term_move(p_ask uuid, p_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.reenrolment_asks;
  target public.classes;
begin
  select * into a from public.reenrolment_asks where id = p_ask;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform private.open_term(a.term_id);

  if p_class is null then
    update public.reenrolment_asks
       set offered_class_id = null,
           answer = case when answer = 'move' then null else answer end,
           answered_by = case when answer = 'move' then null else answered_by end,
           answered_at = case when answer = 'move' then null else answered_at end
     where id = p_ask;
    return;
  end if;

  -- One place change at a time per class, so two offers can't both take
  -- its last place.
  select * into target from public.classes where id = p_class for update;
  if not found or target.organisation_id <> a.organisation_id or not target.active
     or target.id = a.class_id
     or exists (select 1 from public.enrolments e
                 where e.child_id = a.child_id and e.class_id = p_class
                   and e.status in ('active', 'paused')) then
    raise exception 'Choose another of the school''s classes this child isn''t in.'
      using hint = 'move_invalid';
  end if;
  if a.offered_class_id is distinct from p_class
     and private.taken_next_term(a.term_id, p_class) >= target.capacity then
    raise exception 'That class has no place next term.' using hint = 'class_full';
  end if;

  update public.reenrolment_asks
     set offered_class_id = p_class,
         answer = case when answer = 'move' then null else answer end,
         answered_by = case when answer = 'move' then null else answered_by end,
         answered_at = case when answer = 'move' then null else answered_at end
   where id = p_ask and offered_class_id is distinct from p_class;
end;
$$;

revoke all on function public.offer_term_move(uuid, uuid) from public, anon;
grant execute on function public.offer_term_move(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ answering

-- A parent (or the owner, for a family who told them in person) answers:
-- stay, leave, or move to the class offered. Can be changed until the
-- term starts.
create function public.answer_term_ask(p_ask uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.reenrolment_asks;
  t public.terms;
begin
  select * into a from public.reenrolment_asks where id = p_ask;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into t from public.terms where id = a.term_id;
  if not private.is_org_member(a.organisation_id, array['owner'])
     and not (t.asked_at is not null and a.child_id in (select private.my_child_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if t.applied_at is not null or t.starts_on <= private.school_today(t.organisation_id) then
    raise exception 'This term has started, so its answers are final.' using hint = 'term_started';
  end if;
  if p_answer is null or p_answer not in ('stay', 'move', 'leave')
     or (p_answer = 'move' and a.offered_class_id is null) then
    raise exception 'Choose one of the answers shown.' using hint = 'answer_invalid';
  end if;
  update public.reenrolment_asks
     set answer = p_answer, answered_by = private.current_user_id(), answered_at = now()
   where id = p_ask and answer is distinct from p_answer;
end;
$$;

revoke all on function public.answer_term_ask(uuid, text) from public, anon;
grant execute on function public.answer_term_ask(uuid, text) to authenticated;

-- For the signed-in parent: their children's open questions, with the
-- classes' details.
create function public.my_term_asks()
returns table (
  id uuid, term_name text, starts_on date, reply_by date, school text,
  child_first_name text, class_name text, class_weekday integer, class_start time, class_location text,
  offered_class_name text, offered_weekday integer, offered_start time, offered_location text,
  answer text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, t.name, t.starts_on, t.reply_by, o.name,
         ch.first_name, c.name, c.weekday::integer, c.start_time, l.name,
         oc.name, oc.weekday::integer, oc.start_time, ol.name,
         a.answer
    from public.reenrolment_asks a
    join public.terms t on t.id = a.term_id
    join public.organisations o on o.id = a.organisation_id
    join public.children ch on ch.id = a.child_id
    join public.classes c on c.id = a.class_id
    join public.locations l on l.id = c.location_id
    left join public.classes oc on oc.id = a.offered_class_id
    left join public.locations ol on ol.id = oc.location_id
   where a.child_id in (select private.my_child_ids())
     and t.asked_at is not null
     and t.applied_at is null
     and t.starts_on > (now() at time zone o.timezone)::date
   order by t.starts_on, ch.first_name, c.weekday, c.start_time
$$;

revoke all on function public.my_term_asks() from public, anon;
grant execute on function public.my_term_asks() to authenticated;

-- ------------------------------------------------------------------ the new term

-- On a term's first day (the school's local date): leavers' places end the
-- day before; moves end the old place and start the new one; everyone else
-- keeps theirs. A move that no longer fits (the class was filled by hand
-- since) keeps the child's old place where it can. Hourly; each term once.
create function private.apply_terms(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  a record;
  last_day date;
  prior jsonb;
  applied integer := 0;
begin
  for t in
    select tm.*
      from public.terms tm
      join public.organisations o on o.id = tm.organisation_id
     where tm.asked_at is not null and tm.applied_at is null
       and tm.starts_on <= (p_now at time zone o.timezone)::date
     order by tm.starts_on
     for update of tm skip locked
  loop
    last_day := t.starts_on - 1;
    -- Movers' places as they are now (active or paused), to put back if
    -- their move can't happen.
    select coalesce(jsonb_object_agg(e.id, e.status), '{}') into prior
      from public.reenrolment_asks ra
      join public.enrolments e on e.id = ra.enrolment_id
     where ra.term_id = t.id and ra.answer = 'move' and e.status in ('active', 'paused');

    -- Leavers and movers' old places first, so the places they free can be
    -- taken by moves in.
    for a in
      select ra.* from public.reenrolment_asks ra
       where ra.term_id = t.id and ra.answer in ('leave', 'move')
    loop
      update public.enrolments
         set status = 'ended', ends_at = greatest(starts_at, last_day)
       where id = a.enrolment_id and status in ('active', 'paused');
      if a.answer = 'leave' then
        update public.reenrolment_asks set outcome = 'left' where id = a.id;
      end if;
    end loop;

    for a in
      select ra.* from public.reenrolment_asks ra
       where ra.term_id = t.id and ra.answer = 'move'
       order by ra.answered_at
    loop
      begin
        insert into public.enrolments (organisation_id, child_id, class_id, status, starts_at)
        values (a.organisation_id, a.child_id, a.offered_class_id, 'active', t.starts_on);
        update public.reenrolment_asks set outcome = 'moved' where id = a.id;
      exception when others then
        begin
          if prior ? a.enrolment_id::text then
            update public.enrolments set status = prior ->> a.enrolment_id::text, ends_at = null
             where id = a.enrolment_id;
          end if;
        exception when others then
          null;
        end;
        update public.reenrolment_asks set outcome = 'move_failed' where id = a.id;
      end;
    end loop;

    update public.reenrolment_asks set outcome = 'kept'
     where term_id = t.id and outcome is null;
    update public.terms set applied_at = p_now where id = t.id;
    applied := applied + 1;
  end loop;
  return applied;
end;
$$;

revoke all on function private.apply_terms(timestamptz) from public;

-- For the tests and support: the same job for a given moment. Server only.
create function public.apply_terms_at(p_now timestamptz)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.apply_terms(p_now)
$$;

revoke all on function public.apply_terms_at(timestamptz) from public, anon, authenticated;
grant execute on function public.apply_terms_at(timestamptz) to service_role;

select cron.schedule('ovyko-apply-terms', '5 * * * *', 'select private.apply_terms()');
select cron.schedule('ovyko-top-up-schedules', '20 16 * * *', 'select private.top_up_schedules()');
