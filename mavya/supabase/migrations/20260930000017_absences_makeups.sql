-- Absences, make-up credits and make-up bookings (docs/M4_MAKEUPS.md,
-- docs/RULES_ENGINE.md).
--
-- Every write goes through a function below that checks who is calling and
-- applies the organisation's make-up policy. check_makeup is the single
-- eligibility check: makeup_options lists only what it passes, and
-- book_makeup runs it again with the lesson locked.

-- ------------------------------------------------------------------ tables

create table public.policy_sets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  policy_type text not null check (policy_type in ('makeup')),
  config_json jsonb not null default '{}',
  version integer not null check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  unique (organisation_id, policy_type, version)
);

create unique index policy_sets_one_active_idx on public.policy_sets (organisation_id, policy_type) where active;

alter table public.policy_sets enable row level security;

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  child_id uuid not null,
  occurrence_id uuid not null,
  reported_at timestamptz not null default now(),
  reason text check (length(reason) <= 200),
  make_up_eligible boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, occurrence_id) references public.class_occurrences (organisation_id, id) on delete cascade,
  unique (occurrence_id, child_id),
  unique (organisation_id, id)
);

create index absences_child_id_idx on public.absences (child_id);

alter table public.absences enable row level security;

create table public.makeup_credits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  child_id uuid not null,
  source_occurrence_id uuid,
  source_absence_id uuid references public.absences (id) on delete set null,
  reason text not null check (reason in ('absence', 'lesson_cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired', 'revoked')),
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (source_occurrence_id) references public.class_occurrences (id) on delete set null,
  check (expires_at > issued_at),
  unique (organisation_id, id)
);

create index makeup_credits_child_id_idx on public.makeup_credits (child_id, status);

alter table public.makeup_credits enable row level security;

create table public.makeup_bookings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  credit_id uuid not null,
  child_id uuid not null,
  target_occurrence_id uuid not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  foreign key (organisation_id, credit_id) references public.makeup_credits (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, target_occurrence_id) references public.class_occurrences (organisation_id, id) on delete cascade
);

-- A credit is spent on at most one live booking.
create unique index makeup_bookings_one_per_credit_idx on public.makeup_bookings (credit_id) where status = 'booked';
create index makeup_bookings_target_idx on public.makeup_bookings (target_occurrence_id) where status = 'booked';
create index makeup_bookings_child_id_idx on public.makeup_bookings (child_id);

alter table public.makeup_bookings enable row level security;

-- A family's notifications now include cancelled lessons.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in ('skill_achieved', 'lesson_cancelled'));

-- ------------------------------------------------------------------ policy

-- RULES_ENGINE.md's defaults. A school's saved policy overrides any of them.
create function private.makeup_defaults()
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
    'waitlist_priority', 'existing_students_first'
  )
$$;

