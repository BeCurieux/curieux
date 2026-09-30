-- Getting set up (docs/M6_MIGRATION_PILOT.md, M6b): owners invite parents to
-- their family with a link; the set-up checklist on Today.

-- ------------------------------------------------------------------ invites

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  family_id uuid not null,
  email text not null check (email = lower(trim(email)) and email like '%_@_%._%'),
  -- SHA-256 of the code in the link; the code itself is never stored.
  code_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade
);

create index family_invites_family_id_idx on public.family_invites (family_id);
create index family_invites_organisation_id_idx on public.family_invites (organisation_id);

alter table public.family_invites enable row level security;

create policy family_invites_select on public.family_invites
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

revoke all on public.family_invites from anon, authenticated;
grant select (id, organisation_id, family_id, email, status, invited_by, created_at, expires_at,
              accepted_by, accepted_at)
  on public.family_invites to authenticated;

-- Invites, cancellations and joins (an invite's status becoming accepted,
-- with who accepted it) all land in the school's activity.
create trigger audit_family_invites after insert or update on public.family_invites
  for each row execute function private.audit_change();

-- An owner invites someone to a family. Returns the code for the link, once.
-- A new invite for the same email and family replaces any still pending.
create function public.invite_parent(p_family uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam record;
  addr text := lower(trim(coalesce(p_email, '')));
  code text := private.new_claim_code();
begin
  select f.id, f.organisation_id into fam from public.families f where f.id = p_family;
  if fam.id is null or not private.is_org_member(fam.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if addr !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(addr) > 254 then
    raise exception 'Enter a real email address.' using hint = 'invite_invalid';
  end if;
  if exists (
    select 1 from public.family_members fm join public.users u on u.id = fm.user_id
     where fm.family_id = fam.id and lower(u.email) = addr
  ) then
    raise exception 'That person has already joined this family.' using hint = 'invite_invalid';
  end if;

  update public.family_invites set status = 'revoked'
   where family_id = fam.id and email = addr and status = 'pending';
  insert into public.family_invites (organisation_id, family_id, email, code_hash, invited_by)
  values (fam.organisation_id, fam.id, addr, private.claim_code_hash(code), private.current_user_id());
  return code;
end;
$$;

revoke all on function public.invite_parent(uuid, text) from public, anon;
grant execute on function public.invite_parent(uuid, text) to authenticated;

create function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
begin
  select i.id, i.organisation_id into inv from public.family_invites i where i.id = p_invite;
  if inv.id is null or not private.is_org_member(inv.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.family_invites set status = 'revoked' where id = inv.id and status = 'pending';
end;
$$;

revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- What a link is for, for whoever holds it (signed in or not): the school,
-- the family's name, the email it's for and whether it can still be used.
-- Nothing about the family's children.
create function public.invite_details(p_code text)
returns table (school text, family text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, f.display_name, i.email,
         case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end
    from public.family_invites i
    join public.families f on f.id = i.family_id
    join public.organisations o on o.id = i.organisation_id
   where i.code_hash = private.claim_code_hash(p_code)
$$;

revoke all on function public.invite_details(text) from public;
grant execute on function public.invite_details(text) to anon, authenticated;

-- The signed-in person joins the family, if the link is theirs.
create function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  me record;
begin
  select u.id, lower(u.email) as email into me from public.users u where u.auth_id = auth.uid();
  if me.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select i.* into inv from public.family_invites i
   where i.code_hash = private.claim_code_hash(p_code) for update;
  if inv.id is null or inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception 'This invite can''t be used any more. Ask the school for a new one.'
      using hint = 'invite_closed';
  end if;
  if inv.email <> me.email then
    raise exception 'This invite is for a different email address.' using hint = 'invite_wrong_email';
  end if;

  if not exists (select 1 from public.family_members where family_id = inv.family_id and user_id = me.id) then
    insert into public.family_members (family_id, user_id, relationship, is_primary_guardian)
    values (inv.family_id, me.id, 'parent',
            not exists (select 1 from public.family_members where family_id = inv.family_id and is_primary_guardian));
  end if;
  update public.family_invites set status = 'accepted', accepted_by = me.id, accepted_at = now()
   where id = inv.id;
  return inv.family_id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ------------------------------------------------------------------ the checklist

-- How far a school is through setting up, for its owners' Today.
create function public.setup_progress(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'locations', (select count(*) from public.locations where organisation_id = p_org and active),
    'levels', (select count(*) from public.levels where organisation_id = p_org and active),
    'makeup_rules', exists (select 1 from public.policy_sets where organisation_id = p_org and policy_type = 'makeup'),
    'instructors', (select count(*) from public.staff_memberships
                     where organisation_id = p_org and role = 'instructor' and status = 'active'),
    'classes', (select count(*) from public.classes where organisation_id = p_org and active),
    'families', (select count(*) from public.families where organisation_id = p_org),
    'families_joined', (select count(distinct fm.family_id) from public.family_members fm
                          join public.families f on f.id = fm.family_id where f.organisation_id = p_org),
    'invites_pending', (select count(*) from public.family_invites
                         where organisation_id = p_org and status = 'pending' and expires_at > now())
  );
end;
$$;

revoke all on function public.setup_progress(uuid) from public, anon;
grant execute on function public.setup_progress(uuid) to authenticated;

-- ------------------------------------------------------------------ who has joined

-- The parents who have joined a family: name and email only, for the
-- school's owners. Owners still can't read parents' accounts directly.
create function public.family_parents(p_family uuid)
returns table (user_id uuid, name text, email text, is_primary_guardian boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_org_member(private.family_org(p_family), array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select u.id, u.name, u.email, fm.is_primary_guardian
      from public.family_members fm join public.users u on u.id = fm.user_id
     where fm.family_id = p_family
     order by fm.is_primary_guardian desc, u.name;
end;
$$;

revoke all on function public.family_parents(uuid) from public, anon;
grant execute on function public.family_parents(uuid) to authenticated;
