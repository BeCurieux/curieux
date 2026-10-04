-- What families want (docs/M8_NETWORK.md, M8b). Parents say which times
-- would suit their child; the school's owners see new-class opportunities
-- and places that match now. Inside one school only: nothing is shared with
-- any other provider (CLAUDE.md rule 13).

create table public.place_wishes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  child_id uuid not null,
  level_id uuid,
  location_id uuid,
  weekdays integer[] not null
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  earliest time not null,
  latest time not null,
  note text check (note is null or length(note) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'placed', 'withdrawn')),
  placed_enrolment_id uuid references public.enrolments (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (earliest <= latest),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, level_id) references public.levels (organisation_id, id) on delete set null (level_id),
  foreign key (organisation_id, location_id) references public.locations (organisation_id, id)
    on delete set null (location_id)
);

create index place_wishes_open_idx on public.place_wishes (organisation_id, created_at desc)
  where status = 'open';
create index place_wishes_child_idx on public.place_wishes (child_id);

alter table public.place_wishes enable row level security;
revoke all on public.place_wishes from anon, authenticated;
grant select on public.place_wishes to authenticated;

create policy place_wishes_select on public.place_wishes
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create trigger audit_place_wishes after insert or update or delete on public.place_wishes
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ for parents

create function public.add_place_wish(
  p_child uuid, p_level uuid, p_location uuid, p_weekdays integer[],
  p_earliest time, p_latest time, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.children;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_days integer[];
  new_id uuid;
begin
  select * into ch from public.children where id = p_child;
  if not found or ch.id not in (select private.my_child_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_days from unnest(p_weekdays) d;
  if cardinality(v_days) = 0 or not (v_days <@ array[1, 2, 3, 4, 5, 6, 7]) then
    raise exception 'Choose at least one day.' using hint = 'wish_invalid';
  end if;
  if p_earliest is null or p_latest is null or p_earliest > p_latest then
    raise exception 'The earliest start must be before the latest.' using hint = 'wish_invalid';
  end if;
  if length(v_note) > 200 then
    raise exception 'Keep the note to 200 characters.' using hint = 'wish_invalid';
  end if;
  if p_level is not null and not exists (
       select 1 from public.levels where id = p_level and organisation_id = ch.organisation_id and active) then
    raise exception 'Choose one of your activity provider''s levels.' using hint = 'wish_invalid';
  end if;
  if p_location is not null and not exists (
       select 1 from public.locations where id = p_location and organisation_id = ch.organisation_id and active) then
    raise exception 'Choose one of your activity provider''s locations.' using hint = 'wish_invalid';
  end if;
  if (select count(*) from public.place_wishes where child_id = ch.id and status = 'open') >= 5 then
    raise exception 'That''s plenty of requests for one child. Withdraw one first.'
      using hint = 'wish_invalid';
  end if;
  insert into public.place_wishes
    (organisation_id, family_id, child_id, level_id, location_id, weekdays, earliest, latest,
     note, created_by)
  values
    (ch.organisation_id, ch.family_id, ch.id, p_level, p_location, v_days, p_earliest, p_latest,
     v_note, private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_place_wish(uuid, uuid, uuid, integer[], time, time, text)
  from public, anon;
grant execute on function public.add_place_wish(uuid, uuid, uuid, integer[], time, time, text)
  to authenticated;

create function public.withdraw_place_wish(p_wish uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.place_wishes;
begin
  select * into w from public.place_wishes where id = p_wish for update;
  if not found or w.family_id not in (select private.my_family_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.place_wishes set status = 'withdrawn', updated_at = now()
   where id = w.id and status = 'open';
end;
$$;

revoke all on function public.withdraw_place_wish(uuid) from public, anon;
grant execute on function public.withdraw_place_wish(uuid) to authenticated;

-- ------------------------------------------------------------------ placing

-- A child enrolled in a class closes their open requests for that class's
-- level (and, when placed from a request, that request).
create function private.close_place_wishes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update public.place_wishes w
       set status = 'placed', placed_enrolment_id = new.id, updated_at = now()
      from public.classes c
     where c.id = new.class_id and w.child_id = new.child_id and w.status = 'open'
       and w.level_id = c.level_id;
  end if;
  return null;
end;
$$;

revoke all on function private.close_place_wishes() from public;

create trigger enrolments_close_place_wishes after insert on public.enrolments
  for each row execute function private.close_place_wishes();

-- The owner enrols a child from their request into a class with room, by
-- the normal enrolment rules; the family is emailed.
alter table public.email_deliveries drop constraint email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check check (kind in (
    'spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder',
    'reenrolment_ask', 'reenrolment_reminder', 'payment_receipt',
    'fee_reminder', 'payment_failed', 'place_confirmed'));

create function public.place_from_wish(p_wish uuid, p_class uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.place_wishes;
  c public.classes;
  new_id uuid;
begin
  select * into w from public.place_wishes where id = p_wish for update;
  if not found or not private.is_org_member(w.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if w.status <> 'open' then
    raise exception 'That request has already been dealt with.' using hint = 'wish_closed';
  end if;
  select * into c from public.classes where id = p_class and organisation_id = w.organisation_id;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- The usual enrolment rules (capacity, duplicates, an active class)
  -- apply, as they do for an owner enrolling by hand.
  insert into public.enrolments (organisation_id, child_id, class_id)
  values (w.organisation_id, w.child_id, c.id)
  returning id into new_id;
  update public.place_wishes
     set status = 'placed', placed_enrolment_id = new_id, updated_at = now()
   where id = w.id and status = 'open';
  insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
  select 'place_confirmed', fm.user_id, w.organisation_id,
         jsonb_build_object('wish_id', w.id, 'enrolment_id', new_id),
         'placed:' || w.id || ':' || fm.user_id
    from public.family_members fm where fm.family_id = w.family_id
  on conflict (dedupe_key) do nothing;
  return new_id;
end;
$$;

revoke all on function public.place_from_wish(uuid, uuid) from public, anon;
grant execute on function public.place_from_wish(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ for owners

-- New class opportunities: 3 or more children (by default) wanting the same
-- level, location, day and half-hour start, where no class there at that
-- time has room. One start time per level, location and day: the one the
-- most children could make, earliest first.
create function public.class_opportunities(p_org uuid, p_min integer default 3)
returns table (level_id uuid, level_name text, location_id uuid, location_name text,
               weekday integer, start_time time, children integer)
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
  with wishes as (
    select w.* from public.place_wishes w
      join public.children ch on ch.id = w.child_id and ch.active
     where w.organisation_id = p_org and w.status = 'open' and w.level_id is not null
  ),
  slots as (
    select w.child_id, w.level_id, l.id as location_id, d as weekday, s::time as start_time
      from wishes w
      cross join lateral unnest(w.weekdays) d
      join public.locations l
        on l.organisation_id = p_org and l.active and (w.location_id is null or l.id = w.location_id)
      -- Every half-hour start from the earliest (rounded up) to the latest.
      cross join lateral generate_series(
        '2000-01-01'::timestamp
          + make_interval(secs => ceil(extract(epoch from w.earliest) / 1800) * 1800),
        '2000-01-01'::timestamp + w.latest,
        interval '30 minutes') s
  ),
  counted as (
    select s.level_id, s.location_id, s.weekday, s.start_time,
           count(distinct s.child_id)::integer as n
      from slots s
     where not exists (
       select 1 from public.classes c
        where c.organisation_id = p_org and c.active and c.level_id = s.level_id
          and c.location_id = s.location_id and c.weekday = s.weekday
          and c.start_time = s.start_time
          and c.capacity > (select count(*) from public.enrolments e
                             where e.class_id = c.id and e.status = 'active'))
     group by s.level_id, s.location_id, s.weekday, s.start_time
  ),
  best as (
    select c.*, row_number() over (partition by c.level_id, c.location_id, c.weekday
                                   order by c.n desc, c.start_time) as r
      from counted c
     where c.n >= coalesce(p_min, 3)
  )
  select b.level_id, lv.name, b.location_id, l.name, b.weekday, b.start_time, b.n
    from best b
    join public.levels lv on lv.id = b.level_id
    join public.locations l on l.id = b.location_id
   where b.r = 1
   order by b.n desc, b.weekday, b.start_time;
end;
$$;

revoke all on function public.class_opportunities(uuid, integer) from public, anon;
grant execute on function public.class_opportunities(uuid, integer) to authenticated;

-- Places that match now: classes with room at a time a family asked for.
create function public.wish_matches(p_org uuid)
returns table (wish_id uuid, class_id uuid, class_name text, location_name text,
               weekday integer, start_time time, spare integer)
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
  select w.id, c.id, c.name, l.name, c.weekday::integer, c.start_time,
         (c.capacity - (select count(*) from public.enrolments e
                         where e.class_id = c.id and e.status = 'active'))::integer
    from public.place_wishes w
    join public.children ch on ch.id = w.child_id and ch.active
    join public.classes c
      on c.organisation_id = p_org and c.active
     and (w.level_id is null or c.level_id = w.level_id)
     and (w.location_id is null or c.location_id = w.location_id)
     and c.weekday = any (w.weekdays)
     and c.start_time between w.earliest and w.latest
    join public.locations l on l.id = c.location_id
   where w.organisation_id = p_org and w.status = 'open'
     and c.capacity > (select count(*) from public.enrolments e
                        where e.class_id = c.id and e.status = 'active')
     and not exists (select 1 from public.enrolments e
                      where e.class_id = c.id and e.child_id = w.child_id and e.status = 'active')
   order by w.created_at, c.weekday, c.start_time;
end;
$$;

revoke all on function public.wish_matches(uuid) from public, anon;
grant execute on function public.wish_matches(uuid) to authenticated;

-- The school's levels and locations to choose from when asking, for its
-- families and owners: names only, nothing about who is in them.
create function public.wish_choices(p_org uuid)
returns table (kind text, id uuid, name text, program text, sort_order integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_org is null
     or not (p_org in (select private.my_family_org_ids())
             or private.is_org_member(p_org, array['owner'])) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select 'level', lv.id, lv.name, p.name, lv.sort_order
      from public.levels lv join public.programs p on p.id = lv.program_id
     where lv.organisation_id = p_org and lv.active and p.active
    union all
    select 'location', l.id, l.name, null, 0
      from public.locations l where l.organisation_id = p_org and l.active
    order by 1, 4, 5, 3;
end;
$$;

revoke all on function public.wish_choices(uuid) from public, anon;
grant execute on function public.wish_choices(uuid) to authenticated;