create function private.makeup_policy(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.makeup_defaults() || coalesce(
    (select p.config_json from public.policy_sets p
      where p.organisation_id = p_org and p.policy_type = 'makeup' and p.active),
    '{}'::jsonb)
$$;

-- Organisations the signed-in user is a parent at.
create function private.my_family_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.organisation_id from public.families f where f.id in (select private.my_family_ids())
$$;

-- Whether the signed-in user may act for this child: a parent in the child's
-- family, or an owner of the child's organisation.
create function private.can_act_for_child(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.children ch
     where ch.id = p_child
       and (ch.family_id in (select private.my_family_ids())
            or private.is_org_member(ch.organisation_id, array['owner']))
  )
$$;

-- ------------------------------------------------------------------ places

-- Free places in a lesson: its capacity, minus children enrolled, plus
-- enrolled children reported away, minus make-ups booked into it.
create function private.free_places(p_occurrence uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(o.capacity_override, c.capacity)
       - (select count(*) from public.enrolments e where e.class_id = c.id and e.status = 'active')::integer
       + (select count(*) from public.absences a
            join public.enrolments e on e.child_id = a.child_id and e.class_id = c.id and e.status = 'active'
           where a.occurrence_id = o.id)::integer
       - (select count(*) from public.makeup_bookings b
           where b.target_occurrence_id = o.id and b.status = 'booked')::integer
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
   where o.id = p_occurrence
$$;

-- The levels a child is at: those of the classes they're enrolled in.
create function private.child_level_ids(p_child uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.level_id from public.enrolments e join public.classes c on c.id = e.class_id
   where e.child_id = p_child and e.status = 'active'
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'private.makeup_policy(uuid)', 'private.my_family_org_ids()', 'private.can_act_for_child(uuid)',
    'private.free_places(uuid)', 'private.child_level_ids(uuid)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
revoke all on function private.makeup_defaults() from public;
grant execute on function private.makeup_defaults() to authenticated;

-- Instructors also teach the children booked into their lessons as make-ups,
-- recently or soon, so they can see their names and take attendance.
create or replace function private.my_taught_child_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.child_id
    from public.enrolments e
   where e.status in ('active', 'paused')
     and e.class_id in (select private.my_taught_class_ids())
  union
  select b.child_id
    from public.makeup_bookings b
    join public.class_occurrences o on o.id = b.target_occurrence_id
   where b.status in ('booked', 'completed')
     and o.starts_at > now() - interval '14 days'
     and o.class_id in (select private.my_taught_class_ids())
$$;

-- Families also see the classes their children are booked into as make-ups:
-- the class's name, time and place, never who else is in it.
create or replace function private.my_family_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.class_id
    from public.enrolments e
    join public.children ch on ch.id = e.child_id
    join public.family_members fm on fm.family_id = ch.family_id
   where fm.user_id = private.current_user_id()
     and e.status in ('active', 'paused')
  union
  select o.class_id
    from public.makeup_bookings b
    join public.class_occurrences o on o.id = b.target_occurrence_id
    join public.children ch on ch.id = b.child_id
    join public.family_members fm on fm.family_id = ch.family_id
   where fm.user_id = private.current_user_id()
     and b.status in ('booked', 'completed')
$$;

-- ------------------------------------------------------------------ grants and read access

revoke all on public.policy_sets, public.absences, public.makeup_credits, public.makeup_bookings
  from anon, authenticated;
grant select on public.policy_sets, public.absences, public.makeup_credits, public.makeup_bookings
  to authenticated;

create policy policy_sets_select on public.policy_sets
  for select to authenticated
  using (private.is_org_member(organisation_id) or organisation_id in (select private.my_family_org_ids()));

create policy absences_select on public.absences
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_child_ids())
    or occurrence_id in (
      select o.id from public.class_occurrences o where o.class_id in (select private.my_taught_class_ids())
    )
  );

create policy makeup_credits_select on public.makeup_credits
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_child_ids())
  );

create policy makeup_bookings_select on public.makeup_bookings
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_child_ids())
    or target_occurrence_id in (
      select o.id from public.class_occurrences o where o.class_id in (select private.my_taught_class_ids())
    )
  );

-- ------------------------------------------------------------------ audit

create trigger audit_policy_sets after insert or update or delete on public.policy_sets
  for each row execute function private.audit_change();
create trigger audit_absences after insert or update or delete on public.absences
  for each row execute function private.audit_change();
create trigger audit_makeup_credits after insert or update or delete on public.makeup_credits
  for each row execute function private.audit_change();
create trigger audit_makeup_bookings after insert or update or delete on public.makeup_bookings
  for each row execute function private.audit_change();

