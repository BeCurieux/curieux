-- Who may read and change the M2 tables (docs/M2_CLASSES.md).
--
--   Owners      read and write everything in their organisation.
--   Instructors read their organisation's timetable, and only the children,
--               families and enrolments of classes they teach. No writes.
--   Parents     read their own family, and the classes, lessons, levels,
--               programs and locations their children are enrolled in.
--               No writes.
--
-- One policy per table and action, combining the cases with OR, so
-- Postgres evaluates each row once.

-- ------------------------------------------------------------------ helpers

-- Classes the signed-in user's children are currently enrolled in.
create function private.my_family_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.class_id
    from public.enrolments e
    join public.children ch on ch.id = e.child_id
    join public.family_members fm on fm.family_id = ch.family_id
   where fm.user_id = private.current_user_id()
     and e.status in ('active', 'paused')
$$;

-- Classes the signed-in user teaches.
create function private.my_taught_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.classes c
    join public.staff_memberships m on m.id = c.instructor_id
   where m.user_id = private.current_user_id()
     and m.status = 'active'
$$;

-- Children currently enrolled in a class the signed-in user teaches.
create function private.my_taught_child_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.child_id
    from public.enrolments e
   where e.status in ('active', 'paused')
     and e.class_id in (select private.my_taught_class_ids())
$$;

-- Families the signed-in user belongs to.
create function private.my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.family_id from public.family_members fm where fm.user_id = private.current_user_id()
$$;

-- Users who are staff of an organisation the signed-in user owns.
create function private.owner_sees_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_memberships m
     where m.user_id = p_user_id
       and private.is_org_member(m.organisation_id, array['owner'])
  )
$$;

-- The organisation a family belongs to.
create function private.family_org(p_family_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organisation_id from public.families where id = p_family_id
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'private.my_family_class_ids()', 'private.my_taught_class_ids()', 'private.my_taught_child_ids()',
    'private.my_family_ids()', 'private.owner_sees_user(uuid)', 'private.family_org(uuid)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ------------------------------------------------------------------ grants

revoke all on public.locations, public.programs, public.levels, public.classes,
  public.class_occurrences, public.enrolments, public.audit_events
  from anon, authenticated;

grant select, insert, update on public.locations, public.programs, public.levels,
  public.classes, public.enrolments, public.families, public.children
  to authenticated;
grant select on public.class_occurrences, public.audit_events to authenticated;
-- Owners may cancel a lesson or change its capacity, nothing else about it.
grant update (status, capacity_override) on public.class_occurrences to authenticated;

-- ------------------------------------------------------------------ existing tables

drop policy organisations_select_staff on public.organisations;
create policy organisations_select on public.organisations
  for select to authenticated
  using (
    private.is_org_member(id)
    or id in (select f.organisation_id from public.families f where f.id in (select private.my_family_ids()))
  );

drop policy users_select_self on public.users;
create policy users_select on public.users
  for select to authenticated
  using (auth_id = (select auth.uid()) or private.owner_sees_user(id));

drop policy families_select_member on public.families;
create policy families_select on public.families
  for select to authenticated
  using (
    id in (select private.my_family_ids())
    or private.is_org_member(organisation_id, array['owner'])
    or id in (select ch.family_id from public.children ch where ch.id in (select private.my_taught_child_ids()))
  );
create policy families_insert on public.families
  for insert to authenticated
  with check (private.is_org_member(organisation_id, array['owner']));
create policy families_update on public.families
  for update to authenticated
  using (private.is_org_member(organisation_id, array['owner']))
  with check (private.is_org_member(organisation_id, array['owner']));

drop policy family_members_select_member on public.family_members;
create policy family_members_select on public.family_members
  for select to authenticated
  using (
    family_id in (select private.my_family_ids())
    or private.is_org_member(private.family_org(family_id), array['owner'])
  );

drop policy children_select_family on public.children;
create policy children_select on public.children
  for select to authenticated
  using (
    family_id in (select private.my_family_ids())
    or private.is_org_member(organisation_id, array['owner'])
    or id in (select private.my_taught_child_ids())
  );
create policy children_insert on public.children
  for insert to authenticated
  with check (private.is_org_member(organisation_id, array['owner']));
create policy children_update on public.children
  for update to authenticated
  using (private.is_org_member(organisation_id, array['owner']))
  with check (private.is_org_member(organisation_id, array['owner']));

-- ------------------------------------------------------------------ timetable

create policy locations_select on public.locations
  for select to authenticated
  using (
    private.is_org_member(organisation_id)
    or id in (select c.location_id from public.classes c where c.id in (select private.my_family_class_ids()))
  );
create policy programs_select on public.programs
  for select to authenticated
  using (
    private.is_org_member(organisation_id)
    or id in (select c.program_id from public.classes c where c.id in (select private.my_family_class_ids()))
  );
create policy levels_select on public.levels
  for select to authenticated
  using (
    private.is_org_member(organisation_id)
    or id in (select c.level_id from public.classes c where c.id in (select private.my_family_class_ids()))
  );
create policy classes_select on public.classes
  for select to authenticated
  using (private.is_org_member(organisation_id) or id in (select private.my_family_class_ids()));
create policy class_occurrences_select on public.class_occurrences
  for select to authenticated
  using (private.is_org_member(organisation_id) or class_id in (select private.my_family_class_ids()));

do $$
declare t text;
begin
  foreach t in array array['locations', 'programs', 'levels', 'classes'] loop
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (private.is_org_member(organisation_id, array[''owner'']))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated
         using (private.is_org_member(organisation_id, array[''owner'']))
         with check (private.is_org_member(organisation_id, array[''owner'']))', t);
  end loop;
end $$;

create policy class_occurrences_update on public.class_occurrences
  for update to authenticated
  using (private.is_org_member(organisation_id, array['owner']))
  with check (private.is_org_member(organisation_id, array['owner']));

-- ------------------------------------------------------------------ enrolments

create policy enrolments_select on public.enrolments
  for select to authenticated
  using (
    private.is_org_member(organisation_id, array['owner'])
    or class_id in (select private.my_taught_class_ids())
    or child_id in (select ch.id from public.children ch where ch.family_id in (select private.my_family_ids()))
  );
create policy enrolments_insert on public.enrolments
  for insert to authenticated
  with check (private.is_org_member(organisation_id, array['owner']));
create policy enrolments_update on public.enrolments
  for update to authenticated
  using (private.is_org_member(organisation_id, array['owner']))
  with check (private.is_org_member(organisation_id, array['owner']));

-- ------------------------------------------------------------------ audit

create policy audit_events_select on public.audit_events
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));
