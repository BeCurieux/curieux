-- One read policy on staff_memberships instead of two.
--
-- Postgres evaluates every permissive policy separately for each row, so two
-- SELECT policies for the same role cost two checks. Supabase's advisor
-- flags this (multiple_permissive_policies). Merging them into one OR keeps
-- exactly the same access: your own memberships, plus everyone in an
-- organisation you own.

drop policy staff_memberships_select_self on public.staff_memberships;
drop policy staff_memberships_select_owner on public.staff_memberships;

create policy staff_memberships_select on public.staff_memberships
  for select to authenticated
  using (
    user_id = (select private.current_user_id())
    or private.is_org_member(organisation_id, array['owner'])
  );
