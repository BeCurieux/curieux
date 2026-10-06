-- Protecting children, part 2 (docs/M6_MIGRATION_PILOT.md, M6d): two-step
-- sign-in for owners, enforced here, and exporting or deleting a family.

-- ------------------------------------------------------------------ two-step sign-in

-- On for every school. The schools that exist now are the demo, whose
-- shared logins prospects try, so they start with it off.
alter table public.organisations
  add column owner_two_step_required boolean not null default true;
update public.organisations set owner_two_step_required = false;

-- An owner of a school that requires two-step sign-in is an owner only once
-- this session has passed it (Supabase Auth's assurance level 2). Until
-- then every check in the database treats them as not an owner, so a
-- password alone, used straight against the API, reaches nothing.
create or replace function private.is_org_member(
  org_id uuid,
  roles text[] default array['owner', 'instructor']
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    join public.organisations o on o.id = m.organisation_id
    where m.organisation_id = org_id
      and m.user_id = private.current_user_id()
      and m.status = 'active'
      and m.role = any (roles)
      and (m.role <> 'owner'
           or not o.owner_two_step_required
           or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2')
  )
$$;

-- Whether the signed-in person must pass two-step sign-in before they can
-- act as an owner, so the app can ask for it.
create function public.owner_two_step_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    join public.organisations o on o.id = m.organisation_id
    where m.user_id = private.current_user_id()
      and m.status = 'active'
      and m.role = 'owner'
      and o.owner_two_step_required
  ) and coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2'
$$;

revoke all on function public.owner_two_step_needed() from public, anon;
grant execute on function public.owner_two_step_needed() to authenticated;

-- ------------------------------------------------------------------ export

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check check (action in ('insert', 'update', 'delete', 'export'));

-- Everything Ovyko holds about a family, for the family. Owners only. The
-- export is audited, and counted as a look at each child's health notes.
create function public.export_family(p_family uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  result jsonb;
  kids uuid[];
begin
  select organisation_id into org from public.families where id = p_family;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(id), '{}') into kids from public.children where family_id = p_family;

  select jsonb_build_object(
    'exported_at', now(),
    'school', (select name from public.organisations where id = org),
    'family', (select jsonb_build_object(
                 'name', f.display_name,
                 'contact_name', f.primary_contact_name,
                 'contact_email', f.primary_contact_email,
                 'contact_phone', f.primary_contact_phone,
                 'added_at', f.created_at)
                 from public.families f where f.id = p_family),
    'parents', (select coalesce(jsonb_agg(jsonb_build_object(
                  'name', u.name, 'email', u.email, 'relationship', fm.relationship,
                  'primary_guardian', fm.is_primary_guardian) order by u.name), '[]')
                  from public.family_members fm join public.users u on u.id = fm.user_id
                 where fm.family_id = p_family),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object(
                  'email', i.email, 'status', i.status, 'created_at', i.created_at,
                  'accepted_at', i.accepted_at) order by i.created_at), '[]')
                  from public.family_invites i where i.family_id = p_family),
    'children', (select coalesce(jsonb_agg(jsonb_build_object(
      'first_name', c.first_name,
      'last_name', c.last_name,
      'date_of_birth', c.date_of_birth,
      'active', c.active,
      'health', (select jsonb_build_object('allergies', h.allergies, 'medical_notes', h.medical_notes,
                                           'updated_at', h.updated_at)
                   from public.child_health h where h.child_id = c.id),
      'pickup_restrictions', (select coalesce(jsonb_agg(jsonb_build_object(
                                'person', r.person_name, 'kind', r.kind, 'details', r.details,
                                'added_at', r.added_at, 'removed_at', r.removed_at) order by r.added_at), '[]')
                                from public.child_restrictions r where r.child_id = c.id),
      'enrolments', (select coalesce(jsonb_agg(jsonb_build_object(
                       'class', cl.name, 'status', e.status, 'starts_at', e.starts_at,
                       'ends_at', e.ends_at) order by e.starts_at), '[]')
                       from public.enrolments e join public.classes cl on cl.id = e.class_id
                      where e.child_id = c.id),
      'attendance', (select coalesce(jsonb_agg(jsonb_build_object(
                       'lesson', o.starts_at, 'class', cl.name, 'status', a.status) order by o.starts_at), '[]')
                       from public.attendance a
                       join public.class_occurrences o on o.id = a.occurrence_id
                       join public.classes cl on cl.id = o.class_id
                      where a.child_id = c.id),
      'progress', (select coalesce(jsonb_agg(jsonb_build_object(
                     'skill', s.name, 'status', p.status, 'assessed_at', p.assessed_at) order by p.assessed_at), '[]')
                     from public.progress_records p join public.skills s on s.id = p.skill_id
                    where p.child_id = c.id),
      'absences', (select coalesce(jsonb_agg(jsonb_build_object(
                     'lesson', o.starts_at, 'reason', ab.reason, 'reported_at', ab.reported_at) order by o.starts_at), '[]')
                     from public.absences ab join public.class_occurrences o on o.id = ab.occurrence_id
                    where ab.child_id = c.id),
      'makeup_credits', (select coalesce(jsonb_agg(jsonb_build_object(
                           'status', mc.status, 'issued_at', mc.issued_at, 'expires_at', mc.expires_at,
                           'reason', mc.reason) order by mc.issued_at), '[]')
                           from public.makeup_credits mc where mc.child_id = c.id),
      'makeup_bookings', (select coalesce(jsonb_agg(jsonb_build_object(
                            'lesson', o.starts_at, 'status', b.status, 'booked_at', b.booked_at) order by b.booked_at), '[]')
                            from public.makeup_bookings b join public.class_occurrences o on o.id = b.target_occurrence_id
                           where b.child_id = c.id),
      'offers', (select coalesce(jsonb_agg(jsonb_build_object(
                   'lesson', o.starts_at, 'status', v.status, 'offered_at', v.created_at) order by v.created_at), '[]')
                   from public.vacancy_offers v join public.class_occurrences o on o.id = v.occurrence_id
                  where v.child_id = c.id)
    ) order by c.first_name), '[]')
      from public.children c where c.family_id = p_family)
  ) into result;

  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, after_json)
  values
    (private.current_user_id(), org, 'export', 'families', p_family,
     jsonb_build_object('children', cardinality(kids)));
  insert into public.sensitive_views (organisation_id, child_id, viewer_user_id, viewer_role)
  select org, k, private.current_user_id(), 'owner' from unnest(kids) as k;

  return result;
