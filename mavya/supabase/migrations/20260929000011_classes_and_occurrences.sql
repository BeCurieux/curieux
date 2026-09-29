-- Recurring classes and the real lessons they produce.
--
-- A class can only point at a location, program, level and instructor from
-- its own organisation, and its level must belong to its program. The
-- composite foreign keys below make the database enforce that.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  location_id uuid not null,
  program_id uuid not null,
  level_id uuid not null,
  instructor_id uuid,
  name text not null check (length(trim(name)) > 0),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  capacity integer not null check (capacity between 1 and 200),
  active boolean not null default true,
  unique (organisation_id, id),
  foreign key (organisation_id, location_id) references public.locations (organisation_id, id),
  foreign key (organisation_id, program_id) references public.programs (organisation_id, id),
  foreign key (organisation_id, level_id) references public.levels (organisation_id, id),
  foreign key (program_id, level_id) references public.levels (program_id, id),
  foreign key (organisation_id, instructor_id) references public.staff_memberships (organisation_id, id)
);

create index classes_organisation_id_idx on public.classes (organisation_id);
create index classes_instructor_id_idx on public.classes (instructor_id);
create index classes_location_id_idx on public.classes (location_id);
create index classes_level_id_idx on public.classes (level_id);

alter table public.classes enable row level security;

create table public.class_occurrences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  class_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity_override integer check (capacity_override between 0 and 200),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (class_id, starts_at),
  unique (organisation_id, id),
  foreign key (organisation_id, class_id) references public.classes (organisation_id, id) on delete cascade
);

create index class_occurrences_organisation_starts_idx on public.class_occurrences (organisation_id, starts_at);

alter table public.class_occurrences enable row level security;

-- Schedules the next `weeks` upcoming lessons of a class, in its location's
-- timezone, so 4:30pm stays 4:30pm across daylight saving. Lessons that
-- already exist are left alone.
create function private.schedule_occurrences(p_class_id uuid, p_weeks integer default 12)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  day date;
  starts timestamptz;
  scheduled integer := 0;
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

  while scheduled < p_weeks loop
    starts := (day + c.start_time) at time zone c.timezone;
    if starts > now() then
      insert into public.class_occurrences (organisation_id, class_id, starts_at, ends_at)
      values (c.organisation_id, c.id, starts, starts + make_interval(mins => c.duration_minutes))
      on conflict (class_id, starts_at) do nothing;
      scheduled := scheduled + 1;
    end if;
    day := day + 7;
  end loop;
end;
$$;

revoke all on function private.schedule_occurrences(uuid, integer) from public;

-- A new class gets its lessons straight away. When a class's schedule
-- changes, its future scheduled lessons are replaced; past, cancelled and
-- completed ones are kept.
create function private.reschedule_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.weekday, new.start_time, new.duration_minutes, new.active, new.location_id)
         is not distinct from (old.weekday, old.start_time, old.duration_minutes, old.active, old.location_id) then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    delete from public.class_occurrences
     where class_id = new.id and status = 'scheduled' and starts_at > now();
  end if;
  perform private.schedule_occurrences(new.id);
  return null;
end;
$$;

revoke all on function private.reschedule_class() from public;

create trigger classes_reschedule
  after insert or update on public.classes
  for each row execute function private.reschedule_class();
