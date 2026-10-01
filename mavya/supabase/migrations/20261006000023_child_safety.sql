-- Protecting children, part 1 (docs/M6_MIGRATION_PILOT.md, M6d): health
-- notes and pickup restrictions, readable only through one function that
-- records every look by staff.

-- ------------------------------------------------------------------ tables

create table public.child_health (
  child_id uuid primary key,
  organisation_id uuid not null,
  allergies text check (length(allergies) <= 1000),
  medical_notes text check (length(medical_notes) <= 2000),
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade
);

create table public.child_restrictions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  child_id uuid not null,
  person_name text not null check (length(trim(person_name)) between 1 and 120),
  kind text not null check (kind in ('no_collect', 'no_contact')),
  -- For owners only: a court order's details, who to call. Never shown to
  -- instructors.
  details text check (length(details) <= 2000),
  added_by uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (organisation_id, child_id) references public.children (organisation_id, id) on delete cascade
);

create index child_restrictions_child_idx on public.child_restrictions (child_id) where removed_at is null;

create table public.sensitive_views (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  viewer_user_id uuid references public.users (id) on delete set null,
  viewer_role text not null check (viewer_role in ('owner', 'instructor')),
  viewed_at timestamptz not null default now()
);

create index sensitive_views_child_idx on public.sensitive_views (child_id, viewed_at desc);

-- Nobody reads or writes these tables directly: only the functions below.
alter table public.child_health enable row level security;
alter table public.child_restrictions enable row level security;
alter table public.sensitive_views enable row level security;
revoke all on public.child_health, public.child_restrictions, public.sensitive_views
  from anon, authenticated;

-- Changes are audited like everything else, but the audit trail (which
-- owners can read) records that the notes changed, never what they say:
-- otherwise it would be a way to read them without the look being recorded.
create function private.audit_safety_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  after_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  changed jsonb := coalesce(after_row, before_row);
begin
  if tg_op = 'UPDATE' and before_row = after_row then
    return null;
  end if;
  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, before_json, after_json)
  values
    (private.current_user_id(), (changed ->> 'organisation_id')::uuid, lower(tg_op), tg_table_name,
     coalesce(changed ->> 'id', changed ->> 'child_id')::uuid,
     private.redact_safety(before_row), private.redact_safety(after_row));
  return null;
end;
$$;

-- Each sensitive field becomes whether it's filled in.
create function private.redact_safety(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_row is null then null else
    (p_row - 'allergies' - 'medical_notes' - 'details')
    || jsonb_strip_nulls(jsonb_build_object(
         'has_allergies', case when p_row ? 'allergies' then p_row ->> 'allergies' is not null end,
         'has_medical_notes', case when p_row ? 'medical_notes' then p_row ->> 'medical_notes' is not null end,
         'has_details', case when p_row ? 'details' then p_row ->> 'details' is not null end))
  end
$$;

revoke all on function private.audit_safety_change() from public;
revoke all on function private.redact_safety(jsonb) from public;

create trigger audit_child_health after insert or update or delete on public.child_health
  for each row execute function private.audit_safety_change();
create trigger audit_child_restrictions after insert or update on public.child_restrictions
  for each row execute function private.audit_safety_change();

-- ------------------------------------------------------------------ who may know

-- How the signed-in person relates to a child: 'owner' of the child's
-- school, the child's 'family', an 'instructor' who teaches them, or null.
create function private.child_access(p_child uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when private.is_org_member(ch.organisation_id, array['owner']) then 'owner'
           when ch.family_id in (select private.my_family_ids()) then 'family'
           when ch.id in (select private.my_taught_child_ids()) then 'instructor'
         end
    from public.children ch
   where ch.id = p_child
$$;

revoke all on function private.child_access(uuid) from public;
grant execute on function private.child_access(uuid) to authenticated;

-- ------------------------------------------------------------------ reading

-- A child's health notes and, for staff, restrictions. Records the look when
-- the caller is staff. Instructors get restrictions without their details;
-- families get none.
create function public.child_safety(p_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access text := private.child_access(p_child);
  org uuid;
  health jsonb;
  restrictions jsonb := '[]';
begin
  if access is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select organisation_id into org from public.children where id = p_child;

  select jsonb_build_object('allergies', h.allergies, 'medical_notes', h.medical_notes,
                            'updated_at', h.updated_at)
    into health
    from public.child_health h where h.child_id = p_child;

  if access in ('owner', 'instructor') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'person_name', r.person_name, 'kind', r.kind,
             'details', case when access = 'owner' then r.details end,
             'added_at', r.added_at) order by r.added_at), '[]')
      into restrictions
      from public.child_restrictions r
     where r.child_id = p_child and r.removed_at is null;

    insert into public.sensitive_views (organisation_id, child_id, viewer_user_id, viewer_role)
    values (org, p_child, private.current_user_id(), access);
  end if;

  return jsonb_build_object('access', access, 'health', health, 'restrictions', restrictions);
