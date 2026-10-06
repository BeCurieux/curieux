-- Try it yourself (docs/TRY_IT_YOURSELF.md): a visitor to the website gets
-- their own pretend swim school, full of example families and classes, to
-- click around as its owner. Each one is deleted a day later. Nothing in a
-- pretend school reaches the real world: no emails, no invites, no public
-- page, no payments.

-- A pretend school has a time it's deleted; real schools (and the seeded
-- demo schools) don't.
alter table public.organisations add column demo_expires_at timestamptz;
alter table public.organisations
  add constraint organisations_demo_expiry_needs_demo check (demo_expires_at is null or is_demo);

create index organisations_demo_expires_idx on public.organisations (demo_expires_at)
  where demo_expires_at is not null;

-- Who started one, so one browser can't make hundreds: a one-way hash of
-- their internet address, never the address itself. Kept a week.
create table public.demo_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text not null check (length(visitor_hash) between 16 and 128),
  organisation_id uuid references public.organisations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index demo_visits_visitor_idx on public.demo_visits (visitor_hash, created_at desc);

alter table public.demo_visits enable row level security;
revoke all on public.demo_visits from anon, authenticated;

create function private.is_sandbox(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organisations where id = p_org and demo_expires_at is not null)
$$;

revoke all on function private.is_sandbox(uuid) from public;

-- ------------------------------------------------------------------ making one

