-- Support access (docs/M6_MIGRATION_PILOT.md, M6g). A school's owner lets
-- Ovyko support in for 48 hours; while it's open, the people who run Ovyko
-- (platform admins, after two-step sign-in) see how the school is set up,
-- never who is in it. Read only, and every look is recorded for the owner.

create table public.support_grants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  granted_by uuid references public.users (id) on delete set null,
  note text check (note is null or length(note) between 1 and 500),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_grants_org_idx on public.support_grants (organisation_id, created_at desc);
-- At most one grant not yet ended per school; it may have run out.
create unique index support_grants_one_open on public.support_grants (organisation_id)
  where ended_at is null;

alter table public.support_grants enable row level security;
revoke all on public.support_grants from anon, authenticated;
grant select on public.support_grants to authenticated;

create policy support_grants_select on public.support_grants
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

create trigger audit_support_grants after insert or update or delete on public.support_grants
  for each row execute function private.audit_change();

-- A look by support is recorded as its own kind of audit event.
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check
    check (action in ('insert', 'update', 'delete', 'export', 'support_view'));

-- Whether support may look at a school right now.
create function private.support_open(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.support_grants
                  where organisation_id = p_org and ended_at is null and expires_at > now())
$$;

revoke all on function private.support_open(uuid) from public;

-- ------------------------------------------------------------------ for owners

