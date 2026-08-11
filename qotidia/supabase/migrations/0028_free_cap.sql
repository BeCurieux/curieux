-- The free cap, enforced where it costs nothing.
--
-- The first version of this checked the cap in keepMemory(), the single
-- place a memory row is created. That is the right *place* — a quote, a
-- note, an answer to a question and a recording are all memories, and only
-- photographs pass an upload ticket that counts anything — but it is the
-- wrong *layer*. It added two queries to every insert, so a parent moving
-- three hundred photographs across paid six hundred extra round trips for a
-- rule that is a single count.
--
-- Here instead, for the same reason family isolation lives in row-level
-- security rather than in a helper somebody could forget to call:
--
--   It cannot be bypassed. Not by a new code path, not by a background job,
--   not by a direct insert from the SQL editor.
--
--   It costs nothing on the hot path. One indexed count inside a trigger
--   that only runs for families who are not paying, rather than two round
--   trips per row for everybody.
--
-- The application still asks lib/billing/standing.ts before an upload
-- starts. That is not the enforcement — it is the sentence a family reads,
-- which a raised exception cannot be. Database refuses; app explains.
--
-- Deliberately not a check constraint: the rule depends on another table.

/**
 * How many memories a family may keep without paying.
 *
 * Mirrors FREE_MEMORIES in lib/billing/free.ts, and tests/free.test.ts fails
 * if the two disagree. A number in two places is a number that drifts, and
 * the alternative — reading it from the application at insert time — is the
 * round trip this migration exists to remove.
 */
create or replace function free_memory_cap()
returns integer language sql immutable set search_path = '' as $$ select 100 $$;

/**
 * Whether a family is paying.
 *
 * past_due counts. A card that failed on Tuesday is a card problem, and
 * refusing a parent's photographs over one turns a billing retry into a
 * cancellation. Mirrors tierOf() in lib/billing/free.ts.
 */
create or replace function family_is_paying(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from families f
      where f.id = fid
        and (f.membership_state in ('active', 'past_due')
             or (f.paid_until is not null and f.paid_until > now()))) $$;

create or replace function refuse_past_free_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare kept integer;
begin
  -- The common case, and it costs one indexed lookup on families.
  if family_is_paying(new.family_id) then
    return new;
  end if;

  select count(*) into kept from memories m where m.family_id = new.family_id;
  if kept >= free_memory_cap() then
    -- The application catches this and shows its own sentence. The text
    -- here is for a developer reading a log, not for a parent.
    raise exception 'free archive is full (% of %)', kept, free_memory_cap()
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists memories_free_cap_trg on memories;
create trigger memories_free_cap_trg
  before insert on memories
  for each row execute function refuse_past_free_cap();

-- The count above is per family and runs on every insert for a free family.
-- Without this it is a sequential scan of every memory in the database.
create index if not exists memories_family_idx on memories(family_id);