end;
$$;

revoke all on function public.export_family(uuid) from public, anon;
grant execute on function public.export_family(uuid) to authenticated;

-- ------------------------------------------------------------------ deletion

-- Deletes a family on request: the family, its children and everything
-- about them (by cascade), and wipes their details from earlier audit
-- entries, keeping that a deletion happened. Owners only, confirmed by
-- typing the family's name. Returns the sign-in accounts of parents who
-- now belong nowhere, for the server to remove.
create function public.delete_family(p_family uuid, p_confirm text)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  family_name text;
  kids text[];
  parents uuid[];
  leaving uuid[];
begin
  select organisation_id, display_name into org, family_name from public.families where id = p_family;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(trim(family_name)) then
    raise exception 'Type the family''s name exactly as shown to confirm.' using hint = 'delete_unconfirmed';
  end if;

  select coalesce(array_agg(id::text), '{}') into kids from public.children where family_id = p_family;
  select coalesce(array_agg(user_id), '{}') into parents from public.family_members where family_id = p_family;

  delete from public.families where id = p_family;

  update public.audit_events
     set before_json = case when before_json is not null then '{"wiped": "family deleted"}'::jsonb end,
         after_json = case when after_json is not null then '{"wiped": "family deleted"}'::jsonb end
   where organisation_id = org
     and (entity_id = p_family
          or entity_id::text = any (kids)
          or before_json ->> 'family_id' = p_family::text
          or after_json ->> 'family_id' = p_family::text
          or before_json ->> 'child_id' = any (kids)
          or after_json ->> 'child_id' = any (kids));

  select coalesce(array_agg(u.auth_id), '{}') into leaving
    from public.users u
   where u.id = any (parents)
     and u.auth_id is not null
     and not exists (select 1 from public.family_members fm where fm.user_id = u.id)
     and not exists (select 1 from public.staff_memberships m where m.user_id = u.id);

  insert into public.audit_events
    (actor_user_id, organisation_id, action, entity_type, entity_id, after_json)
  values
    (private.current_user_id(), org, 'delete', 'family_deletion', p_family,
     jsonb_build_object('children', cardinality(kids), 'parents', cardinality(parents),
                        'accounts_removed', cardinality(leaving)));

  return leaving;
end;
$$;

revoke all on function public.delete_family(uuid, text) from public, anon;
grant execute on function public.delete_family(uuid, text) to authenticated;
