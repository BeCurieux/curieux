-- Moving a school in (docs/M6_MIGRATION_PILOT.md, M6a): classes, families,
-- children and enrolments from the school's spreadsheets. The app reads the
-- CSV into rows; everything else happens here. One call checks (and, when
-- asked, saves) the lot in a single transaction.

-- ------------------------------------------------------------------ what an import added

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  file_names text[] not null default '{}',
  counts jsonb not null,
  problems jsonb not null default '[]',
  undone_at timestamptz,
  unique (organisation_id, id)
);

create index import_batches_organisation_id_idx on public.import_batches (organisation_id);

alter table public.import_batches enable row level security;

create policy import_batches_select on public.import_batches
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

revoke all on public.import_batches from anon, authenticated;
grant select on public.import_batches to authenticated;

alter table public.classes add column import_batch_id uuid references public.import_batches (id);
alter table public.families add column import_batch_id uuid references public.import_batches (id);
alter table public.children add column import_batch_id uuid references public.import_batches (id);
alter table public.enrolments add column import_batch_id uuid references public.import_batches (id);

create index classes_import_batch_id_idx on public.classes (import_batch_id) where import_batch_id is not null;
create index families_import_batch_id_idx on public.families (import_batch_id) where import_batch_id is not null;
create index children_import_batch_id_idx on public.children (import_batch_id) where import_batch_id is not null;
create index enrolments_import_batch_id_idx on public.enrolments (import_batch_id) where import_batch_id is not null;

-- Only import_school sets import_batch_id: owners can otherwise write these
-- tables directly, and undo deletes whatever carries the batch's id.
create function private.guard_import_batch_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.import_batch_id is not null)
     or (tg_op = 'UPDATE' and new.import_batch_id is distinct from old.import_batch_id) then
    if coalesce(current_setting('ovyko.importing', true), '') <> 'on' then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_import_batch_id() from public;

create trigger classes_guard_import before insert or update of import_batch_id on public.classes
  for each row execute function private.guard_import_batch_id();
create trigger families_guard_import before insert or update of import_batch_id on public.families
  for each row execute function private.guard_import_batch_id();
create trigger children_guard_import before insert or update of import_batch_id on public.children
  for each row execute function private.guard_import_batch_id();
create trigger enrolments_guard_import before insert or update of import_batch_id on public.enrolments
  for each row execute function private.guard_import_batch_id();

create trigger audit_import_batches after insert or update on public.import_batches
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ check and save

