-- A waiting-list page for new families (docs/M8_NETWORK.md, M8d). Each school
-- may turn on its own page; new families leave their details and the times
-- they'd like; the school's owners add them to the waiting list in one tap.
-- One school's page only: no directory, no search across schools.

alter table public.organisations add column waitlist_page_on boolean not null default false;

create table public.waitlist_enquiries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  parent_name text not null check (length(trim(parent_name)) between 1 and 100),
  email text not null check (length(email) between 3 and 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  phone text check (phone is null or length(phone) between 6 and 30),
  child_first_name text not null check (length(trim(child_first_name)) between 1 and 60),
  child_last_name text not null check (length(trim(child_last_name)) between 1 and 60),
  date_of_birth date not null,
  level_id uuid,
  location_id uuid,
  weekdays integer[] not null
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  earliest time not null,
  latest time not null,
  note text check (note is null or length(note) between 1 and 200),
  created_at timestamptz not null default now(),
  check (earliest <= latest),
  unique (organisation_id, id),
  foreign key (organisation_id, level_id) references public.levels (organisation_id, id) on delete set null (level_id),
  foreign key (organisation_id, location_id) references public.locations (organisation_id, id)
    on delete set null (location_id)
);

create index waitlist_enquiries_org_idx on public.waitlist_enquiries (organisation_id, created_at desc);

-- Owners read them; only the functions below write them. Not audited row by
-- row (the audit trail would keep a stranger's details); adding and
-- removing are recorded without them.
alter table public.waitlist_enquiries enable row level security;
revoke all on public.waitlist_enquiries from anon, authenticated;
grant select on public.waitlist_enquiries to authenticated;

create policy waitlist_enquiries_select on public.waitlist_enquiries
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

-- ------------------------------------------------------------------ the public page

-- The school's page: its name, levels and locations, or null when the page
-- isn't on (so nothing about the school is shown).
create function public.waitlist_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'school', o.name,
    'levels', coalesce((select jsonb_agg(jsonb_build_object('id', lv.id, 'name', lv.name, 'program', p.name)
                                         order by p.name, lv.sort_order, lv.name)
                          from public.levels lv join public.programs p on p.id = lv.program_id
                         where lv.organisation_id = o.id and lv.active and p.active), '[]'),
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name)
                             from public.locations l where l.organisation_id = o.id and l.active), '[]'))
    from public.organisations o
   where o.slug = p_slug and o.waitlist_page_on
$$;

revoke all on function public.waitlist_page(text) from public;
grant execute on function public.waitlist_page(text) to anon, authenticated;

create function public.join_school_waitlist(
  p_slug text, p_parent_name text, p_email text, p_phone text,
  p_child_first_name text, p_child_last_name text, p_date_of_birth date,
  p_level uuid, p_location uuid, p_weekdays integer[], p_earliest time, p_latest time,
  p_note text, p_consent boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_days integer[];
begin
  select id into org from public.organisations where slug = p_slug and waitlist_page_on;
  if org is null then
    raise exception 'This waiting list isn''t open.' using hint = 'join_closed';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Tick the box so the school can keep your details.' using hint = 'join_invalid';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_days from unnest(p_weekdays) d;
  if cardinality(v_days) = 0 then
    raise exception 'Choose at least one day.' using hint = 'join_invalid';
  end if;
  if p_earliest is null or p_latest is null or p_earliest > p_latest then
    raise exception 'The earliest start must be before the latest.' using hint = 'join_invalid';
  end if;
  if p_date_of_birth is null or p_date_of_birth > current_date
     or p_date_of_birth < current_date - interval '25 years' then
    raise exception 'Check the date of birth.' using hint = 'join_invalid';
  end if;
  if p_level is not null and not exists (
       select 1 from public.levels where id = p_level and organisation_id = org and active) then
    raise exception 'Choose one of the levels listed.' using hint = 'join_invalid';
  end if;
  if p_location is not null and not exists (
       select 1 from public.locations where id = p_location and organisation_id = org and active) then
    raise exception 'Choose one of the locations listed.' using hint = 'join_invalid';
  end if;
  if (select count(*) from public.waitlist_enquiries where organisation_id = org and email = v_email) >= 3 then
    raise exception 'You''ve already sent this school a few enquiries. They''ll be in touch.'
      using hint = 'join_invalid';
  end if;
  if (select count(*) from public.waitlist_enquiries where organisation_id = org) >= 500 then
    raise exception 'This waiting list is full for now. Contact the school directly.'
      using hint = 'join_closed';
  end if;
  insert into public.waitlist_enquiries
    (organisation_id, parent_name, email, phone, child_first_name, child_last_name, date_of_birth,
     level_id, location_id, weekdays, earliest, latest, note)
  values
    (org, trim(p_parent_name), v_email, nullif(trim(coalesce(p_phone, '')), ''),
     trim(p_child_first_name), trim(p_child_last_name), p_date_of_birth,
     p_level, p_location, v_days, p_earliest, p_latest, nullif(trim(coalesce(p_note, '')), ''));
exception
  when check_violation or not_null_violation then
    raise exception 'Some of those details aren''t valid. Check each one.' using hint = 'join_invalid';
end;
$$;

revoke all on function public.join_school_waitlist(text, text, text, text, text, text, date, uuid, uuid, integer[], time, time, text, boolean) from public;
grant execute on function public.join_school_waitlist(text, text, text, text, text, text, date, uuid, uuid, integer[], time, time, text, boolean) to anon, authenticated;

-- ------------------------------------------------------------------ for owners

create function public.set_waitlist_page(p_org uuid, p_on boolean)
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
  select waitlist_page_on into was from public.organisations where id = p_org for update;
  if was = p_on then
    return;
  end if;
  update public.organisations set waitlist_page_on = p_on where id = p_org;
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), p_org, 'update', 'organisations', p_org,
     jsonb_build_object('waitlist_page_on', was), jsonb_build_object('waitlist_page_on', p_on));