end;
$$;

revoke all on function public.child_safety(uuid) from public, anon;
grant execute on function public.child_safety(uuid) to authenticated;

-- Which of these children have something to know, for rosters and lists.
-- Says only whether, never what, so it isn't a look. Children the caller
-- can't see are left out; families never learn about restrictions.
create function public.safety_flags(p_children uuid[])
returns table (child_id uuid, has_health boolean, has_restriction boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         exists (select 1 from public.child_health h
                  where h.child_id = c.id
                    and (coalesce(trim(h.allergies), '') <> '' or coalesce(trim(h.medical_notes), '') <> '')),
         private.child_access(c.id) in ('owner', 'instructor')
           and exists (select 1 from public.child_restrictions r where r.child_id = c.id and r.removed_at is null)
    from unnest(coalesce(p_children, '{}')) as ids (id)
    join public.children c on c.id = ids.id
   where private.child_access(c.id) is not null
$$;

revoke all on function public.safety_flags(uuid[]) from public, anon;
grant execute on function public.safety_flags(uuid[]) to authenticated;

-- Who has looked at a child's details, newest first. Owners only.
create function public.child_safety_views(p_child uuid)
returns table (viewer_name text, viewer_role text, viewed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.child_access(p_child) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select coalesce(nullif(u.name, ''), u.email, 'Someone'), v.viewer_role, v.viewed_at
      from public.sensitive_views v
      left join public.users u on u.id = v.viewer_user_id
     where v.child_id = p_child
     order by v.viewed_at desc
     limit 50;
end;
$$;

revoke all on function public.child_safety_views(uuid) from public, anon;
grant execute on function public.child_safety_views(uuid) to authenticated;

-- ------------------------------------------------------------------ writing

-- The child's parents or the school's owners set the health notes. Both
-- empty removes them.
create function public.save_child_health(p_child uuid, p_allergies text, p_medical_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  access text := private.child_access(p_child);
  allergies text := nullif(trim(coalesce(p_allergies, '')), '');
  medical text := nullif(trim(coalesce(p_medical_notes, '')), '');
begin
  if access is null or access not in ('owner', 'family') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(allergies) > 1000 or length(medical) > 2000 then
    raise exception 'That''s too long. Keep allergies under 1,000 characters and notes under 2,000.'
      using hint = 'safety_invalid';
  end if;
  if allergies is null and medical is null then
    delete from public.child_health where child_id = p_child;
    return;
  end if;
  insert into public.child_health (child_id, organisation_id, allergies, medical_notes, updated_by, updated_at)
  select p_child, ch.organisation_id, allergies, medical, private.current_user_id(), now()
    from public.children ch where ch.id = p_child
  on conflict (child_id) do update
    set allergies = excluded.allergies, medical_notes = excluded.medical_notes,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_child_health(uuid, text, text) from public, anon;
grant execute on function public.save_child_health(uuid, text, text) to authenticated;

create function public.add_child_restriction(p_child uuid, p_person text, p_kind text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if private.child_access(p_child) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_person), '') = '' or length(trim(p_person)) > 120
     or p_kind not in ('no_collect', 'no_contact') or length(p_details) > 2000 then
    raise exception 'Add the person''s name and choose what isn''t allowed.' using hint = 'safety_invalid';
  end if;
  insert into public.child_restrictions (organisation_id, child_id, person_name, kind, details, added_by)
  select ch.organisation_id, ch.id, trim(p_person), p_kind, nullif(trim(coalesce(p_details, '')), ''),
         private.current_user_id()
    from public.children ch where ch.id = p_child
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_child_restriction(uuid, text, text, text) from public, anon;
grant execute on function public.add_child_restriction(uuid, text, text, text) to authenticated;

create function public.remove_child_restriction(p_restriction uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid;
begin
  select r.child_id into child from public.child_restrictions r where r.id = p_restriction;
  if child is null or private.child_access(child) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.child_restrictions set removed_at = now()
   where id = p_restriction and removed_at is null;
end;
$$;

revoke all on function public.remove_child_restriction(uuid) from public, anon;
grant execute on function public.remove_child_restriction(uuid) to authenticated;
