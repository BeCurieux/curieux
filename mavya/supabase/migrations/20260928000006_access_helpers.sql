-- Access helpers used by row level security policies.
--
-- They live in the private schema, which PostgREST does not expose, so they
-- cannot be called over the API. They are security definer so a policy on
-- one table can consult another without that table's own policy recursing
-- back into this one. Each pins search_path to '' and qualifies every name.

create function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public.users u where u.auth_id = (select auth.uid())
$$;

-- True when the signed-in user holds an active membership of the
-- organisation in one of the given roles.
create function private.is_org_member(
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
    where m.organisation_id = org_id
      and m.user_id = private.current_user_id()
      and m.status = 'active'
      and m.role = any (roles)
  )
$$;

-- True when the signed-in user belongs to the family.
create function private.is_family_member(fam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = fam_id
      and fm.user_id = private.current_user_id()
  )
$$;

revoke all on function private.current_user_id() from public;
revoke all on function private.is_org_member(uuid, text[]) from public;
revoke all on function private.is_family_member(uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.current_user_id() to authenticated;
grant execute on function private.is_org_member(uuid, text[]) to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;
