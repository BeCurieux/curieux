-- Database functions: job claiming, counter upserts, account deletion.

-- ------------------------------------------------- job queue

-- Atomic claim with SKIP LOCKED so multiple runners are safe (§40).
create or replace function claim_job()
returns setof jobs language plpgsql security definer set search_path = public as $$
declare
  claimed jobs;
begin
  select * into claimed
  from jobs
  where status = 'queued' and run_after <= now()
  order by run_after
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update jobs
  set status = 'running', attempts = attempts + 1, updated_at = now()
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end $$;

-- ------------------------------------------------- taste counters

-- Upsert a category counter without a read-modify-write race between the
-- feedback handler and the generation job (both touch these rows).
create or replace function bump_category_stat(
  p_household_id uuid,
  p_category_id text,
  p_suggested integer default 0,
  p_accepted integer default 0,
  p_completed integer default 0,
  p_loved integer default 0,
  p_rejected integer default 0,
  p_suggested_at timestamptz default null,
  p_completed_at timestamptz default null
) returns void language sql security definer set search_path = public as $$
  insert into category_stats as cs (
    household_id, category_id, suggested_count, accepted_count, completed_count,
    loved_count, rejected_count, last_suggested_at, last_completed_at
  ) values (
    p_household_id, p_category_id, p_suggested, p_accepted, p_completed,
    p_loved, p_rejected, p_suggested_at, p_completed_at
  )
  on conflict (household_id, category_id) do update set
    suggested_count   = cs.suggested_count + p_suggested,
    accepted_count    = cs.accepted_count + p_accepted,
    completed_count   = cs.completed_count + p_completed,
    loved_count       = cs.loved_count + p_loved,
    rejected_count    = cs.rejected_count + p_rejected,
    last_suggested_at = coalesce(p_suggested_at, cs.last_suggested_at),
    last_completed_at = coalesce(p_completed_at, cs.last_completed_at),
    updated_at        = now();
$$;

-- ------------------------------------------------- account deletion (§52)

-- Removes the customer and everything personal about them, while preserving
-- the financial record required for tax purposes. The payment row is retained
-- with its household link severed and only a hash of the email left behind, so
-- the books reconcile without the person remaining identifiable in them.
create or replace function delete_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  for hid in
    select household_id from household_users where user_id = p_user_id
  loop
    update payments
    set household_id = null,
        customer_email_hash = encode(digest(coalesce(customer_email_hash, hid::text), 'sha256'), 'hex')
    where household_id = hid;

    -- Cascades remove members, preferences, taste, check-ins, plans, items,
    -- feedback, events, notifications and subscriptions.
    delete from households where id = hid;
  end loop;

  delete from profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end $$;

-- pgcrypto's digest() is needed by delete_account.
create extension if not exists pgcrypto;