-- Fills a new pretend school: a pool, four levels, six classes, families
-- with children, a month of past lessons with attendance, make-up credits,
-- a waiting list that wants a new Saturday class, fees (two families
-- behind), and a family showing warning signs.
create function private.build_demo_school(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc uuid;
  prog uuid;
  lv uuid[] := '{}';
  lid uuid;
  cls uuid[] := '{}';
  cid uuid;
  fam uuid;
  kid uuid;
  occ record;
  i integer;
  -- level (1-4), weekday, start, name
  class_defs text[][] := array[
    array['1', '1', '15:30', 'Starfish Mon 3:30'],
    array['2', '1', '16:00', 'Seahorse Mon 4:00'],
    array['3', '3', '15:30', 'Dolphin Wed 3:30'],
    array['1', '3', '16:00', 'Starfish Wed 4:00'],
    array['2', '6', '08:30', 'Seahorse Sat 8:30'],
    array['3', '6', '09:00', 'Dolphin Sat 9:00']
  ];
  -- family, contact, phone, children as first:birth year:class (0 = waiting)
  family_defs text[][] := array[
    array['Harper', 'Jess Harper', '0400 100 201', 'Mia:2018:3'],
    array['Nguyen', 'Linh Nguyen', '0400 100 202', 'Oscar:2019:2'],
    array['Burrows', 'Sam Burrows', '0400 100 203', 'Ava:2019:6'],
    array['Patel', 'Priya Patel', '0400 100 204', 'Arjun:2018:6'],
    array['Kelly', 'Rachel Kelly', '0400 100 205', 'Finn:2020:1'],
    array['Rossi', 'Marco Rossi', '0400 100 206', 'Luca:2019:6'],
    array['Smith', 'Emma Smith', '0400 100 207', 'Isla:2020:4'],
    array['Okafor', 'Ade Okafor', '0400 100 208', 'Zara:2018:6'],
    array['Brown', 'Tom Brown', '0400 100 209', 'Charlie:2020:1'],
    array['Wilson', 'Kate Wilson', '0400 100 210', 'Ruby:2019:5'],
    array['Chen', 'Wei Chen', '0400 100 211', 'Leo:2019:0'],
    array['Murphy', 'Claire Murphy', '0400 100 212', 'Ella:2018:0'],
    array['Taylor', 'Ben Taylor', '0400 100 213', 'Max:2019:0']
  ];
  f text[];
  parts text[];
  kids uuid[] := '{}';
  kid_class integer[] := '{}';
  waiting uuid[] := '{}';
  waiting_fam uuid[] := '{}';
  fams uuid[] := '{}';
  enrol uuid;
  week integer;
begin
  insert into public.locations (organisation_id, name, suburb, state, postcode, timezone)
  values (p_org, 'Seaside pool', 'Erina', 'NSW', '2250', 'Australia/Sydney')
  returning id into loc;
  insert into public.programs (organisation_id, name) values (p_org, 'Learn to swim')
  returning id into prog;
  for i in 1..4 loop
    insert into public.levels (organisation_id, program_id, name, sort_order)
    values (p_org, prog, (array['Starfish', 'Seahorse', 'Dolphin', 'Shark'])[i], i)
    returning id into lid;
    lv := lv || lid;
  end loop;

  for i in 1..array_length(class_defs, 1) loop
    insert into public.classes (organisation_id, location_id, program_id, level_id, name, weekday,
                                start_time, duration_minutes, capacity, price_per_lesson_cents)
    values (p_org, loc, prog, lv[class_defs[i][1]::integer], class_defs[i][4], class_defs[i][2]::integer,
            class_defs[i][3]::time, 30, 4, 2600)
    returning id into cid;
    cls := cls || cid;
  end loop;

  i := 0;
  foreach f slice 1 in array family_defs loop
    i := i + 1;
    insert into public.families (organisation_id, display_name, primary_contact_name,
                                 primary_contact_email, primary_contact_phone)
    values (p_org, f[1] || ' Family', f[2],
            lower(split_part(f[2], ' ', 1)) || '.' || lower(f[1]) || '@example.com', f[3])
    returning id into fam;
    fams := fams || fam;
    parts := string_to_array(f[4], ':');
    insert into public.children (organisation_id, family_id, first_name, last_name, date_of_birth)
    values (p_org, fam, parts[1], f[1], make_date(parts[2]::integer, 1 + (i * 5) % 12, 1 + (i * 7) % 27))
    returning id into kid;
    if parts[3]::integer = 0 then
      waiting := waiting || kid;
      waiting_fam := waiting_fam || fam;
    else
      kids := kids || kid;
      kid_class := kid_class || parts[3]::integer;
      insert into public.enrolments (organisation_id, child_id, class_id, starts_at)
      values (p_org, kid, cls[parts[3]::integer], current_date - 60)
      returning id into enrol;
    end if;
  end loop;

  -- Two more in the Monday Starfish class, so it looks lived in.
  insert into public.children (organisation_id, family_id, first_name, last_name, date_of_birth)
  values (p_org, fams[5], 'Poppy', 'Kelly', make_date(2021, 3, 14)) returning id into kid;
  kids := kids || kid; kid_class := kid_class || 1;
  insert into public.enrolments (organisation_id, child_id, class_id, starts_at)
  values (p_org, kid, cls[1], current_date - 60);
  insert into public.children (organisation_id, family_id, first_name, last_name, date_of_birth)
  values (p_org, fams[9], 'Henry', 'Brown', make_date(2021, 9, 2)) returning id into kid;
  kids := kids || kid; kid_class := kid_class || 4;
  insert into public.enrolments (organisation_id, child_id, class_id, starts_at)
  values (p_org, kid, cls[4], current_date - 60);

  -- Oscar's place is paused.
  update public.enrolments set status = 'paused' where child_id = kids[2];

  -- The last four weeks of lessons, with attendance. Mia has missed the
  -- last three.
  for i in 1..array_length(cls, 1) loop
    for week in 1..4 loop
      insert into public.class_occurrences (organisation_id, class_id, starts_at, ends_at, status)
      select p_org, c.id, s, s + interval '30 minutes', 'completed'
        from public.classes c,
             lateral (select ((current_date - week * 7
                               - ((extract(isodow from current_date)::integer - c.weekday + 7) % 7))
                              + c.start_time) at time zone 'Australia/Sydney' as s) t
       where c.id = cls[i] and t.s < now()
      on conflict (class_id, starts_at) do nothing;
    end loop;
  end loop;
  for occ in
    select o.id, o.class_id, o.starts_at,
           row_number() over (partition by o.class_id order by o.starts_at desc) as recent
      from public.class_occurrences o
     where o.organisation_id = p_org and o.status = 'completed'
  loop
    for i in 1..array_length(kids, 1) loop
      if cls[kid_class[i]] = occ.class_id and i <> 2 then
        insert into public.attendance (organisation_id, occurrence_id, child_id, status, recorded_at)
        values (p_org, occ.id, kids[i],
                case when i = 1 and occ.recent <= 3 then 'absent' else 'present' end,
                occ.starts_at + interval '5 minutes');
      end if;
    end loop;
  end loop;

  -- Make-up credits: Finn's from a missed lesson, Isla's running out soon.
  insert into public.makeup_credits (organisation_id, child_id, reason, issued_at, expires_at, status)
  values (p_org, kids[5], 'absence', now() - interval '6 days', now() + interval '50 days', 'available'),
         (p_org, kids[7], 'absence', now() - interval '52 days', now() + interval '4 days', 'available');

  -- Three families waiting for a Saturday Dolphin place, where the class is full.
  for i in 1..array_length(waiting, 1) loop
    insert into public.place_wishes (organisation_id, family_id, child_id, level_id, location_id,
                                     weekdays, earliest, latest, note, created_at)
    values (p_org, waiting_fam[i], waiting[i], lv[3], loc, array[6], '08:30', '10:00',
            case i when 1 then 'Saturdays only, both parents work' end,
            now() - make_interval(days => 20 - i * 5));
  end loop;

  -- This term's fees: everyone charged; most have paid, two are behind.
  for i in 1..array_length(fams, 1) - 3 loop
    insert into public.ledger_entries (organisation_id, family_id, kind, amount_cents, description, due_on,
                                       created_at)
    values (p_org, fams[i], 'charge', 26000, 'Term 4 lessons (10 × $26)', current_date - 21,
            now() - interval '35 days');
    if i not in (1, 6) then
      insert into public.ledger_entries (organisation_id, family_id, kind, amount_cents, description,
                                         method, paid_on, created_at)
      values (p_org, fams[i], 'payment', -26000, 'Paid by bank transfer', 'bank_transfer',
              current_date - 25 + i, now() - make_interval(days => 25 - i));
    end if;
  end loop;
end;
$$;

revoke all on function private.build_demo_school(uuid) from public;

-- Called by the website (with the secret key) for a visitor who has just
-- been given a throwaway sign-in: makes their school, makes them its owner
-- and fills it. At most 5 a day from one visitor, and 300 at once.
create function public.create_demo_school(p_user uuid, p_visitor text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  if p_user is null or p_visitor is null or length(p_visitor) < 16 then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.demo_visits
       where visitor_hash = p_visitor and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You''ve made a few demo schools today. Try again tomorrow, or email hello@ovyko.com.au.'
      using hint = 'demo_busy';
  end if;
  if (select count(*) from public.organisations where demo_expires_at > now()) >= 300 then
    raise exception 'Lots of people are trying Ovyko right now. Try again in a little while.'
      using hint = 'demo_busy';
  end if;

  insert into public.organisations (name, slug, activity_type, owner_two_step_required, is_demo,
                                    demo_expires_at)
  values ('Seaside Swim School', 'try-' || replace(gen_random_uuid()::text, '-', ''), 'swimming',
          false, true, now() + interval '1 day')
  returning id into org;
  insert into public.staff_memberships (user_id, organisation_id, role) values (p_user, org, 'owner');
  perform private.build_demo_school(org);
  insert into public.demo_visits (visitor_hash, organisation_id) values (p_visitor, org);
  return org;
end;
$$;

revoke all on function public.create_demo_school(uuid, text) from public, anon, authenticated;
grant execute on function public.create_demo_school(uuid, text) to service_role;

-- ------------------------------------------------------------------ cleaning up

-- Every hour: pretend schools past their time go, with everything in them,
-- and so do their throwaway sign-ins. Visits are kept a week. Callable
-- with the secret key too, so the tests can run it.
create function public.forget_demo_schools()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  tbl regclass;
  pass integer;
begin
  for org in select id from public.organisations where demo_expires_at < now() loop
    -- Audited rows first, while the school still exists for their audit
    -- entries to point at; then the audit trail; then the school itself.
    -- Some tables must be emptied before others, so go round until done.
    for pass in 1..6 loop
      for tbl in
        select distinct t.tgrelid::regclass
          from pg_trigger t
          join pg_attribute a on a.attrelid = t.tgrelid and a.attname = 'organisation_id'
         where t.tgfoid = 'private.audit_change'::regproc
      loop
        begin
          execute format('delete from %s where organisation_id = $1', tbl) using org;
        exception when foreign_key_violation then
          null;
        end;
      end loop;
    end loop;
    delete from public.audit_events where organisation_id = org;
    delete from public.organisations where id = org;
  end loop;
  delete from auth.users u
   where u.email like 'try-%@demo.ovyko.invalid'
     and u.created_at < now() - interval '1 hour'
     and not exists (
       select 1 from public.users p join public.staff_memberships m on m.user_id = p.id
        where p.auth_id = u.id);
  delete from public.demo_visits where created_at < now() - interval '7 days';
end;
$$;

revoke all on function public.forget_demo_schools() from public, anon, authenticated;
grant execute on function public.forget_demo_schools() to service_role;

select cron.schedule('ovyko-forget-demo-schools', '17 * * * *', 'select public.forget_demo_schools()');

-- ------------------------------------------------------------------ keeping it pretend

-- No invites: they would email a real person.
create function private.no_invites_in_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_sandbox(new.organisation_id) then
    raise exception 'Invites are switched off in the demo, so no one gets a real email.'
      using hint = 'demo_off';
  end if;
  return new;
end;
$$;

revoke all on function private.no_invites_in_demo() from public;

create trigger family_invites_not_in_demo before insert on public.family_invites
  for each row execute function private.no_invites_in_demo();

-- No public waiting-list page: it would put a visitor's words on the web.
create function private.no_public_page_in_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.waitlist_page_on and new.demo_expires_at is not null then
    raise exception 'The public waiting-list page is switched off in the demo.' using hint = 'demo_off';
  end if;
  return new;
end;
$$;

revoke all on function private.no_public_page_in_demo() from public;

create trigger organisations_no_public_page_in_demo before insert or update of waitlist_page_on
  on public.organisations
  for each row execute function private.no_public_page_in_demo();

-- No payments: no school's card details or plan in a pretend school.
create function private.no_payments_in_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_sandbox(new.organisation_id) then
    raise exception 'Payments are switched off in the demo.' using hint = 'demo_off';
  end if;
  return new;
end;
$$;

revoke all on function private.no_payments_in_demo() from public;

create trigger payment_accounts_not_in_demo before insert on public.payment_accounts
  for each row execute function private.no_payments_in_demo();
create trigger school_subscriptions_not_in_demo before insert on public.school_subscriptions
  for each row execute function private.no_payments_in_demo();

-- No emails: anything queued for a pretend school, or for a throwaway
-- sign-in, is skipped instead of sent.
create or replace function public.claim_email_deliveries(p_limit integer default 50)
returns setof public.email_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_deliveries
     set status = 'skipped', error = 'More than a day late.'
   where status = 'pending' and created_at < now() - interval '1 day';

  update public.email_deliveries e
     set status = 'skipped', error = 'A demo school: nothing is sent.'
   where e.status = 'pending'
     and (private.is_sandbox(e.organisation_id)
          or exists (select 1 from public.users u
                      where u.id = e.recipient_user_id and u.email like '%@demo.ovyko.invalid'));

  return query
    update public.email_deliveries d
       set status = 'sending', attempts = d.attempts + 1, locked_at = now()
     where d.id in (
       select e.id from public.email_deliveries e
        where (e.status = 'pending' and e.next_attempt_at <= now())
           or (e.status = 'sending' and e.locked_at < now() - interval '10 minutes')
        order by e.created_at
        limit greatest(1, least(coalesce(p_limit, 50), 200))
        for update skip locked
     )
    returning d.*;
end;
$$;

revoke all on function public.claim_email_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_email_deliveries(integer) to service_role;
