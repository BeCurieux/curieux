-- Moving in from another system (docs/M6_MIGRATION_PILOT.md, M6h): each
-- family's balance and each child's unused make-up credits come across with
-- the rest of the import, in the same all-or-nothing transaction, with the
-- same undo.

-- ------------------------------------------------------------------ what an import added

alter table public.ledger_entries add column import_batch_id uuid references public.import_batches (id);
alter table public.makeup_credits add column import_batch_id uuid references public.import_batches (id);

create index ledger_entries_import_batch_id_idx on public.ledger_entries (import_batch_id)
  where import_batch_id is not null;
create index makeup_credits_import_batch_id_idx on public.makeup_credits (import_batch_id)
  where import_batch_id is not null;

create trigger ledger_entries_guard_import before insert or update of import_batch_id on public.ledger_entries
  for each row execute function private.guard_import_batch_id();
create trigger makeup_credits_guard_import before insert or update of import_batch_id on public.makeup_credits
  for each row execute function private.guard_import_batch_id();

-- Brought-across credits have no lesson behind them.
alter table public.makeup_credits drop constraint makeup_credits_reason_check;
alter table public.makeup_credits add constraint makeup_credits_reason_check
  check (reason in ('absence', 'lesson_cancelled', 'imported'));

-- While importing, a new credit doesn't look for places one at a time:
-- families who've just come across haven't joined yet, and an offer would
-- also stop the import being undone. The next absence or cancellation
-- includes them, like any other credit.
create or replace function private.on_credit_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('ovyko.importing', true), '') = 'on' then
    return null;
  end if;
  if new.status = 'available' and (tg_op = 'INSERT' or old.status <> 'available') then
    perform private.auto_offer_org(new.organisation_id);
  elsif tg_op = 'UPDATE' and old.status = 'available' and new.status <> 'available' then
    perform private.close_unusable_offers(new.child_id);
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------------ check and save

drop function public.import_school(uuid, jsonb, jsonb, text[], boolean, jsonb);

