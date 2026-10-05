-- Free places offered to waiting families (docs/M8_NETWORK.md, M8c). A place
-- at a time a family asked for (M8b) is offered to them, held for 48 hours,
-- and taken in one tap. Schools that choose it have Ovyko do the offering.

alter table public.organisations add column auto_place_offers boolean not null default false;

create table public.place_offers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  wish_id uuid not null references public.place_wishes (id) on delete cascade,
  family_id uuid not null,
  child_id uuid not null,
  class_id uuid not null,
  status text not null default 'offered'
    check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  -- Null when Ovyko offered it automatically.
  offered_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  answered_at timestamptz,
  answered_by uuid references public.users (id) on delete set null,
  enrolment_id uuid references public.enrolments (id) on delete set null,
  check (expires_at > created_at),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade,
  foreign key (organisation_id, class_id) references public.classes (organisation_id, id) on delete cascade
);

-- One open offer per request.
create unique index place_offers_one_open_idx on public.place_offers (wish_id) where status = 'offered';
create index place_offers_class_open_idx on public.place_offers (class_id) where status = 'offered';
create index place_offers_family_idx on public.place_offers (family_id, created_at desc);

alter table public.place_offers enable row level security;
revoke all on public.place_offers from anon, authenticated;
grant select on public.place_offers to authenticated;

create policy place_offers_select on public.place_offers
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or family_id in (select private.my_family_ids())
  );

create trigger audit_place_offers after insert or update or delete on public.place_offers
  for each row execute function private.audit_change();

alter table public.email_deliveries drop constraint email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check check (kind in (
    'spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder',
    'reenrolment_ask', 'reenrolment_reminder', 'payment_receipt',
    'fee_reminder', 'payment_failed', 'place_confirmed', 'place_offered'));

-- ------------------------------------------------------------------ held places

