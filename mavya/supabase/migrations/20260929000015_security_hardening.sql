-- M2.5 security hardening (docs/SECURITY.md).
--
-- 1. Staff removal: an owner can take away a staff member's access at once.
-- 2. Sign-in throttling: repeated failed sign-ins are slowed down per email
--    and per network address.
-- 3. Staff memberships are audited like every other tenant table.

-- ------------------------------------------------------------------ audit

create trigger audit_staff_memberships after insert or update or delete on public.staff_memberships
  for each row execute function private.audit_change();

-- ------------------------------------------------------------------ staff removal

-- Suspends the membership, takes the person off their classes and signs them
-- out everywhere. Access stops at once either way, because every access rule
-- and the app's role lookup only count active memberships; ending their
-- sessions also stops them refreshing a token they already hold.
create function public.remove_staff_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.staff_memberships;
begin
  select * into target from public.staff_memberships where id = p_membership_id for update;
  if target.id is null or not private.is_org_member(target.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target.user_id = private.current_user_id() then
    raise exception 'You can''t remove your own access.' using hint = 'remove_self';
  end if;
  if target.status <> 'active' then
    return;
  end if;

  update public.staff_memberships set status = 'suspended' where id = target.id;
  update public.classes set instructor_id = null
   where organisation_id = target.organisation_id and instructor_id = target.id;
  delete from auth.sessions s
   using public.users u
   where u.id = target.user_id and s.user_id = u.auth_id;
end;
$$;

-- Undoes a removal. Classes stay unassigned; the owner gives them back.
create function public.restore_staff_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.staff_memberships;
begin
  select * into target from public.staff_memberships where id = p_membership_id for update;
  if target.id is null or not private.is_org_member(target.organisation_id, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target.status = 'suspended' then
    update public.staff_memberships set status = 'active' where id = target.id;
  end if;
end;
$$;

revoke all on function public.remove_staff_member(uuid) from public, anon;
revoke all on function public.restore_staff_member(uuid) from public, anon;
grant execute on function public.remove_staff_member(uuid) to authenticated;
grant execute on function public.restore_staff_member(uuid) to authenticated;

-- ------------------------------------------------------------------ sign-in throttling

-- Sign-in runs on the server, so Supabase Auth's own per-address limit sees
-- the server's address rather than the person's. This table limits failed
-- attempts per email and per client address instead. Emails are stored only
-- as a hash, and rows older than a day are cleared as new ones arrive.
create table private.sign_in_failures (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index sign_in_failures_email_idx on private.sign_in_failures (email_hash, created_at);
create index sign_in_failures_ip_idx on private.sign_in_failures (ip, created_at);

alter table private.sign_in_failures enable row level security;
revoke all on private.sign_in_failures from public, anon, authenticated;

create function private.email_hash(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex')
$$;

-- An empty address means the server couldn't tell; only the email counts.
-- Five failures for one email, or fifty from one address, in fifteen
-- minutes pause further attempts. The same answer whether or not the email
-- has an account, so the limit reveals nothing about who signs in here.
create function public.sign_in_allowed(p_email text, p_ip text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from private.sign_in_failures
      where email_hash = private.email_hash(p_email)
        and created_at > now() - interval '15 minutes') < 5
    and (coalesce(p_ip, '') = '' or (select count(*) from private.sign_in_failures
      where ip = p_ip and created_at > now() - interval '15 minutes') < 50)
$$;

create function public.record_sign_in(p_email text, p_ip text, p_succeeded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_succeeded then
    delete from private.sign_in_failures where email_hash = private.email_hash(p_email);
  else
    insert into private.sign_in_failures (email_hash, ip) values (private.email_hash(p_email), nullif(p_ip, ''));
  end if;
  delete from private.sign_in_failures where created_at < now() - interval '1 day';
end;
$$;

-- Only the app's server may call these, never a browser.
revoke all on function private.email_hash(text) from public;
revoke all on function public.sign_in_allowed(text, text) from public, anon, authenticated;
revoke all on function public.record_sign_in(text, text, boolean) from public, anon, authenticated;
grant execute on function public.sign_in_allowed(text, text) to service_role;
grant execute on function public.record_sign_in(text, text, boolean) to service_role;
