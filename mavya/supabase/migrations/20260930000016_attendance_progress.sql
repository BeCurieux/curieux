-- Skills, attendance, progress and achievement notifications
-- (docs/M3_ATTENDANCE_PROGRESS.md).
--
--   Skills         owners write; staff read their organisation's; parents
--                  read the skills of their children's levels.
--   Attendance     written only through record_attendance.
--   Progress       written only through record_progress.
--   Notifications  created only by the progress trigger; each person reads
--                  and marks seen their own.

-- ------------------------------------------------------------------ tables

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  level_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 60),
  description text check (length(description) <= 200),
  sort_order integer not null default 0,
  active boolean not null default true,
  foreign key (organisation_id, level_id) references public.levels (organisation_id, id) on delete cascade,
  unique (organisation_id, id)
);

create index skills_level_id_idx on public.skills (level_id, sort_order);
-- A level can't have two active skills with the same name.
create unique index skills_level_name_active_idx on public.skills (level_id, lower(name)) where active;

alter table public.skills enable row level security;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  occurrence_id uuid not null,
  child_id uuid not null,
  status text not null check (status in ('present', 'absent', 'makeup')),
  recorded_by uuid references public.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  foreign key (organisation_id, occurrence_id) references public.class_occurrences (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  unique (occurrence_id, child_id)
);

create index attendance_child_id_idx on public.attendance (child_id);

alter table public.attendance enable row level security;

create table public.progress_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  child_id uuid not null,
  skill_id uuid not null,
  status text not null check (status in ('not_started', 'developing', 'achieved')),
  assessed_at timestamptz not null default now(),
  assessed_by uuid references public.users (id) on delete set null,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, skill_id) references public.skills (organisation_id, id) on delete cascade,
  unique (child_id, skill_id)
);

create index progress_records_skill_id_idx on public.progress_records (skill_id);

alter table public.progress_records enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  organisation_id uuid references public.organisations (id) on delete cascade,
  type text not null check (type in ('skill_achieved')),
  payload_json jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);

create index notifications_recipient_created_idx on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

-- ------------------------------------------------------------------ helpers

-- Children in the signed-in user's families.
create function private.my_child_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ch.id from public.children ch where ch.family_id in (select private.my_family_ids())
$$;

-- Levels of the classes the signed-in user's children are in.
create function private.my_family_level_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.level_id from public.classes c where c.id in (select private.my_family_class_ids())
$$;

revoke all on function private.my_child_ids() from public;
revoke all on function private.my_family_level_ids() from public;
grant execute on function private.my_child_ids() to authenticated;
grant execute on function private.my_family_level_ids() to authenticated;

-- ------------------------------------------------------------------ grants

revoke all on public.skills, public.attendance, public.progress_records, public.notifications
  from anon, authenticated;
grant select, insert, update on public.skills to authenticated;
grant select on public.attendance, public.progress_records, public.notifications to authenticated;

-- ------------------------------------------------------------------ policies

create policy skills_select on public.skills
  for select to authenticated
  using (private.is_org_member(organisation_id) or level_id in (select private.my_family_level_ids()));
create policy skills_insert on public.skills
  for insert to authenticated
  with check (private.is_org_member(organisation_id, array['owner']));
create policy skills_update on public.skills
  for update to authenticated
  using (private.is_org_member(organisation_id, array['owner']))
  with check (private.is_org_member(organisation_id, array['owner']));

create policy attendance_select on public.attendance
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or occurrence_id in (
      select o.id from public.class_occurrences o where o.class_id in (select private.my_taught_class_ids())
    )
    or child_id in (select private.my_child_ids())
  );

create policy progress_records_select on public.progress_records
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or child_id in (select private.my_taught_child_ids())
    or child_id in (select private.my_child_ids())
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_user_id = private.current_user_id());

-- ------------------------------------------------------------------ audit

create trigger audit_skills after insert or update or delete on public.skills
  for each row execute function private.audit_change();
create trigger audit_attendance after insert or update or delete on public.attendance
  for each row execute function private.audit_change();
create trigger audit_progress_records after insert or update or delete on public.progress_records
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ attendance

-- Marks one child here or away for one lesson. The caller must own the
-- organisation or teach the class; the child must be enrolled in it; the
-- lesson must start within the hour, or have started in the last 14 days.
create function public.record_attendance(p_occurrence_id uuid, p_child_id uuid, p_status text)
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

revoke all on function public.record_attendance(uuid, uuid, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------ progress

-- Sets one child's status for one skill. The caller must own the
-- organisation, or teach the child in a class at the skill's level.
create function public.record_progress(p_child_id uuid, p_skill_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  skill record;
begin
  if p_status not in ('not_started', 'developing', 'achieved') then
    raise exception 'Choose not yet, developing or achieved.' using errcode = '23514';
  end if;

  select s.id, s.organisation_id, s.level_id, s.active into skill from public.skills s where s.id = p_skill_id;
  if skill.id is null
     or not exists (select 1 from public.children ch where ch.id = p_child_id and ch.organisation_id = skill.organisation_id)
     or not (
       private.is_org_member(skill.organisation_id, array['owner'])
       or exists (
         select 1 from public.enrolments e
           join public.classes c on c.id = e.class_id
          where e.child_id = p_child_id
            and e.status in ('active', 'paused')
            and c.level_id = skill.level_id
            and c.id in (select private.my_taught_class_ids())
       )
     ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not skill.active then
    raise exception 'This skill has been removed.' using hint = 'skill_inactive';
  end if;

  insert into public.progress_records (organisation_id, child_id, skill_id, status, assessed_by)
  values (skill.organisation_id, p_child_id, skill.id, p_status, private.current_user_id())
  on conflict (child_id, skill_id) do update
    set status = excluded.status, assessed_by = excluded.assessed_by, assessed_at = now()
    where public.progress_records.status is distinct from excluded.status;
end;
$$;

revoke all on function public.record_progress(uuid, uuid, text) from public, anon;
grant execute on function public.record_progress(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------ notifications

-- When a skill becomes achieved, every parent in the child's family hears
-- about it. The payload holds ids only; names are looked up after sign-in.
create function private.notify_achievement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'achieved' or (tg_op = 'UPDATE' and old.status = 'achieved') then
    return null;
  end if;
  insert into public.notifications (recipient_user_id, organisation_id, type, payload_json)
  select fm.user_id, new.organisation_id, 'skill_achieved',
         jsonb_build_object('child_id', new.child_id, 'skill_id', new.skill_id)
    from public.children ch
    join public.family_members fm on fm.family_id = ch.family_id
   where ch.id = new.child_id;
  return null;
end;
$$;

revoke all on function private.notify_achievement() from public;

create trigger progress_records_notify
  after insert or update of status on public.progress_records
  for each row execute function private.notify_achievement();

-- Marks the signed-in user's notifications seen.
create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
   where recipient_user_id = private.current_user_id() and read_at is null
$$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;