-- A booking removed with its lesson (a class's schedule changed) gives the
-- child their credit back.
create function private.return_credit_on_booking_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'booked' then
    update public.makeup_credits set status = 'available'
     where id = old.credit_id and status = 'redeemed';
  end if;
  return old;
end;
$$;

revoke all on function private.return_credit_on_booking_delete() from public;

create trigger makeup_bookings_return_credit
  before delete on public.makeup_bookings
  for each row execute function private.return_credit_on_booking_delete();

-- ------------------------------------------------------------------ policy editing

-- Saves a new version of the organisation's make-up policy. Only the known
-- settings are kept, each checked.
create function public.save_makeup_policy(p_org uuid, p_config jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb := '{}';
  next_version integer;
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_config ? 'makeups_enabled' then
    if jsonb_typeof(p_config -> 'makeups_enabled') <> 'boolean' then
      raise exception 'Choose whether make-ups are on.' using hint = 'invalid_policy';
    end if;
    cfg := cfg || jsonb_build_object('makeups_enabled', p_config -> 'makeups_enabled');
  end if;
  if p_config ? 'allow_future_level' then
    if jsonb_typeof(p_config -> 'allow_future_level') <> 'boolean' then
      raise exception 'Choose whether the next level is allowed.' using hint = 'invalid_policy';
    end if;
    cfg := cfg || jsonb_build_object('allow_future_level', p_config -> 'allow_future_level');
  end if;
  if p_config ? 'return_credit_on_valid_cancellation' then
    if jsonb_typeof(p_config -> 'return_credit_on_valid_cancellation') <> 'boolean' then
      raise exception 'Choose whether cancelled make-ups return the credit.' using hint = 'invalid_policy';
    end if;
    cfg := cfg || jsonb_build_object('return_credit_on_valid_cancellation', p_config -> 'return_credit_on_valid_cancellation');
  end if;

  -- Whole numbers within sensible bounds.
  declare
    key text;
    lo integer;
    hi integer;
    v integer;
  begin
    for key, lo, hi in
      select * from (values
        ('minimum_notice_minutes', 0, 10080),
        ('credit_validity_days', 1, 365),
        ('max_active_credits', 1, 20),
        ('booking_horizon_days', 1, 90),
        ('cancellation_notice_minutes', 0, 10080)
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
  end;

  select coalesce(max(version), 0) + 1 into next_version
    from public.policy_sets where organisation_id = p_org and policy_type = 'makeup';
  update public.policy_sets set active = false
   where organisation_id = p_org and policy_type = 'makeup' and active;
  insert into public.policy_sets (organisation_id, policy_type, config_json, version, active, created_by)
  values (p_org, 'makeup', cfg, next_version, true, private.current_user_id());
  return next_version;
end;
$$;

revoke all on function public.save_makeup_policy(uuid, jsonb) from public, anon;
grant execute on function public.save_makeup_policy(uuid, jsonb) to authenticated;

-- The organisation's make-up policy with defaults filled in, for its staff
-- and its families.
create function public.makeup_policy(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_org_member(p_org) or p_org in (select private.my_family_org_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.makeup_policy(p_org);
end;
$$;

revoke all on function public.makeup_policy(uuid) from public, anon;
grant execute on function public.makeup_policy(uuid) to authenticated;

-- ------------------------------------------------------------------ absences

-- Reports a child away from one lesson. Issues a make-up credit when the
-- policy allows; otherwise says why not. The absence is recorded either way.
create function public.report_absence(p_occurrence uuid, p_child uuid, p_reason text default null)
returns table (absence_id uuid, credit_id uuid, credit_expires_at timestamptz, no_credit_reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  lesson record;
  policy jsonb;
  new_absence uuid;
  new_credit uuid;
  expires timestamptz;
  why text;
  held integer;
begin
  if not private.can_act_for_child(p_child) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select o.id, o.organisation_id, o.class_id, o.starts_at, o.status into lesson
    from public.class_occurrences o where o.id = p_occurrence;
  if lesson.id is null
     or not exists (
       select 1 from public.enrolments e
        where e.class_id = lesson.class_id and e.child_id = p_child and e.status = 'active'
     ) then
    raise exception 'That lesson isn''t one of your child''s.' using hint = 'not_in_class';
  end if;
  if lesson.status = 'cancelled' then
    raise exception 'That lesson is already cancelled.' using hint = 'lesson_started';
  end if;
  if lesson.starts_at <= now() then
    raise exception 'That lesson has already started.' using hint = 'lesson_started';
  end if;
  if exists (select 1 from public.absences a where a.occurrence_id = lesson.id and a.child_id = p_child) then
    raise exception 'You''ve already told us about this one.' using hint = 'already_reported';
  end if;

  policy := private.makeup_policy(lesson.organisation_id);
  select count(*) into held from public.makeup_credits c
   where c.child_id = p_child and c.status = 'available' and c.expires_at > now();

  if not (policy ->> 'makeups_enabled')::boolean then
    why := 'Make-ups aren''t offered at the moment.';
  elsif lesson.starts_at - now() < make_interval(mins => (policy ->> 'minimum_notice_minutes')::integer) then
    why := format('Make-ups need at least %s notice.',
      private.plain_duration((policy ->> 'minimum_notice_minutes')::integer));
  elsif held >= (policy ->> 'max_active_credits')::integer then
    why := format('Your child already has %s make-up %s to use first.', held,
      case when held = 1 then 'credit' else 'credits' end);
  end if;

  insert into public.absences (organisation_id, child_id, occurrence_id, reason, make_up_eligible, created_by)
  values (lesson.organisation_id, p_child, lesson.id, nullif(trim(p_reason), ''), why is null, private.current_user_id())
  returning id into new_absence;

  if why is null then
    expires := now() + make_interval(days => (policy ->> 'credit_validity_days')::integer);
    insert into public.makeup_credits (organisation_id, child_id, source_occurrence_id, source_absence_id, reason, expires_at)
    values (lesson.organisation_id, p_child, lesson.id, new_absence, 'absence', expires)
    returning id into new_credit;
  end if;

  return query select new_absence, new_credit, expires, why;
end;
$$;

-- "2 hours", "30 minutes", "1 day" for messages.
create function private.plain_duration(p_minutes integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_minutes >= 1440 and p_minutes % 1440 = 0 then
      (p_minutes / 1440) || case when p_minutes = 1440 then ' day' else ' days' end
    when p_minutes >= 60 and p_minutes % 60 = 0 then
      (p_minutes / 60) || case when p_minutes = 60 then ' hour' else ' hours' end
    else p_minutes || case when p_minutes = 1 then ' minute' else ' minutes' end
  end
$$;

revoke all on function private.plain_duration(integer) from public;
grant execute on function private.plain_duration(integer) to authenticated;
revoke all on function public.report_absence(uuid, uuid, text) from public, anon;
grant execute on function public.report_absence(uuid, uuid, text) to authenticated;

-- Takes an absence back before the lesson: the child is coming after all.
-- Refused once its credit is booked, or once the place has gone to a make-up.
create function public.withdraw_absence(p_absence uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select ab.id, ab.child_id, ab.occurrence_id, o.starts_at into a
    from public.absences ab join public.class_occurrences o on o.id = ab.occurrence_id
   where ab.id = p_absence
     for update of ab;
  if a.id is null or not private.can_act_for_child(a.child_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if a.starts_at <= now() then
    raise exception 'That lesson has already started.' using hint = 'lesson_started';
  end if;
  -- Lock the lesson so a make-up can't take the place while we check.
  perform 1 from public.class_occurrences where id = a.occurrence_id for update;
  if exists (
    select 1 from public.makeup_credits c
     where c.source_absence_id = a.id and c.status = 'redeemed'
  ) then
    raise exception 'Cancel the make-up you booked with this credit first.' using hint = 'credit_in_use';
  end if;
  if private.free_places(a.occurrence_id) < 1 then
    raise exception 'Your child''s place in this lesson has gone to another family.' using hint = 'place_taken';
  end if;

  update public.makeup_credits set status = 'revoked'
   where source_absence_id = a.id and status = 'available';
  delete from public.absences where id = a.id;
end;
$$;

revoke all on function public.withdraw_absence(uuid) from public, anon;
grant execute on function public.withdraw_absence(uuid) to authenticated;

-- ------------------------------------------------------------------ eligibility

-- Why a credit can't be used for a lesson, in plain words. Empty when it can.
-- The one eligibility check (RULES_ENGINE.md).
create function public.check_makeup(p_credit uuid, p_occurrence uuid)
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
  if cr.id is null or not private.can_act_for_child(cr.child_id) then
    raise exception 'not allowed' using errcode = '42501';
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

  -- Another lesson of theirs at the same time: an enrolled class they aren't
  -- away from, or another make-up.
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

revoke all on function public.check_makeup(uuid, uuid) from public, anon;
grant execute on function public.check_makeup(uuid, uuid) to authenticated;

-- The lessons a credit can be used for, soonest first. What a parent may
-- see: the class, time, level, place, the instructor's first name and the
-- number of free places. Never who else is in the lesson.
create function public.makeup_options(p_credit uuid)
returns table (
  occurrence_id uuid,
  class_id uuid,
  class_name text,
  level_name text,
  location_name text,
  timezone text,
  instructor_first_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  free_places integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  cr record;
  policy jsonb;
begin
  select c.id, c.organisation_id, c.child_id, c.expires_at into cr
    from public.makeup_credits c where c.id = p_credit;
  if cr.id is null or not private.can_act_for_child(cr.child_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  policy := private.makeup_policy(cr.organisation_id);

  return query
    select o.id, c.id, c.name, lv.name, loc.name, loc.timezone,
           nullif(split_part(u.name, ' ', 1), ''), o.starts_at, o.ends_at,
           private.free_places(o.id)
      from public.class_occurrences o
      join public.classes c on c.id = o.class_id
      join public.levels lv on lv.id = c.level_id
      join public.locations loc on loc.id = c.location_id
      left join public.staff_memberships m on m.id = c.instructor_id
      left join public.users u on u.id = m.user_id
     where o.organisation_id = cr.organisation_id
       and o.status = 'scheduled'
       and c.active
       and o.starts_at > now()
       and o.starts_at <= least(
             now() + make_interval(days => (policy ->> 'booking_horizon_days')::integer),
             cr.expires_at)
       and cardinality(public.check_makeup(cr.id, o.id)) = 0
     order by o.starts_at;
end;
$$;

revoke all on function public.makeup_options(uuid) from public, anon;
grant execute on function public.makeup_options(uuid) to authenticated;

-- ------------------------------------------------------------------ booking

-- Books a credit into a lesson. The credit and the lesson are locked, and
-- eligibility is checked again, so the last place can't go twice.
create function public.book_makeup(p_credit uuid, p_occurrence uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cr record;
  reasons text[];
  booking uuid;
begin
  select c.id, c.organisation_id, c.child_id into cr
    from public.makeup_credits c where c.id = p_credit for update;
  if cr.id is null or not private.can_act_for_child(cr.child_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.class_occurrences where id = p_occurrence for update;

  reasons := public.check_makeup(p_credit, p_occurrence);
  if cardinality(reasons) > 0 then
    raise exception '%', reasons[1] using hint = 'makeup_refused';
  end if;

  insert into public.makeup_bookings (organisation_id, credit_id, child_id, target_occurrence_id, created_by)
  values (cr.organisation_id, cr.id, cr.child_id, p_occurrence, private.current_user_id())
  returning id into booking;
  update public.makeup_credits set status = 'redeemed' where id = cr.id;
  return booking;
end;
$$;

revoke all on function public.book_makeup(uuid, uuid) from public, anon;
grant execute on function public.book_makeup(uuid, uuid) to authenticated;

-- Cancels a make-up. With enough notice the credit comes back, if the school
-- allows it and it hasn't expired. Returns whether it came back.
create function public.cancel_makeup(p_booking uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  policy jsonb;
  returned boolean := false;
begin
  select bk.id, bk.organisation_id, bk.child_id, bk.credit_id, bk.status, o.starts_at, cr.expires_at into b
    from public.makeup_bookings bk
    join public.class_occurrences o on o.id = bk.target_occurrence_id
    join public.makeup_credits cr on cr.id = bk.credit_id
   where bk.id = p_booking
     for update of bk;
  if b.id is null or not private.can_act_for_child(b.child_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'booked' then
    raise exception 'This make-up isn''t booked.' using hint = 'lesson_started';
  end if;
  if b.starts_at <= now() then
    raise exception 'That lesson has already started.' using hint = 'lesson_started';
  end if;

  policy := private.makeup_policy(b.organisation_id);
  update public.makeup_bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
  if (policy ->> 'return_credit_on_valid_cancellation')::boolean
     and b.starts_at - now() >= make_interval(mins => (policy ->> 'cancellation_notice_minutes')::integer)
     and b.expires_at > now() then
    update public.makeup_credits set status = 'available' where id = b.credit_id;
    returned := true;
  end if;
  return returned;
end;
$$;

revoke all on function public.cancel_makeup(uuid) from public, anon;
grant execute on function public.cancel_makeup(uuid) to authenticated;

-- ------------------------------------------------------------------ cancelling a day

-- Cancels every lesson at a location on a date (in its timezone). Each
-- enrolled child gets a make-up credit; make-ups booked into those lessons
-- are cancelled and their credits returned; every affected family is told.
-- Returns the number of lessons cancelled.
create function public.cancel_lessons(p_location uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc record;
  policy jsonb;
  lesson record;
  cancelled integer := 0;
begin
  select l.id, l.organisation_id, l.timezone into loc from public.locations l where l.id = p_location;
  if loc.id is null or not private.is_org_member(loc.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  policy := private.makeup_policy(loc.organisation_id);

  for lesson in
    select o.id, o.class_id from public.class_occurrences o
      join public.classes c on c.id = o.class_id
     where c.location_id = loc.id
       and o.status = 'scheduled'
       and o.starts_at > now()
       and (o.starts_at at time zone loc.timezone)::date = p_date
       for update of o
  loop
    update public.class_occurrences set status = 'cancelled' where id = lesson.id;
    cancelled := cancelled + 1;

    -- Credits for the enrolled children who don't already have one for it.
    if (policy ->> 'makeups_enabled')::boolean then
      insert into public.makeup_credits (organisation_id, child_id, source_occurrence_id, reason, expires_at)
      select loc.organisation_id, e.child_id, lesson.id, 'lesson_cancelled',
             now() + make_interval(days => (policy ->> 'credit_validity_days')::integer)
        from public.enrolments e
       where e.class_id = lesson.class_id and e.status = 'active'
         and not exists (
           select 1 from public.makeup_credits cr
            where cr.child_id = e.child_id and cr.source_occurrence_id = lesson.id
              and cr.status in ('available', 'redeemed')
         );
    end if;

    -- Make-ups booked into it: cancelled, credits back.
    update public.makeup_credits set status = 'available'
     where id in (
       select b.credit_id from public.makeup_bookings b
        where b.target_occurrence_id = lesson.id and b.status = 'booked'
     );
    update public.makeup_bookings set status = 'cancelled', cancelled_at = now()
     where target_occurrence_id = lesson.id and status = 'booked';

    -- Tell each family once per child.
    insert into public.notifications (recipient_user_id, organisation_id, type, payload_json)
    select distinct fm.user_id, loc.organisation_id, 'lesson_cancelled',
           jsonb_build_object('occurrence_id', lesson.id, 'child_id', ch.id)
      from public.children ch
      join public.family_members fm on fm.family_id = ch.family_id
     where ch.id in (
       select e.child_id from public.enrolments e where e.class_id = lesson.class_id and e.status = 'active'
       union
       select b.child_id from public.makeup_bookings b
        where b.target_occurrence_id = lesson.id and b.cancelled_at = now()
     );
  end loop;

  return cancelled;
end;
$$;

revoke all on function public.cancel_lessons(uuid, date) from public, anon;
grant execute on function public.cancel_lessons(uuid, date) to authenticated;

-- ------------------------------------------------------------------ attendance

-- Make-up children can be marked in the lesson they're booked into.
create or replace function public.record_attendance(p_occurrence_id uuid, p_child_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson record;
begin
  if p_status not in ('present', 'absent') then
    raise exception 'Choose here or away.' using errcode = '23514';
  end if;

  select o.id, o.organisation_id, o.class_id, o.starts_at, o.status
    into lesson
    from public.class_occurrences o
   where o.id = p_occurrence_id;
  if lesson.id is null
     or not (
       private.is_org_member(lesson.organisation_id, array['owner'])
       or lesson.class_id in (select private.my_taught_class_ids())
     ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if lesson.status = 'cancelled'
     or lesson.starts_at > now() + interval '1 hour'
     or lesson.starts_at < now() - interval '14 days' then
    raise exception 'Attendance for this lesson isn''t open.' using hint = 'lesson_not_open';
  end if;

  if not exists (
    select 1 from public.enrolments e
     where e.class_id = lesson.class_id and e.child_id = p_child_id and e.status = 'active'
  ) and not exists (
    select 1 from public.makeup_bookings b
     where b.target_occurrence_id = lesson.id and b.child_id = p_child_id
       and b.status in ('booked', 'completed')
  ) then
    raise exception 'This child isn''t in this class.' using hint = 'not_in_class';
  end if;

  insert into public.attendance (organisation_id, occurrence_id, child_id, status, recorded_by)
  values (lesson.organisation_id, lesson.id, p_child_id, p_status, private.current_user_id())
  on conflict (occurrence_id, child_id) do update
    set status = excluded.status, recorded_by = excluded.recorded_by, recorded_at = now()
    where public.attendance.status is distinct from excluded.status;
end;
$$;