-- p_classes: [{row, name, level, program?, location, weekday, start_time,
--   duration_minutes, capacity, instructor_email?}]
-- p_students: [{row, first_name, last_name, date_of_birth, parent_name?,
--   parent_email?, parent_phone?, class?, class_weekday?, class_time?}]
-- Rows arrive already read and tidied by the app (dates as YYYY-MM-DD,
-- times as HH:MM, weekday 1–7); rows it couldn't read never arrive.
--
-- p_read_problems: rows the app couldn't read, kept with the import so its
-- page lists every row that didn't come across.
--
-- Returns what would be (or was) added, what was already here, every
-- problem row with its reason, and notes. Saves only when p_commit.
create function public.import_school(
  p_org uuid, p_classes jsonb, p_students jsonb, p_file_names text[], p_commit boolean,
  p_read_problems jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch uuid;
  r jsonb;
  issues jsonb := '[]';
  notes jsonb := '[]';
  loc uuid;
  lvl record;
  lvl_count integer;
  instr uuid;
  cls record;
  cls_count integer;
  fam uuid;
  fam_key text;
  kid uuid;
  new_id uuid;
  seen_families uuid[] := '{}';
  phone_digits text;
  weekday_names text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  added jsonb := jsonb_build_object('classes', 0, 'families', 0, 'children', 0, 'enrolments', 0);
  existing jsonb := jsonb_build_object('classes', 0, 'families', 0, 'children', 0, 'enrolments', 0);
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_classes) <> 'array' or jsonb_typeof(p_students) <> 'array'
     or jsonb_typeof(coalesce(p_read_problems, '[]')) <> 'array'
     or jsonb_array_length(p_classes) + jsonb_array_length(p_students) > 10000
     or jsonb_array_length(coalesce(p_read_problems, '[]')) > 10000 then
    raise exception 'Those files can''t be read.' using hint = 'import_invalid';
  end if;

  -- Only the fields a problem has, so nothing else is stored with it.
  select coalesce(jsonb_agg(jsonb_build_object('file', p ->> 'file', 'row', (p ->> 'row')::integer,
                                               'message', left(p ->> 'message', 300))), '[]')
    into issues
    from jsonb_array_elements(coalesce(p_read_problems, '[]')) p
   where p ->> 'file' in ('classes', 'students');

  if p_commit then
    perform set_config('ovyko.importing', 'on', true);
    insert into public.import_batches (organisation_id, created_by, file_names, counts)
    values (p_org, private.current_user_id(), coalesce(p_file_names, '{}'), '{}')
    returning id into batch;
  end if;

  -- Everything the school has, plus what this import adds, so later rows
  -- (and a check without saving) can find earlier ones.
  create temp table imp_classes (
    id uuid, name text, weekday smallint, start_time time, location_id uuid,
    capacity integer, taken integer, is_new boolean, row_no integer
  ) on commit drop;
  insert into pg_temp.imp_classes
  select c.id, c.name, c.weekday, c.start_time, c.location_id, c.capacity,
         (select count(*) from public.enrolments e where e.class_id = c.id and e.status = 'active')::integer,
         false, null
    from public.classes c where c.organisation_id = p_org and c.active;

  create temp table imp_families (id uuid, email text, phone text, is_new boolean) on commit drop;
  insert into pg_temp.imp_families
  select f.id, nullif(lower(trim(f.primary_contact_email)), ''),
         nullif(regexp_replace(coalesce(f.primary_contact_phone, ''), '\D', '', 'g'), ''), false
    from public.families f where f.organisation_id = p_org;

  create temp table imp_children (id uuid, family_id uuid, first_name text, date_of_birth date, is_new boolean) on commit drop;
  insert into pg_temp.imp_children
  select ch.id, ch.family_id, lower(trim(ch.first_name)), ch.date_of_birth, false
    from public.children ch where ch.organisation_id = p_org;

  -- ---------------------------------------------------------------- classes
  for r in select value from jsonb_array_elements(p_classes) order by (value ->> 'row')::integer loop
    if coalesce(trim(r ->> 'name'), '') = '' or (r ->> 'weekday') is null or (r ->> 'start_time') is null
       or coalesce((r ->> 'capacity')::integer, 0) not between 1 and 200
       or coalesce((r ->> 'duration_minutes')::integer, 0) not between 5 and 480 then
      issues := issues || jsonb_build_object('file', 'classes', 'row', r -> 'row',
        'message', 'This class needs a name, day, start time, a length of 5 to 480 minutes and 1 to 200 places.');
      continue;
    end if;
    select l.id into loc from public.locations l
     where l.organisation_id = p_org and l.active and lower(l.name) = lower(trim(r ->> 'location'))
     limit 1;
    if loc is null then
      issues := issues || jsonb_build_object('file', 'classes', 'row', r -> 'row',
        'message', format('The location "%s" isn''t set up yet. Add it in Settings → Locations.', r ->> 'location'));
      continue;
    end if;

    select count(*) into lvl_count
      from public.levels lv join public.programs p on p.id = lv.program_id
     where lv.organisation_id = p_org and lv.active and p.active
       and lower(lv.name) = lower(trim(r ->> 'level'))
       and (coalesce(r ->> 'program', '') = '' or lower(p.name) = lower(trim(r ->> 'program')));
    if lvl_count = 0 then
      issues := issues || jsonb_build_object('file', 'classes', 'row', r -> 'row',
        'message', format('The level "%s" isn''t set up yet. Add it in Settings → Levels.', r ->> 'level'));
      continue;
    elsif lvl_count > 1 then
      issues := issues || jsonb_build_object('file', 'classes', 'row', r -> 'row',
        'message', format('The level "%s" is in more than one program. Add a Program column.', r ->> 'level'));
      continue;
    end if;
    select lv.id, lv.program_id into lvl
      from public.levels lv join public.programs p on p.id = lv.program_id
     where lv.organisation_id = p_org and lv.active and p.active
       and lower(lv.name) = lower(trim(r ->> 'level'))
       and (coalesce(r ->> 'program', '') = '' or lower(p.name) = lower(trim(r ->> 'program')));

    select * into cls from pg_temp.imp_classes c
     where lower(c.name) = lower(trim(r ->> 'name')) and c.weekday = (r ->> 'weekday')::smallint
       and c.start_time = (r ->> 'start_time')::time and c.location_id = loc;
    if found then
      if cls.is_new then
        issues := issues || jsonb_build_object('file', 'classes', 'row', r -> 'row',
          'message', format('This is the same class as row %s.', cls.row_no));
      else
        existing := jsonb_set(existing, '{classes}', to_jsonb((existing ->> 'classes')::integer + 1));
      end if;
      continue;
    end if;

    instr := null;
    if coalesce(r ->> 'instructor_email', '') <> '' then
      select sm.id into instr
        from public.staff_memberships sm join public.users u on u.id = sm.user_id
       where sm.organisation_id = p_org and sm.status = 'active'
         and lower(u.email) = lower(trim(r ->> 'instructor_email'))
       limit 1;
      if instr is null then
        notes := notes || jsonb_build_object('file', 'classes', 'row', r -> 'row', 'note', true,
          'message', format('No staff member has the email %s, so this class has no instructor yet.', r ->> 'instructor_email'));
      end if;
    end if;

    if p_commit then
      insert into public.classes (organisation_id, location_id, program_id, level_id, instructor_id, name,
                                  weekday, start_time, duration_minutes, capacity, import_batch_id)
      values (p_org, loc, lvl.program_id, lvl.id, instr, trim(r ->> 'name'), (r ->> 'weekday')::smallint,
              (r ->> 'start_time')::time, (r ->> 'duration_minutes')::integer, (r ->> 'capacity')::integer, batch)
      returning id into new_id;
    else
      new_id := gen_random_uuid();
    end if;
    insert into pg_temp.imp_classes values (new_id, trim(r ->> 'name'), (r ->> 'weekday')::smallint, (r ->> 'start_time')::time,
                                    loc, (r ->> 'capacity')::integer, 0, true, (r ->> 'row')::integer);
    added := jsonb_set(added, '{classes}', to_jsonb((added ->> 'classes')::integer + 1));
  end loop;

  -- ---------------------------------------------------------------- students
  for r in select value from jsonb_array_elements(p_students) order by (value ->> 'row')::integer loop
    if coalesce(trim(r ->> 'first_name'), '') = '' or (r ->> 'date_of_birth') is null then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', 'Each child needs a first name and a date of birth.');
      continue;
    end if;
    fam_key := nullif(lower(trim(coalesce(r ->> 'parent_email', ''))), '');
    phone_digits := nullif(regexp_replace(coalesce(r ->> 'parent_phone', ''), '\D', '', 'g'), '');
    if fam_key is null and phone_digits is null then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', 'Add a parent email or phone, so we know which family this child belongs to.');
      continue;
    end if;
    if (r ->> 'date_of_birth')::date > current_date then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', 'The date of birth is in the future.');
      continue;
    end if;

    -- The family: by email, else phone.
    fam := null;
    if fam_key is not null then
      select f.id into fam from pg_temp.imp_families f where f.email = fam_key limit 1;
    end if;
    if fam is null and phone_digits is not null then
      select f.id into fam from pg_temp.imp_families f where f.phone = phone_digits limit 1;
    end if;
    if fam is null then
      if p_commit then
        insert into public.families (organisation_id, display_name, primary_contact_name,
                                     primary_contact_email, primary_contact_phone, import_batch_id)
        values (p_org, initcap(trim(r ->> 'last_name')) || ' Family', nullif(trim(r ->> 'parent_name'), ''),
                fam_key, nullif(trim(r ->> 'parent_phone'), ''), batch)
        returning id into fam;
      else
        fam := gen_random_uuid();
      end if;
      insert into pg_temp.imp_families values (fam, fam_key, phone_digits, true);
      added := jsonb_set(added, '{families}', to_jsonb((added ->> 'families')::integer + 1));
    elsif not (select f.is_new from pg_temp.imp_families f where f.id = fam limit 1)
          and not fam = any (seen_families) then
      seen_families := seen_families || fam;
      existing := jsonb_set(existing, '{families}', to_jsonb((existing ->> 'families')::integer + 1));
    end if;

    -- The child: by family, first name and date of birth.
    select c.id into kid from pg_temp.imp_children c
     where c.family_id = fam and c.first_name = lower(trim(r ->> 'first_name'))
       and c.date_of_birth = (r ->> 'date_of_birth')::date;
    if found then
      if (select c.is_new from pg_temp.imp_children c where c.id = kid) then
        issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
          'message', 'This child is already in the file on an earlier row.');
        continue;
      end if;
      existing := jsonb_set(existing, '{children}', to_jsonb((existing ->> 'children')::integer + 1));
    else
      if p_commit then
        insert into public.children (organisation_id, family_id, first_name, last_name, date_of_birth, import_batch_id)
        values (p_org, fam, trim(r ->> 'first_name'), trim(coalesce(r ->> 'last_name', '')),
                (r ->> 'date_of_birth')::date, batch)
        returning id into kid;
      else
        kid := gen_random_uuid();
      end if;
      insert into pg_temp.imp_children values (kid, fam, lower(trim(r ->> 'first_name')), (r ->> 'date_of_birth')::date, true);
      added := jsonb_set(added, '{children}', to_jsonb((added ->> 'children')::integer + 1));
    end if;

    -- Their class, if they have one.
    continue when coalesce(r ->> 'class', '') = '';
    select count(*) into cls_count from pg_temp.imp_classes c
     where lower(c.name) = lower(trim(r ->> 'class'))
       and (r ->> 'class_weekday' is null or c.weekday = (r ->> 'class_weekday')::smallint)
       and (r ->> 'class_time' is null or c.start_time = (r ->> 'class_time')::time);
    if cls_count = 0 then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', format('%s was added, but there''s no class called "%s"%s, so they aren''t in a class yet.',
          trim(r ->> 'first_name'), r ->> 'class',
          case when r ->> 'class_weekday' is not null
               then ' on ' || weekday_names[(r ->> 'class_weekday')::integer] || 's' else '' end));
      continue;
    elsif cls_count > 1 then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', format('%s was added, but there''s more than one class called "%s". Add Class day and Class time columns.',
          trim(r ->> 'first_name'), r ->> 'class'));
      continue;
    end if;
    select * into cls from pg_temp.imp_classes c
     where lower(c.name) = lower(trim(r ->> 'class'))
       and (r ->> 'class_weekday' is null or c.weekday = (r ->> 'class_weekday')::smallint)
       and (r ->> 'class_time' is null or c.start_time = (r ->> 'class_time')::time);

    if not cls.is_new and exists (
      select 1 from public.enrolments e
       where e.child_id = kid and e.class_id = cls.id and e.status in ('active', 'paused')
    ) then
      existing := jsonb_set(existing, '{enrolments}', to_jsonb((existing ->> 'enrolments')::integer + 1));
      continue;
    end if;
    if cls.taken >= cls.capacity then
      issues := issues || jsonb_build_object('file', 'students', 'row', r -> 'row',
        'message', format('%s was added, but %s on %ss is full (%s places), so they aren''t in it yet.',
          trim(r ->> 'first_name'), cls.name, weekday_names[cls.weekday], cls.capacity));
      continue;
    end if;
    if p_commit then
      insert into public.enrolments (organisation_id, child_id, class_id, import_batch_id)
      values (p_org, kid, cls.id, batch);
    end if;
    update pg_temp.imp_classes set taken = taken + 1 where id = cls.id;
    added := jsonb_set(added, '{enrolments}', to_jsonb((added ->> 'enrolments')::integer + 1));
  end loop;

  if p_commit then
    update public.import_batches
       set counts = jsonb_build_object('added', added, 'existing', existing,
                                       -- Every row in the files, including those the app couldn't read.
                                       'rows', jsonb_build_object(
                                         'classes', jsonb_array_length(p_classes)
                                           + (select count(*) from jsonb_array_elements(issues) i
                                               where i ->> 'file' = 'classes' and (i ->> 'row')::integer > 1
                                                 and not exists (select 1 from jsonb_array_elements(p_classes) c
                                                                  where c -> 'row' = i -> 'row'))::integer,
                                         'students', jsonb_array_length(p_students)
                                           + (select count(*) from jsonb_array_elements(issues) i
                                               where i ->> 'file' = 'students' and (i ->> 'row')::integer > 1
                                                 and not exists (select 1 from jsonb_array_elements(p_students) s
                                                                  where s -> 'row' = i -> 'row'))::integer)),
           problems = issues || notes
     where id = batch;
  end if;

  perform set_config('ovyko.importing', '', true);
  drop table pg_temp.imp_classes, pg_temp.imp_families, pg_temp.imp_children;
  return jsonb_build_object('batch_id', batch, 'added', added, 'existing', existing,
                            'problems', issues, 'notes', notes);
