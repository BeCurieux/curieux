-- Who may read what, and nothing else.
--
-- M0 has no write paths from the app: data is created by the seed script
-- with the service role. So signed-in users get SELECT only, anonymous
-- visitors get nothing, and every row they can see is further narrowed by
-- the policies below.
--
-- Staff see no families or children in M0. The relationship that would
-- justify it (an enrolment in one of their classes) does not exist yet, and
-- granting it early would be over-permitting.

revoke all on public.users, public.organisations, public.staff_memberships,
  public.families, public.family_members, public.children
  from anon, authenticated;

grant select on public.users, public.organisations, public.staff_memberships,
  public.families, public.family_members, public.children
  to authenticated;

-- users: your own row only.
create policy users_select_self on public.users
  for select to authenticated
  using (auth_id = (select auth.uid()));

-- organisations: active staff of that organisation.
create policy organisations_select_staff on public.organisations
  for select to authenticated
  using (private.is_org_member(id));

-- staff_memberships: your own, and owners see everyone in their organisation.
create policy staff_memberships_select_self on public.staff_memberships
  for select to authenticated
  using (user_id = (select private.current_user_id()));

create policy staff_memberships_select_owner on public.staff_memberships
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

-- families, family_members, children: members of that family only.
create policy families_select_member on public.families
  for select to authenticated
  using (private.is_family_member(id));

create policy family_members_select_member on public.family_members
  for select to authenticated
  using (private.is_family_member(family_id));

create policy children_select_family on public.children
  for select to authenticated
  using (private.is_family_member(family_id));
