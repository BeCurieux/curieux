-- Reaching families (docs/M6_MIGRATION_PILOT.md, M6c): an outbox of emails
-- to send, filled by the database when something happens and by the 7am
-- lesson-day reminder job; the app's sender delivers it.

-- ------------------------------------------------------------------ reminders switch

alter table public.users add column lesson_reminders boolean not null default true;

-- The signed-in person turns their own lesson-day reminders on or off.
create function public.set_lesson_reminders(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_on is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.users set lesson_reminders = p_on where auth_id = auth.uid();
end;
$$;

revoke all on function public.set_lesson_reminders(boolean) from public, anon;
grant execute on function public.set_lesson_reminders(boolean) to authenticated;

-- ------------------------------------------------------------------ the outbox

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('spot_offered', 'lesson_cancelled', 'skill_achieved', 'lesson_reminder')),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  organisation_id uuid references public.organisations (id) on delete cascade,
  -- The notification it tells the person about; its payload has the details.
  notification_id uuid references public.notifications (id) on delete cascade,
  -- Ids only, never names (a reminder's date and lessons).
  payload jsonb not null default '{}',
  -- One reminder per person, school and day.
  dedupe_key text unique,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index email_deliveries_due_idx on public.email_deliveries (next_attempt_at)
  where status in ('pending', 'sending');
create index email_deliveries_recipient_idx on public.email_deliveries (recipient_user_id);

-- Only the server's sender (the secret key) reads or writes the outbox.
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from anon, authenticated;

-- Every notification is also an email to the same person.
create function private.queue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_deliveries (kind, recipient_user_id, organisation_id, notification_id)
  values (new.type, new.recipient_user_id, new.organisation_id, new.id);
  return null;
end;
$$;

revoke all on function private.queue_notification_email() from public;

create trigger notifications_queue_email after insert on public.notifications
  for each row execute function private.queue_notification_email();

-- ------------------------------------------------------------------ 7am reminders

-- Queues one reminder per parent and school for lessons later today, for
-- schools where it is now 7am (local time of each lesson's location).
-- Children reported away and cancelled lessons are left out; booked
-- make-ups are in. Runs hourly; the dedupe key keeps it to one a day.
-- Returns how many it queued.
create function private.queue_lesson_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  with lessons as (
    select o.id as occurrence_id, o.organisation_id, o.class_id, l.timezone,
           (p_now at time zone l.timezone)::date as local_day
      from public.class_occurrences o
      join public.classes c on c.id = o.class_id
      join public.locations l on l.id = c.location_id
     where o.status = 'scheduled'
       and o.starts_at > p_now
       and o.starts_at < p_now + interval '1 day'
       and (o.starts_at at time zone l.timezone)::date = (p_now at time zone l.timezone)::date
       and extract(hour from p_now at time zone l.timezone) = 7
  ),
  attending as (
    select ls.*, e.child_id
      from lessons ls
      join public.enrolments e on e.class_id = ls.class_id and e.status = 'active'
     where not exists (
       select 1 from public.absences a where a.occurrence_id = ls.occurrence_id and a.child_id = e.child_id
     )
    union
    select ls.*, b.child_id
      from lessons ls
      join public.makeup_bookings b on b.target_occurrence_id = ls.occurrence_id and b.status = 'booked'
  ),
  queued_rows as (
    insert into public.email_deliveries (kind, recipient_user_id, organisation_id, payload, dedupe_key)
    select 'lesson_reminder', fm.user_id, a.organisation_id,
           jsonb_build_object(
             'date', min(a.local_day),
             'lessons', jsonb_agg(distinct jsonb_build_object('occurrence_id', a.occurrence_id, 'child_id', a.child_id))
           ),
           format('reminder:%s:%s:%s', fm.user_id, a.organisation_id, min(a.local_day))
      from attending a
      join public.children ch on ch.id = a.child_id and ch.active
      join public.family_members fm on fm.family_id = ch.family_id
      join public.users u on u.id = fm.user_id
     where u.lesson_reminders
     group by fm.user_id, a.organisation_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into queued from queued_rows;
  return queued;
end;
$$;

revoke all on function private.queue_lesson_reminders(timestamptz) from public;

-- For the tests and support: the same job for a given moment. Server only.
create function public.queue_lesson_reminders_at(p_now timestamptz)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.queue_lesson_reminders(p_now)
$$;

revoke all on function public.queue_lesson_reminders_at(timestamptz) from public, anon, authenticated;
grant execute on function public.queue_lesson_reminders_at(timestamptz) to service_role;

-- ------------------------------------------------------------------ the sender's side

-- Hands the sender a batch of emails to send, marking them as being sent so
-- two senders never take the same one. Emails more than a day late are
-- skipped instead; one stuck "sending" for 10 minutes is tried again.
create function public.claim_email_deliveries(p_limit integer default 50)
returns setof public.email_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_deliveries
     set status = 'skipped', error = 'More than a day late.'
   where status = 'pending' and created_at < now() - interval '1 day';

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

-- What happened to one email: sent, skipped (nothing to send, or email is
-- off), or failed (tried again later, up to 5 attempts in all).
create function public.finish_email_delivery(
  p_id uuid, p_outcome text, p_provider_id text default null, p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('sent', 'skipped', 'failed') then
    raise exception 'unknown outcome %', p_outcome;
  end if;
  update public.email_deliveries d
     set status = case
                    when p_outcome = 'failed' and d.attempts < 5 then 'pending'
                    else p_outcome
                  end,
         next_attempt_at = case
                             when p_outcome = 'failed' then now() + make_interval(mins => power(2, d.attempts)::integer)
                             else d.next_attempt_at
                           end,
         sent_at = case when p_outcome = 'sent' then now() else d.sent_at end,
         provider_id = coalesce(p_provider_id, d.provider_id),
         error = left(p_error, 500),
         locked_at = null
   where d.id = p_id and d.status = 'sending';
end;
$$;

revoke all on function public.finish_email_delivery(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_email_delivery(uuid, text, text, text) to service_role;

-- ------------------------------------------------------------------ schedules

create extension if not exists pg_net with schema extensions;

-- Asks the app to send what's waiting. Needs two Vault secrets, set once per
-- environment: ovyko_app_url (e.g. https://app.ovyko.com.au) and
-- ovyko_cron_secret (the app's CRON_SECRET). Without them it does nothing.
create function private.kick_email_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'ovyko_app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'ovyko_cron_secret';
  if app_url is null or secret is null then
    return;
  end if;
  if not exists (
    select 1 from public.email_deliveries
     where (status = 'pending' and next_attempt_at <= now())
        or (status = 'sending' and locked_at < now() - interval '10 minutes')
  ) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(app_url, '/') || '/api/email/deliver',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function private.kick_email_sender() from public;

select cron.schedule('ovyko-lesson-reminders', '0 * * * *', 'select private.queue_lesson_reminders()');
select cron.schedule('ovyko-send-email', '* * * * *', 'select private.kick_email_sender()');