end;
$$;

revoke all on function public.import_school(uuid, jsonb, jsonb, text[], boolean, jsonb) from public, anon;
grant execute on function public.import_school(uuid, jsonb, jsonb, text[], boolean, jsonb) to authenticated;

-- ------------------------------------------------------------------ what it added, now

-- The import's numbers next to what Ovyko holds from it today.
create function public.import_summary(p_batch uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b record;
begin
  select * into b from public.import_batches where id = p_batch;
  if b.id is null or not private.is_org_member(b.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'in_ovyko', jsonb_build_object(
      'classes', (select count(*) from public.classes where import_batch_id = b.id),
      'families', (select count(*) from public.families where import_batch_id = b.id),
      'children', (select count(*) from public.children where import_batch_id = b.id),
      'enrolments', (select count(*) from public.enrolments where import_batch_id = b.id and status = 'active')
    ),
    'can_undo', b.undone_at is null and b.created_at > now() - interval '14 days'
                and not private.import_used(b.id)
  );
end;
$$;

revoke all on function public.import_summary(uuid) from public, anon;
grant execute on function public.import_summary(uuid) to authenticated;

-- ------------------------------------------------------------------ undo

-- Whether anything has happened to what an import added since.
create function private.import_used(p_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with kids as (select id from public.children where import_batch_id = p_batch),
       fams as (select id from public.families where import_batch_id = p_batch),
       lessons as (
         select o.id from public.class_occurrences o
           join public.classes c on c.id = o.class_id
          where c.import_batch_id = p_batch
       )
  select exists (select 1 from public.attendance a where a.child_id in (select id from kids) or a.occurrence_id in (select id from lessons))
      or exists (select 1 from public.absences a where a.child_id in (select id from kids) or a.occurrence_id in (select id from lessons))
      or exists (select 1 from public.progress_records p where p.child_id in (select id from kids))
      or exists (select 1 from public.makeup_credits m where m.child_id in (select id from kids))
      or exists (select 1 from public.makeup_bookings m where m.child_id in (select id from kids) or m.target_occurrence_id in (select id from lessons))
      or exists (select 1 from public.vacancy_offers v where v.child_id in (select id from kids) or v.occurrence_id in (select id from lessons))
      or exists (select 1 from public.family_members fm where fm.family_id in (select id from fams))
      or exists (select 1 from public.children ch where ch.family_id in (select id from fams) and ch.import_batch_id is distinct from p_batch)
      or exists (
        select 1 from public.enrolments e
         where e.import_batch_id is distinct from p_batch
           and (e.child_id in (select id from kids)
                or e.class_id in (select id from public.classes where import_batch_id = p_batch))
      )
      or exists (select 1 from public.enrolments e where e.import_batch_id = p_batch and e.status <> 'active')
$$;

revoke all on function private.import_used(uuid) from public;

create function public.undo_import(p_batch uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
begin
  select * into b from public.import_batches where id = p_batch for update;
  if b.id is null or not private.is_org_member(b.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.undone_at is not null then
    raise exception 'This import has already been undone.' using hint = 'import_locked';
  end if;
  if b.created_at <= now() - interval '14 days' then
    raise exception 'Imports can only be undone for 14 days.' using hint = 'import_locked';
  end if;
  if private.import_used(b.id) then
    raise exception 'This import can''t be undone: lessons, families or places it added have been used since.'
      using hint = 'import_locked';
  end if;

  delete from public.enrolments where import_batch_id = b.id;
  delete from public.children where import_batch_id = b.id;
  delete from public.families where import_batch_id = b.id;
  delete from public.classes where import_batch_id = b.id;
  update public.import_batches set undone_at = now() where id = b.id;
end;
$$;

revoke all on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;
