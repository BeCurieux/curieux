-- A livelier pretend school for Try it yourself (docs/TRY_IT_YOURSELF.md).
-- Visitors landed on a home screen of zeros: no spots to fill, no
-- make-ups delivered, nothing collected. Now each pretend school has
-- classes today and later this week (whatever day it's made), two children
-- away this week whose places are ready to offer, two make-ups that
-- already happened, and four families who paid online this month.

create or replace function private.build_demo_school(p_org uuid)
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
  -- level (1-4), which day (1-3, see days), start. The Starfish classes
  -- are in two and five days, so their spots below are always this week.
  class_defs text[][] := array[
    array['1', '2', '15:30'],
    array['2', '1', '16:00'],
    array['3', '1', '15:30'],
    array['1', '3', '16:00'],
    array['2', '3', '08:30'],
    array['3', '3', '09:00']
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
  today date := (now() at time zone 'Australia/Sydney')::date;
  -- Classes run today, in two days and in five, whatever day it is, so
  -- there's always something on this week.
  days integer[];
  day_names text[] := array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  wd integer;
  lesson uuid;
  credit uuid;
  booking uuid;
  paid uuid;
begin
  days := array[extract(isodow from today)::integer,
                (extract(isodow from today)::integer + 1) % 7 + 1,
                (extract(isodow from today)::integer + 4) % 7 + 1];
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
    wd := days[class_defs[i][2]::integer];
    insert into public.classes (organisation_id, location_id, program_id, level_id, name, weekday,
                                start_time, duration_minutes, capacity, price_per_lesson_cents)
    values (p_org, loc, prog, lv[class_defs[i][1]::integer],
            (array['Starfish', 'Seahorse', 'Dolphin', 'Shark'])[class_defs[i][1]::integer] || ' '
              || day_names[wd] || ' ' || to_char(class_defs[i][3]::time, 'FMHH12:MI'),
            wd, class_defs[i][3]::time, 30, 4, 2600)
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

  -- Two more in the Starfish classes, so it looks lived in.
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
    for week in 0..4 loop
      insert into public.class_occurrences (organisation_id, class_id, starts_at, ends_at, status)
      select p_org, c.id, s, s + interval '30 minutes', 'completed'
        from public.classes c,
             lateral (select ((today - week * 7
                               - ((extract(isodow from today)::integer - c.weekday + 7) % 7))
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
       and o.starts_at > now() - interval '29 days'
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

  -- Three families waiting for a place in the full weekend-style Dolphin class, where the class is full.
  for i in 1..array_length(waiting, 1) loop
    insert into public.place_wishes (organisation_id, family_id, child_id, level_id, location_id,
                                     weekdays, earliest, latest, note, created_at)
    values (p_org, waiting_fam[i], waiting[i], lv[3], loc, array[days[3]], '08:30', '10:00',
            case i when 1 then 'Mornings only, both parents work' end,
            now() - make_interval(days => 20 - i * 5));
  end loop;

  -- This term's fees: everyone charged; most have paid, two are behind.
  for i in 1..array_length(fams, 1) - 3 loop
    insert into public.ledger_entries (organisation_id, family_id, kind, amount_cents, description, due_on,
                                       created_at)
    values (p_org, fams[i], 'charge', 26000, 'Term 4 lessons (10 × $26)', current_date - 21,
            now() - interval '35 days');
    if i in (2, 3, 4, 5) then
      -- Paid online in the last few days: pretend payments, no real card.
      insert into public.online_payments (organisation_id, family_id, amount_cents, platform_fee_cents,
                                          status, stripe_account_id, method, paid_at, created_at)
      values (p_org, fams[i], 26000, 130, 'paid', 'acct_demo', 'card',
              now() - make_interval(hours => i * 9), now() - make_interval(hours => i * 9))
      returning id into paid;
      insert into public.ledger_entries (organisation_id, family_id, kind, amount_cents, description,
                                         method, paid_on, online_payment_id, created_at)
      values (p_org, fams[i], 'payment', -26000, 'Paid online by card', 'card',
              (now() - make_interval(hours => i * 9))::date, paid, now() - make_interval(hours => i * 9));
    elsif i not in (1, 6) then
      insert into public.ledger_entries (organisation_id, family_id, kind, amount_cents, description,
                                         method, paid_on, created_at)
      values (p_org, fams[i], 'payment', -26000, 'Paid by bank transfer', 'bank_transfer',
              current_date - 25 + i, now() - make_interval(days => 25 - i));
    end if;
  end loop;

  -- Make-ups that already happened: Zara and Ava each missed a Dolphin
  -- lesson and took a spot in the other Dolphin class instead.
  for i in 1..2 loop
    select o.id into lesson from public.class_occurrences o
     where o.class_id = cls[3] and o.status = 'completed'
     order by o.starts_at desc offset i - 1 limit 1;
    continue when lesson is null;
    kid := kids[case i when 1 then 8 else 3 end];
    insert into public.makeup_credits (organisation_id, child_id, reason, issued_at, expires_at, status)
    values (p_org, kid, 'absence', now() - interval '20 days', now() + interval '40 days', 'redeemed')
    returning id into credit;
    insert into public.makeup_bookings (organisation_id, child_id, credit_id, target_occurrence_id,
                                        status, booked_at)
    values (p_org, kid, credit, lesson, 'completed', now() - interval '12 days')
    returning id into booking;
    insert into public.attendance (organisation_id, occurrence_id, child_id, status, recorded_at)
    select p_org, lesson, kid, 'present', o.starts_at + interval '5 minutes'
      from public.class_occurrences o where o.id = lesson
    on conflict do nothing;
    if i = 1 then
      insert into public.vacancy_offers (organisation_id, occurrence_id, child_id, code_hash, status,
                                         expires_at, responded_at, booking_id, created_at)
      values (p_org, lesson, kid, md5(gen_random_uuid()::text), 'claimed',
              now() - interval '11 days', now() - interval '12 days', booking,
              now() - interval '12 days 1 hour');
    end if;
  end loop;

  -- This week, two children can't come: Charlie (first Starfish class)
  -- and Henry (second). Each gets a make-up credit, and their places open
  -- up for children who hold one, for the visitor to offer.
  for i in 1..2 loop
    select o.id into lesson from public.class_occurrences o
     where o.class_id = cls[case i when 1 then 1 else 4 end] and o.status = 'scheduled'
       and o.starts_at > now() + interval '3 hours'
     order by o.starts_at limit 1;
    continue when lesson is null;
    kid := kids[case i when 1 then 9 else array_length(kids, 1) end];
    insert into public.absences (organisation_id, child_id, occurrence_id, reason, make_up_eligible)
    values (p_org, kid, lesson, case i when 1 then 'Sick' else 'Family holiday' end, true)
    returning id into enrol;
    insert into public.makeup_credits (organisation_id, child_id, source_occurrence_id,
                                       source_absence_id, reason, expires_at)
    values (p_org, kid, lesson, enrol, 'absence', now() + interval '60 days');
  end loop;
end;
$$;

revoke all on function private.build_demo_school(uuid) from public;
