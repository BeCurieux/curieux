-- Families who might leave (docs/M8_NETWORK.md, M8e): warning signs counted
-- from the school's own records, for its owners. Fixed rules, no AI.

create table public.retention_followups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  family_id uuid not null,
  note text check (note is null or length(note) between 1 and 200),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organisation_id, family_id) references public.families (organisation_id, id) on delete cascade
);

create index retention_followups_family_idx on public.retention_followups (family_id, created_at desc);

alter table public.retention_followups enable row level security;
revoke all on public.retention_followups from anon, authenticated;
grant select on public.retention_followups to authenticated;

create policy retention_followups_select on public.retention_followups
  for select to authenticated
  using (private.is_org_member(organisation_id, array['owner']));

create trigger audit_retention_followups after insert or update or delete on public.retention_followups
  for each row execute function private.audit_change();

-- Each family with a child in a class (or paused) and at least one warning
-- sign, with its reasons; families followed up in the last 30 days are
-- left out. Most reasons first.
--   absences:        a child missed 3+ lessons in the last 6 weeks
--   credits_expired: a child's make-up credits ran out unused (8 weeks)
--   leaving:         "Not next term" for a term not started yet
--   not_answered:    no answer about a coming term after its reply-by date
--   overdue:         fees overdue by more than 2 weeks
--   paused:          a child's place is paused
create function public.families_at_risk(p_org uuid)
returns table (family_id uuid, family_name text, contact_name text, phone text, email text,
               reasons jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date;
begin
  if p_org is null or not private.is_org_member(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  today := private.school_today(p_org);
  return query
  with current_kids as (
    select distinct ch.id as child_id, ch.family_id, ch.first_name
      from public.children ch
      join public.enrolments e on e.child_id = ch.id and e.status in ('active', 'paused')
     where ch.organisation_id = p_org and ch.active
  ),
  missed as (
    select k.family_id, k.first_name, count(distinct x.occurrence_id) as n
      from current_kids k
      join (select a.child_id, a.occurrence_id from public.absences a
            union
            select t.child_id, t.occurrence_id from public.attendance t where t.status = 'absent') x
        on x.child_id = k.child_id
      join public.class_occurrences o on o.id = x.occurrence_id
     where o.starts_at >= now() - interval '42 days' and o.starts_at < now()
     group by k.family_id, k.first_name
    having count(distinct x.occurrence_id) >= 3
  ),
  lapsed as (
    select k.family_id, k.first_name, count(*) as n
      from current_kids k
      join public.makeup_credits m on m.child_id = k.child_id
     where (m.status = 'expired' or (m.status = 'available' and m.expires_at <= now()))
       and m.expires_at > now() - interval '56 days'
     group by k.family_id, k.first_name
  ),
  answers as (
    select k.family_id, k.first_name, t.name as term,
           case when r.answer = 'leave' then 'leaving' else 'not_answered' end as kind
      from current_kids k
      join public.reenrolment_asks r on r.child_id = k.child_id
      join public.terms t on t.id = r.term_id
     where t.starts_on > today and t.applied_at is null
       and (r.answer = 'leave'
            or (r.answer is null and t.asked_at is not null and t.reply_by is not null and t.reply_by < today))
  ),
  paused as (
    select k.family_id, k.first_name, c.name as class_name
      from current_kids k
      join public.enrolments e on e.child_id = k.child_id and e.status = 'paused'
      join public.classes c on c.id = e.class_id
  ),
  families_now as (
    select distinct k.family_id from current_kids k
  ),
  owing as (
    select f.family_id, private.overdue(f.family_id, today - 14) as cents
      from families_now f
  ),
  reasons as (
    select m.family_id, jsonb_build_object('kind', 'absences', 'child', m.first_name, 'count', m.n) as r, 2 as weight from missed m
    union all
    select l.family_id, jsonb_build_object('kind', 'credits_expired', 'child', l.first_name, 'count', l.n), 1 from lapsed l
    union all
    select a.family_id, jsonb_build_object('kind', a.kind, 'child', a.first_name, 'term', a.term),
           case when a.kind = 'leaving' then 5 else 2 end from answers a
    union all
    select p.family_id, jsonb_build_object('kind', 'paused', 'child', p.first_name, 'class', p.class_name), 2 from paused p
    union all
    select o.family_id, jsonb_build_object('kind', 'overdue', 'cents', o.cents), 2 from owing o where o.cents > 0
  )
  select f.id, f.display_name, f.primary_contact_name, f.primary_contact_phone, f.primary_contact_email,
         jsonb_agg(r.r order by r.weight desc, r.r ->> 'child')
    from reasons r
    join public.families f on f.id = r.family_id
   where not exists (select 1 from public.retention_followups u
                      where u.family_id = f.id and u.created_at > now() - interval '30 days')
   group by f.id, f.display_name, f.primary_contact_name, f.primary_contact_phone, f.primary_contact_email
   order by sum(r.weight) desc, f.display_name;
end;
$$;

revoke all on function public.families_at_risk(uuid) from public, anon;
grant execute on function public.families_at_risk(uuid) to authenticated;

create function public.follow_up_family(p_family uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  new_id uuid;
begin
  select organisation_id into org from public.families where id = p_family;
  if org is null or not private.is_org_member(org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(v_note) > 200 then
    raise exception 'Keep the note to 200 characters.' using hint = 'followup_invalid';
  end if;
  insert into public.retention_followups (organisation_id, family_id, note, created_by)
  values (org, p_family, v_note, private.current_user_id())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.follow_up_family(uuid, text) from public, anon;
grant execute on function public.follow_up_family(uuid, text) to authenticated;
