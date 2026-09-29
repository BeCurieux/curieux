-- A child's ongoing place in a class.
--
-- The composite keys make the child and the class belong to the same
-- organisation. A child has at most one current (active or paused)
-- enrolment per class, and active enrolments never exceed capacity.

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  child_id uuid not null,
  class_id uuid not null,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  starts_at date not null default current_date,
  ends_at date,
  check (ends_at is null or ends_at >= starts_at),
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, class_id) references public.classes (organisation_id, id) on delete cascade
);

create unique index enrolments_one_current_per_child_class
  on public.enrolments (child_id, class_id)
  where status in ('active', 'paused');
create index enrolments_class_id_idx on public.enrolments (class_id);
create index enrolments_organisation_id_idx on public.enrolments (organisation_id);

alter table public.enrolments enable row level security;

-- Refuses an active enrolment in a full or inactive class. Locking the class
-- row first means two enrolments racing for the last place are taken one
-- after the other, and the second sees the first.
create function private.enforce_class_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_capacity integer;
  class_active boolean;
  taken integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.class_id = new.class_id then
    return new;
  end if;

  select capacity, active into class_capacity, class_active
    from public.classes where id = new.class_id for update;

  if not class_active then
    raise exception 'This class is no longer running.' using hint = 'class_inactive';
  end if;

  select count(*) into taken
    from public.enrolments
   where class_id = new.class_id and status = 'active' and id <> new.id;

  if taken >= class_capacity then
    raise exception 'This class is full.' using hint = 'class_full';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_class_capacity() from public;

create trigger enrolments_capacity
  before insert or update on public.enrolments
  for each row execute function private.enforce_class_capacity();

-- A class's capacity can't drop below the children already in it.
create function private.guard_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken integer;
begin
  if new.capacity >= old.capacity then
    return new;
  end if;
  select count(*) into taken from public.enrolments where class_id = new.id and status = 'active';
  if taken > new.capacity then
    raise exception 'Capacity can''t be lower than the % children already enrolled.', taken
      using hint = 'capacity_below_enrolled';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_capacity_change() from public;

create trigger classes_capacity_guard
  before update of capacity on public.classes
  for each row execute function private.guard_capacity_change();