-- Lets support in for 48 hours from now, or restarts the 48 hours.
create function public.grant_support_access(p_org uuid, p_note text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ends timestamptz := now() + interval '48 hours';
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(v_note) > 500 then
    raise exception 'Keep the note to 500 characters.' using hint = 'support_invalid';
  end if;
  update public.support_grants
     set expires_at = ends, note = coalesce(v_note, note), granted_by = private.current_user_id(),
         updated_at = now()
   where organisation_id = p_org and ended_at is null;
  if not found then
    insert into public.support_grants (organisation_id, granted_by, note, expires_at)
    values (p_org, private.current_user_id(), v_note, ends);
  end if;
  return ends;
end;
$$;

revoke all on function public.grant_support_access(uuid, text) from public, anon;
grant execute on function public.grant_support_access(uuid, text) to authenticated;

create function public.end_support_access(p_org uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.support_grants
     set ended_at = least(now(), expires_at), ended_by = private.current_user_id(), updated_at = now()
   where organisation_id = p_org and ended_at is null;
  return found;
end;
$$;

revoke all on function public.end_support_access(uuid) from public, anon;
grant execute on function public.end_support_access(uuid) to authenticated;

-- Who at Ovyko looked at the school, and when, for its owners.
create function public.support_looks(p_org uuid)
returns table (looked_at timestamptz, looked_by text)
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
    select a.created_at, coalesce(u.name, 'Ovyko support')
      from public.audit_events a
      left join public.users u on u.id = a.actor_user_id
     where a.organisation_id = p_org and a.action = 'support_view'
     order by a.created_at desc
     limit 50;
end;
$$;

revoke all on function public.support_looks(uuid) from public, anon;
grant execute on function public.support_looks(uuid) to authenticated;

-- ------------------------------------------------------------------ for Ovyko support

-- The schools that have let support in right now. Only they are named.
create function public.support_schools()
returns table (organisation_id uuid, name text, note text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select o.id, o.name, g.note, g.expires_at
      from public.support_grants g join public.organisations o on o.id = g.organisation_id
     where g.ended_at is null and g.expires_at > now()
     order by g.expires_at;
end;
$$;

revoke all on function public.support_schools() from public, anon;
grant execute on function public.support_schools() to authenticated;

-- How a school is set up, never who is in it: no child, parent or family is
-- named. Each look is recorded on the school.
create function public.support_school_view(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.organisations;
  result jsonb;
begin
  if p_org is null or not private.is_platform_admin() or not private.support_open(p_org) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into o from public.organisations where id = p_org;
  insert into public.audit_events (actor_user_id, organisation_id, action, entity_type, entity_id)
  values (private.current_user_id(), p_org, 'support_view', 'organisations', p_org);

  result := jsonb_build_object(
    'school', jsonb_build_object(
      'name', o.name, 'activity_type', o.activity_type, 'timezone', o.timezone,
      'status', o.status, 'created_at', o.created_at, 'is_demo', o.is_demo,
      'lessons_in_term_only', o.lessons_in_term_only, 'fee_reminders', o.fee_reminders,
      'instalments_on', o.instalments_on, 'voucher_schemes', to_jsonb(o.voucher_schemes),
      'owner_two_step_required', o.owner_two_step_required),
    'grant', (select jsonb_build_object('note', g.note, 'expires_at', g.expires_at)
                from public.support_grants g
               where g.organisation_id = p_org and g.ended_at is null),
    'staff', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
                from (select role, count(*) as n from public.staff_memberships
                       where organisation_id = p_org and status = 'active' group by role) s),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
                      'name', l.name, 'suburb', l.suburb, 'timezone', l.timezone, 'active', l.active)
                    order by l.name), '[]'::jsonb)
                    from public.locations l where l.organisation_id = p_org),
    'levels', (select coalesce(jsonb_agg(jsonb_build_object(
                   'program', p.name, 'level', lv.name, 'active', lv.active)
                 order by p.name, lv.sort_order), '[]'::jsonb)
                 from public.levels lv join public.programs p on p.id = lv.program_id
                where lv.organisation_id = p_org),
    'classes', (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', c.name, 'level', lv.name, 'location', l.name,
                    'weekday', c.weekday, 'start_time', c.start_time,
                    'duration_minutes', c.duration_minutes, 'capacity', c.capacity,
                    'enrolled', (select count(*) from public.enrolments e
                                  where e.class_id = c.id and e.status = 'active'),
                    'has_instructor', c.instructor_id is not null,
                    'price_per_lesson_cents', c.price_per_lesson_cents, 'active', c.active)
                  order by c.weekday, c.start_time, c.name), '[]'::jsonb)
                  from public.classes c
                  join public.levels lv on lv.id = c.level_id
                  join public.locations l on l.id = c.location_id
                 where c.organisation_id = p_org),
    'terms', (select coalesce(jsonb_agg(jsonb_build_object(
                  'name', t.name, 'starts_on', t.starts_on, 'ends_on', t.ends_on,
                  'asked', t.asked_at is not null, 'applied', t.applied_at is not null)
                order by t.starts_on), '[]'::jsonb)
                from public.terms t where t.organisation_id = p_org),
    'families', jsonb_build_object(
      'count', (select count(*) from public.families where organisation_id = p_org),
      'joined', (select count(distinct fm.family_id) from public.family_members fm
                   join public.families f on f.id = fm.family_id where f.organisation_id = p_org),
      'children_enrolled', (select count(distinct child_id) from public.enrolments
                             where organisation_id = p_org and status = 'active')),
    'payments', (select jsonb_build_object(
                     'connected', true, 'charges_enabled', a.charges_enabled,
                     'payouts_enabled', a.payouts_enabled, 'details_submitted', a.details_submitted)
                   from public.payment_accounts a where a.organisation_id = p_org),
    'plan', (select jsonb_build_object(
                 'status', s.status, 'locations', s.locations, 'trial_end', s.trial_end,
                 'current_period_end', s.current_period_end,
                 'cancel_at_period_end', s.cancel_at_period_end)
               from public.school_subscriptions s where s.organisation_id = p_org),
    'trial_ends', private.trial_ends(p_org),
    'imports', (select coalesce(jsonb_agg(jsonb_build_object(
                    'created_at', b.created_at, 'counts', b.counts,
                    'problems', jsonb_array_length(case when jsonb_typeof(b.problems) = 'array'
                                                        then b.problems else '[]'::jsonb end),
                    'undone', b.undone_at is not null)
                  order by b.created_at desc), '[]'::jsonb)
                  from (select * from public.import_batches where organisation_id = p_org
                         order by created_at desc limit 5) b),
    'emails_7d', (select coalesce(jsonb_agg(jsonb_build_object(
                      'kind', kind, 'status', status, 'count', n) order by kind, status), '[]'::jsonb)
                    from (select kind, status, count(*) as n from public.email_deliveries
                           where organisation_id = p_org and created_at > now() - interval '7 days'
                           group by kind, status) e)
  );
  return result;
end;
$$;

revoke all on function public.support_school_view(uuid) from public, anon;
grant execute on function public.support_school_view(uuid) to authenticated;