end;
$$;

revoke all on function public.set_waitlist_page(uuid, boolean) from public, anon;
grant execute on function public.set_waitlist_page(uuid, boolean) to authenticated;

-- Adds an enquiry to the waiting list: the family (found by email, or new),
-- the child (found by first name and date of birth, or new) and their
-- request for times. The enquiry is then deleted. Returns the family, the
-- email, and whether a parent with that email has already joined it (if
-- not, the app invites them).
create function public.add_waitlist_enquiry(p_enquiry uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.waitlist_enquiries;
  fam uuid;
  kid uuid;
  joined boolean;
begin
  select * into e from public.waitlist_enquiries where id = p_enquiry for update;
  if not found or not private.is_org_member(e.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select f.id into fam from public.families f
   where f.organisation_id = e.organisation_id and lower(trim(f.primary_contact_email)) = e.email
   order by f.created_at limit 1;
  if fam is null then
    insert into public.families (organisation_id, display_name, primary_contact_name,
                                 primary_contact_email, primary_contact_phone)
    values (e.organisation_id, initcap(e.child_last_name) || ' Family', e.parent_name, e.email, e.phone)
    returning id into fam;
  end if;

  select c.id into kid from public.children c
   where c.family_id = fam and lower(c.first_name) = lower(e.child_first_name)
     and c.date_of_birth = e.date_of_birth
   limit 1;
  if kid is null then
    insert into public.children (organisation_id, family_id, first_name, last_name, date_of_birth)
    values (e.organisation_id, fam, e.child_first_name, e.child_last_name, e.date_of_birth)
    returning id into kid;
  end if;

  insert into public.place_wishes
    (organisation_id, family_id, child_id, level_id, location_id, weekdays, earliest, latest,
     note, created_by, created_at)
  values
    (e.organisation_id, fam, kid, e.level_id, e.location_id, e.weekdays, e.earliest, e.latest,
     e.note, private.current_user_id(), e.created_at);

  joined := exists (select 1 from public.family_members fm join public.users u on u.id = fm.user_id
                     where fm.family_id = fam and lower(u.email) = e.email);

  delete from public.waitlist_enquiries where id = e.id;
  insert into public.audit_events (actor_user_id, organisation_id, action, entity_type, entity_id, after_json)
  values (private.current_user_id(), e.organisation_id, 'update', 'waitlist_enquiries', e.id,
          jsonb_build_object('added_to_family', fam));
  return jsonb_build_object('family_id', fam, 'email', e.email, 'joined', joined);
end;
$$;

revoke all on function public.add_waitlist_enquiry(uuid) from public, anon;
grant execute on function public.add_waitlist_enquiry(uuid) to authenticated;

create function public.remove_waitlist_enquiry(p_enquiry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organisation_id into org from public.waitlist_enquiries where id = p_enquiry;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.waitlist_enquiries where id = p_enquiry;
  insert into public.audit_events (actor_user_id, organisation_id, action, entity_type, entity_id)
  values (private.current_user_id(), org, 'delete', 'waitlist_enquiries', p_enquiry);
end;
$$;

revoke all on function public.remove_waitlist_enquiry(uuid) from public, anon;
grant execute on function public.remove_waitlist_enquiry(uuid) to authenticated;

-- Enquiries no one has dealt with go after 90 days.
create function private.forget_old_enquiries()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.waitlist_enquiries where created_at < now() - interval '90 days'
$$;

revoke all on function private.forget_old_enquiries() from public;

select cron.schedule('ovyko-forget-old-enquiries', '40 17 * * *', 'select private.forget_old_enquiries()');