-- As before (20261003000020_import.sql), plus:
-- p_balances: [{row, parent_email?, parent_phone?, balance_cents, due_on?}]
-- p_credits: [{row, parent_email?, parent_phone?, first_name, last_name?,
--   date_of_birth?, credits, expires_on?}]
-- Returns, as well, 'money': how many families owe and how much in all, and
-- how many are in credit and how much, so the owner can check the totals.
create function public.import_school(
  p_org uuid, p_classes jsonb, p_students jsonb, p_file_names text[], p_commit boolean,
  p_read_problems jsonb default '[]', p_balances jsonb default '[]', p_credits jsonb default '[]'
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
  added jsonb := jsonb_build_object('classes', 0, 'families', 0, 'children', 0, 'enrolments', 0,
                                    'balances', 0, 'credits', 0);
  existing jsonb := jsonb_build_object('classes', 0, 'families', 0, 'children', 0, 'enrolments', 0,
                                       'balances', 0, 'credits', 0);
  money jsonb := jsonb_build_object('owing_families', 0, 'owing_cents', 0, 'credit_families', 0, 'credit_cents', 0);
  amount bigint;
  due date;
  n integer;
  kid_count integer;
  expires timestamptz;
  today date := private.school_today(p_org);
  tz text;
  validity integer;
  earlier integer;
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  p_balances := coalesce(p_balances, '[]');
  p_credits := coalesce(p_credits, '[]');
  if jsonb_typeof(p_classes) <> 'array' or jsonb_typeof(p_students) <> 'array'
     or jsonb_typeof(p_balances) <> 'array' or jsonb_typeof(p_credits) <> 'array'
     or jsonb_typeof(coalesce(p_read_problems, '[]')) <> 'array'
     or jsonb_array_length(p_classes) + jsonb_array_length(p_students)
        + jsonb_array_length(p_balances) + jsonb_array_length(p_credits) > 20000
     or jsonb_array_length(coalesce(p_read_problems, '[]')) > 10000 then
    raise exception 'Those files can''t be read.' using hint = 'import_invalid';
  end if;

  -- Only the fields a problem has, so nothing else is stored with it.
  select coalesce(jsonb_agg(jsonb_build_object('file', p ->> 'file', 'row', (p ->> 'row')::integer,
                                               'message', left(p ->> 'message', 300))), '[]')
    into issues
    from jsonb_array_elements(coalesce(p_read_problems, '[]')) p
   where p ->> 'file' in ('classes', 'students', 'balances', 'credits');

  select coalesce(o.timezone, 'Australia/Sydney') into tz from public.organisations o where o.id = p_org;
  validity := (private.makeup_policy(p_org) ->> 'credit_validity_days')::integer;

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

  create temp table imp_children (
    id uuid, family_id uuid, first_name text, date_of_birth date, is_new boolean, last_name text
  ) on commit drop;
  insert into pg_temp.imp_children
  select ch.id, ch.family_id, lower(trim(ch.first_name)), ch.date_of_birth, false, lower(trim(ch.last_name))
    from public.children ch where ch.organisation_id = p_org;

  -- Families and children given a balance or credits by this import, and on
  -- which row, so a second row for the same one is a problem.
  create temp table imp_money (kind text, id uuid, row_no integer) on commit drop;

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
      insert into pg_temp.imp_children values (kid, fam, lower(trim(r ->> 'first_name')), (r ->> 'date_of_birth')::date, true,
                                               lower(trim(coalesce(r ->> 'last_name', ''))));
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

  -- ---------------------------------------------------------------- balances
  -- p_balances: [{row, parent_email?, parent_phone?, balance_cents, due_on?}]
  -- balance_cents: positive when the family owes, negative when in credit.
  for r in select value from jsonb_array_elements(p_balances) order by (value ->> 'row')::integer loop
    amount := (r ->> 'balance_cents')::bigint;
    if amount is null or abs(amount) > 100000000 then
      issues := issues || jsonb_build_object('file', 'balances', 'row', r -> 'row',
        'message', 'The balance should be an amount of money, like 120.50.');
      continue;
    end if;
    continue when amount = 0;
    fam_key := nullif(lower(trim(coalesce(r ->> 'parent_email', ''))), '');
    phone_digits := nullif(regexp_replace(coalesce(r ->> 'parent_phone', ''), '\D', '', 'g'), '');
    fam := null;
    if fam_key is not null then
      select f.id into fam from pg_temp.imp_families f where f.email = fam_key limit 1;
    end if;
    if fam is null and phone_digits is not null then
      select f.id into fam from pg_temp.imp_families f where f.phone = phone_digits limit 1;
    end if;
    if fam is null then
      issues := issues || jsonb_build_object('file', 'balances', 'row', r -> 'row',
        'message', case when fam_key is null and phone_digits is null
                        then 'Add the parent''s email or phone, so we know which family this balance belongs to.'
                        else 'No family with this email or phone is in Ovyko or the students file.' end);
      continue;
    end if;
    select m.row_no into earlier from pg_temp.imp_money m where m.kind = 'balance' and m.id = fam;
    if found then
      issues := issues || jsonb_build_object('file', 'balances', 'row', r -> 'row',
        'message', format('This family already has a balance on row %s. Put each family''s balance on one row.', earlier));
      continue;
    end if;
    insert into pg_temp.imp_money values ('balance', fam, (r ->> 'row')::integer);
    if exists (
      select 1 from public.ledger_entries l join public.import_batches b on b.id = l.import_batch_id
       where l.family_id = fam and b.undone_at is null
    ) then
      existing := jsonb_set(existing, '{balances}', to_jsonb((existing ->> 'balances')::integer + 1));
      continue;
    end if;
    due := case when amount > 0 then (r ->> 'due_on')::date end;
    if p_commit then
      insert into public.ledger_entries
        (organisation_id, family_id, kind, amount_cents, description, created_by, due_on, import_batch_id)
      values
        (p_org, fam, case when amount > 0 then 'charge' else 'credit' end, amount,
         case when amount > 0 then 'Balance brought across' else 'Credit brought across' end,
         private.current_user_id(), due, batch);
    end if;
    added := jsonb_set(added, '{balances}', to_jsonb((added ->> 'balances')::integer + 1));
    if amount > 0 then
      money := money || jsonb_build_object('owing_families', (money ->> 'owing_families')::integer + 1,
                                           'owing_cents', (money ->> 'owing_cents')::bigint + amount);
    else
      money := money || jsonb_build_object('credit_families', (money ->> 'credit_families')::integer + 1,
                                           'credit_cents', (money ->> 'credit_cents')::bigint - amount);
    end if;
  end loop;

  -- ---------------------------------------------------------------- make-up credits
  -- p_credits: [{row, parent_email?, parent_phone?, first_name, last_name?,
  --   date_of_birth?, credits, expires_on?}]
  for r in select value from jsonb_array_elements(p_credits) order by (value ->> 'row')::integer loop
    n := (r ->> 'credits')::integer;
    if coalesce(trim(r ->> 'first_name'), '') = '' or n is null or n < 0 or n > 50 then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', 'Each row needs the child''s first name and a number of credits from 0 to 50.');
      continue;
    end if;
    continue when n = 0;
    fam_key := nullif(lower(trim(coalesce(r ->> 'parent_email', ''))), '');
    phone_digits := nullif(regexp_replace(coalesce(r ->> 'parent_phone', ''), '\D', '', 'g'), '');
    fam := null;
    if fam_key is not null then
      select f.id into fam from pg_temp.imp_families f where f.email = fam_key limit 1;
    end if;
    if fam is null and phone_digits is not null then
      select f.id into fam from pg_temp.imp_families f where f.phone = phone_digits limit 1;
    end if;
    if fam is null and (fam_key is not null or phone_digits is not null) then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', 'No family with this email or phone is in Ovyko or the students file.');
      continue;
    end if;
    if fam is null and coalesce(trim(r ->> 'last_name'), '') = '' then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', 'Add the child''s last name, or the parent''s email or phone, so we can find them.');
      continue;
    end if;

    select count(*), min(c.id::text)::uuid into kid_count, kid from pg_temp.imp_children c
     where c.first_name = lower(trim(r ->> 'first_name'))
       and (fam is not null and c.family_id = fam
            or fam is null and c.last_name = lower(trim(r ->> 'last_name')))
       and ((r ->> 'date_of_birth') is null or c.date_of_birth = (r ->> 'date_of_birth')::date);
    if kid_count = 0 then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', format('There''s no child called %s in Ovyko or the students file.',
          trim(trim(r ->> 'first_name') || ' ' || coalesce(trim(r ->> 'last_name'), ''))));
      continue;
    elsif kid_count > 1 then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', format('More than one child is called %s. Add a Date of birth column.', trim(r ->> 'first_name')));
      continue;
    end if;

    if (r ->> 'expires_on') is not null then
      if (r ->> 'expires_on')::date < today then
        issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
          'message', format('These credits expired on %s, so they don''t come across.',
            to_char((r ->> 'expires_on')::date, 'FMDD/FMMM/YYYY')));
        continue;
      end if;
      -- The end of that day, at the school.
      expires := (((r ->> 'expires_on')::date + 1)::timestamp) at time zone tz;
    else
      expires := now() + make_interval(days => validity);
    end if;

    select m.row_no into earlier from pg_temp.imp_money m where m.kind = 'credits' and m.id = kid;
    if found then
      issues := issues || jsonb_build_object('file', 'credits', 'row', r -> 'row',
        'message', format('This child already has credits on row %s. Put each child''s credits on one row.', earlier));
      continue;
    end if;
    insert into pg_temp.imp_money values ('credits', kid, (r ->> 'row')::integer);
    if exists (
      select 1 from public.makeup_credits m join public.import_batches b on b.id = m.import_batch_id
       where m.child_id = kid and b.undone_at is null
    ) then
      existing := jsonb_set(existing, '{credits}', to_jsonb((existing ->> 'credits')::integer + n));
      continue;
    end if;
    if p_commit then
      insert into public.makeup_credits (organisation_id, child_id, reason, expires_at, import_batch_id)
      select p_org, kid, 'imported', expires, batch from generate_series(1, n);
    end if;
    added := jsonb_set(added, '{credits}', to_jsonb((added ->> 'credits')::integer + n));
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
                                                                  where s -> 'row' = i -> 'row'))::integer,
                                         'balances', jsonb_array_length(p_balances)
                                           + (select count(*) from jsonb_array_elements(issues) i
                                               where i ->> 'file' = 'balances' and (i ->> 'row')::integer > 1
                                                 and not exists (select 1 from jsonb_array_elements(p_balances) s
                                                                  where s -> 'row' = i -> 'row'))::integer,
                                         'credits', jsonb_array_length(p_credits)
                                           + (select count(*) from jsonb_array_elements(issues) i
                                               where i ->> 'file' = 'credits' and (i ->> 'row')::integer > 1
                                                 and not exists (select 1 from jsonb_array_elements(p_credits) s
                                                                  where s -> 'row' = i -> 'row'))::integer),
                                       'money', money),
           problems = issues || notes
     where id = batch;
  end if;

  perform set_config('ovyko.importing', '', true);
  drop table pg_temp.imp_classes, pg_temp.imp_families, pg_temp.imp_children, pg_temp.imp_money;
  return jsonb_build_object('batch_id', batch, 'added', added, 'existing', existing,
                            'problems', issues, 'notes', notes, 'money', money);