-- Places held by open offers count as taken, except for the child the
-- offer is for (so they can accept it).
create function private.held_places(p_class uuid, p_except_child uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.place_offers
   where class_id = p_class and status = 'offered' and expires_at > now()
     and child_id is distinct from p_except_child
$$;

revoke all on function private.held_places(uuid, uuid) from public;

-- Places free in a class now: its places, less children in it and places held.
create function private.class_spare(p_class uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select c.capacity
         - (select count(*) from public.enrolments e where e.class_id = c.id and e.status = 'active')::integer
         - private.held_places(c.id)
    from public.classes c where c.id = p_class
$$;

revoke all on function private.class_spare(uuid) from public;

-- As before (20260929000012_enrolments.sql), counting places held by offers
-- for other children.
create or replace function private.enforce_class_capacity()
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
  taken := taken + private.held_places(new.class_id, new.child_id);

  if taken >= class_capacity then
    raise exception 'This class is full.' using hint = 'class_full';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ offering

-- Offers a request a place in a class, if one is free, and emails the
-- family's parents. Returns the offer, or null when there's no place.
create function private.make_place_offer(p_wish uuid, p_class uuid, p_by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.place_wishes;
  new_id uuid;
begin
  -- One offer at a time per class: the class row is the lock.
  perform 1 from public.classes where id = p_class for update;
  if private.class_spare(p_class) <= 0 then
    return null;
  end if;
  select * into w from public.place_wishes where id = p_wish;
  insert into public.place_offers
    (organisation_id, wish_id, family_id, child_id, class_id, offered_by, expires_at)
  values
    (w.organisation_id, w.id, w.family_id, w.child_id, p_class, p_by, now() + interval '48 hours')
  returning id into new_id;
  insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
  select 'place_offered', fm.user_id, w.organisation_id, jsonb_build_object('offer_id', new_id),
         'place_offer:' || new_id || ':' || fm.user_id
    from public.family_members fm where fm.family_id = w.family_id
  on conflict (dedupe_key) do nothing;
  return new_id;
end;
$$;

revoke all on function private.make_place_offer(uuid, uuid, uuid) from public;

-- Closes lapsed offers and, if the school has chosen it, offers each free
-- place to the longest-waiting request that matches: same level, a
-- location it allows, a day it chose, a start in its window. Never the
-- same class to the same request twice; only families with a parent in
-- Ovyko (they're the ones who can accept).
create function private.offer_free_places(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  w record;
  made integer := 0;
begin
  update public.place_offers set status = 'expired', answered_at = now()
   where organisation_id = p_org and status = 'offered' and expires_at <= now();
  if not coalesce((select auto_place_offers from public.organisations where id = p_org), false) then
    return 0;
  end if;
  for c in
    select cl.id, cl.level_id, cl.location_id, cl.weekday, cl.start_time
      from public.classes cl
     where cl.organisation_id = p_org and cl.active and private.class_spare(cl.id) > 0
     order by cl.weekday, cl.start_time
  loop
    for w in
      select pw.id from public.place_wishes pw
        join public.children ch on ch.id = pw.child_id and ch.active
       where pw.organisation_id = p_org and pw.status = 'open'
         and pw.level_id = c.level_id
         and (pw.location_id is null or pw.location_id = c.location_id)
         and c.weekday = any (pw.weekdays)
         and c.start_time between pw.earliest and pw.latest
         and not exists (select 1 from public.enrolments e
                          where e.class_id = c.id and e.child_id = pw.child_id and e.status = 'active')
         and not exists (select 1 from public.place_offers o
                          where o.wish_id = pw.id and (o.status = 'offered' or o.class_id = c.id))
         and exists (select 1 from public.family_members fm where fm.family_id = pw.family_id)
       order by pw.created_at
    loop
      exit when private.make_place_offer(w.id, c.id, null) is null;
      made := made + 1;
    end loop;
  end loop;
  return made;
end;
$$;

revoke all on function private.offer_free_places(uuid) from public;

-- Every few minutes, for every school.
create function private.advance_place_offers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  for org in select id from public.organisations loop
    perform private.offer_free_places(org);
  end loop;
end;
$$;

revoke all on function private.advance_place_offers() from public;

select cron.schedule('ovyko-offer-free-places', '*/5 * * * *', 'select private.advance_place_offers()');

-- A request that closes (placed another way, withdrawn) takes its open
-- offer with it.
create function private.close_place_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status <> 'open' then
    update public.place_offers set status = 'withdrawn', answered_at = now()
     where wish_id = new.id and status = 'offered';
  end if;
  return null;
end;
$$;

revoke all on function private.close_place_offers() from public;

create trigger place_wishes_close_offers after update of status on public.place_wishes
  for each row execute function private.close_place_offers();

-- ------------------------------------------------------------------ for owners

create function public.set_auto_place_offers(p_org uuid, p_on boolean)
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
  select auto_place_offers into was from public.organisations where id = p_org for update;
  if was = p_on then
    return;
  end if;
  update public.organisations set auto_place_offers = p_on where id = p_org;
  -- Organisations aren't audited row by row; this choice is.
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('auto_place_offers', was), jsonb_build_object('auto_place_offers', p_on));
  if p_on then
    perform private.offer_free_places(p_org);
  end if;
end;
$$;

revoke all on function public.set_auto_place_offers(uuid, boolean) from public, anon;
grant execute on function public.set_auto_place_offers(uuid, boolean) to authenticated;

-- The owner offers a request a place in one of the school's classes.
create function public.offer_place(p_wish uuid, p_class uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.place_wishes;
  new_id uuid;
begin
  select * into w from public.place_wishes where id = p_wish for update;
  if not found or not private.is_org_member(w.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.classes where id = p_class and organisation_id = w.organisation_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if w.status <> 'open' then
    raise exception 'That request has already been dealt with.' using hint = 'wish_closed';
  end if;
  if exists (select 1 from public.place_offers where wish_id = w.id and status = 'offered' and expires_at > now()) then
    raise exception 'This family already has a place offered to them. Wait for their answer, or withdraw it.'
      using hint = 'offer_invalid';
  end if;
  -- A lapsed offer not yet tidied up.
  update public.place_offers set status = 'expired', answered_at = now()
   where wish_id = w.id and status = 'offered';
  if not exists (select 1 from public.classes where id = p_class and active) then
    raise exception 'This class is no longer running.' using hint = 'class_inactive';
  end if;
  if exists (select 1 from public.enrolments
              where class_id = p_class and child_id = w.child_id and status = 'active') then
    raise exception 'This child is already in that class.' using hint = 'offer_invalid';
  end if;
  if not exists (select 1 from public.family_members where family_id = w.family_id) then
    raise exception 'This family hasn''t joined Ovyko yet, so they can''t accept an offer. Enrol the child instead.'
      using hint = 'offer_invalid';
  end if;
  new_id := private.make_place_offer(w.id, p_class, private.current_user_id());
  if new_id is null then
    raise exception 'This class is full.' using hint = 'class_full';
  end if;
  return new_id;
end;
$$;

revoke all on function public.offer_place(uuid, uuid) from public, anon;
grant execute on function public.offer_place(uuid, uuid) to authenticated;

create function public.withdraw_place_offer(p_offer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.place_offers;
begin
  select * into o from public.place_offers where id = p_offer for update;
  if not found or not private.is_org_member(o.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if o.status <> 'offered' then
    raise exception 'That offer has already closed.' using hint = 'offer_closed';
  end if;
  update public.place_offers set status = 'withdrawn', answered_at = now(),
                                 answered_by = private.current_user_id()
   where id = o.id;
  perform private.offer_free_places(o.organisation_id);
end;
$$;

revoke all on function public.withdraw_place_offer(uuid) from public, anon;
grant execute on function public.withdraw_place_offer(uuid) to authenticated;

-- ------------------------------------------------------------------ for families

-- The family accepts (the child is enrolled, by the normal rules) or
-- declines (the place goes to the next in line). Returns the enrolment
-- when accepted.
create function public.answer_place_offer(p_offer uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.place_offers;
  new_id uuid;
begin
  select * into o from public.place_offers where id = p_offer for update;
  if not found or o.family_id not in (select private.my_family_ids()) or p_accept is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if o.status = 'offered' and o.expires_at <= now() then
    update public.place_offers set status = 'expired', answered_at = now() where id = o.id;
    return null;
  end if;
  if o.status <> 'offered' then
    raise exception 'That offer has closed.' using hint = 'offer_closed';
  end if;

  if not p_accept then
    update public.place_offers set status = 'declined', answered_at = now(),
                                   answered_by = private.current_user_id()
     where id = o.id;
    perform private.offer_free_places(o.organisation_id);
    return null;
  end if;

  insert into public.enrolments (organisation_id, child_id, class_id)
  values (o.organisation_id, o.child_id, o.class_id)
  returning id into new_id;
  update public.place_offers set status = 'accepted', answered_at = now(),
                                 answered_by = private.current_user_id(), enrolment_id = new_id
   where id = o.id;
  update public.place_wishes set status = 'placed', placed_enrolment_id = new_id, updated_at = now()
   where id = o.wish_id and status = 'open';
  return new_id;
end;
$$;

revoke all on function public.answer_place_offer(uuid, boolean) from public, anon;
grant execute on function public.answer_place_offer(uuid, boolean) to authenticated;

-- A family's open offers, with what the class is: parents can't read a
-- class their children aren't in, so this says which one.
create function public.my_place_offers()
returns table (offer_id uuid, child_id uuid, child_first_name text, organisation_name text,
               class_name text, level_name text, location_name text, weekday integer,
               start_time time, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.child_id, ch.first_name, org.name, c.name, lv.name, l.name,
         c.weekday::integer, c.start_time, o.expires_at
    from public.place_offers o
    join public.children ch on ch.id = o.child_id
    join public.organisations org on org.id = o.organisation_id
    join public.classes c on c.id = o.class_id
    join public.levels lv on lv.id = c.level_id
    join public.locations l on l.id = c.location_id
   where o.family_id in (select private.my_family_ids())
     and o.status = 'offered' and o.expires_at > now()
   order by o.expires_at
$$;

revoke all on function public.my_place_offers() from public, anon;
grant execute on function public.my_place_offers() to authenticated;

-- ------------------------------------------------------------------ places that match now

-- As before (20261019000036_place_wishes.sql), with places held by offers
-- not counted as free, and requests already offered a place left out.
create or replace function public.wish_matches(p_org uuid)
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
  select w.id, c.id, c.name, l.name, c.weekday::integer, c.start_time, private.class_spare(c.id)
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
     and private.class_spare(c.id) > 0
     and not exists (select 1 from public.enrolments e
                      where e.class_id = c.id and e.child_id = w.child_id and e.status = 'active')
     and not exists (select 1 from public.place_offers o
                      where o.wish_id = w.id and o.status = 'offered' and o.expires_at > now())
   order by w.created_at, c.weekday, c.start_time;
end;
$$;