end;
$$;

revoke all on function public.import_school(uuid, jsonb, jsonb, text[], boolean, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_school(uuid, jsonb, jsonb, text[], boolean, jsonb, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------------ what it added, now

create or replace function public.import_summary(p_batch uuid)
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
      'enrolments', (select count(*) from public.enrolments where import_batch_id = b.id and status = 'active'),
      'balances', (select count(*) from public.ledger_entries where import_batch_id = b.id),
      'credits', (select count(*) from public.makeup_credits where import_batch_id = b.id)
    ),
    'can_undo', b.undone_at is null and b.created_at > now() - interval '14 days'
                and not private.import_used(b.id)
  );
end;
$$;

-- ------------------------------------------------------------------ undo

-- Whether anything has happened to what an import added since: as before,
-- plus a family given a balance has been charged, paid or credited since
-- (or has a payment under way), or a credit it added has been used,
-- cancelled, or its child offered a place.
create or replace function private.import_used(p_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with b as (select created_at from public.import_batches where id = p_batch),
       kids as (select id from public.children where import_batch_id = p_batch),
       fams as (select id from public.families where import_batch_id = p_batch),
       lessons as (
         select o.id from public.class_occurrences o
           join public.classes c on c.id = o.class_id
          where c.import_batch_id = p_batch
       ),
       money_fams as (
         select family_id as id from public.ledger_entries where import_batch_id = p_batch
         union select id from fams
       ),
       credit_kids as (select distinct child_id as id from public.makeup_credits where import_batch_id = p_batch)
  select exists (select 1 from public.attendance a where a.child_id in (select id from kids) or a.occurrence_id in (select id from lessons))
      or exists (select 1 from public.absences a where a.child_id in (select id from kids) or a.occurrence_id in (select id from lessons))
      or exists (select 1 from public.progress_records p where p.child_id in (select id from kids))
      or exists (select 1 from public.makeup_credits m
                  where (m.child_id in (select id from kids) and m.import_batch_id is distinct from p_batch)
                     or (m.import_batch_id = p_batch and m.status <> 'available'))
      or exists (select 1 from public.makeup_bookings m where m.child_id in (select id from kids) or m.target_occurrence_id in (select id from lessons))
      or exists (select 1 from public.vacancy_offers v where v.child_id in (select id from kids) or v.occurrence_id in (select id from lessons))
      or exists (select 1 from public.vacancy_offers v, b
                  where v.child_id in (select id from credit_kids) and v.created_at > b.created_at)
      or exists (select 1 from public.ledger_entries l, b
                  where l.family_id in (select id from money_fams)
                    and l.import_batch_id is distinct from p_batch
                    and (l.family_id in (select id from fams) or l.created_at > b.created_at))
      or exists (select 1 from public.online_payments op, b
                  where op.family_id in (select id from money_fams) and op.created_at > b.created_at)
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

create or replace function public.undo_import(p_batch uuid)
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
    raise exception 'This import can''t be undone: lessons, families, places, balances or credits it added have been used since.'
      using hint = 'import_locked';
  end if;

  delete from public.ledger_entries where import_batch_id = b.id;
  delete from public.makeup_credits where import_batch_id = b.id;
  delete from public.enrolments where import_batch_id = b.id;
  delete from public.children where import_batch_id = b.id;
  delete from public.families where import_batch_id = b.id;
  delete from public.classes where import_batch_id = b.id;
  update public.import_batches set undone_at = now() where id = b.id;
end;
$$;
