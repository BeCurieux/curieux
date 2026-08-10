-- Who keeps the archive when the person who made it cannot.
--
-- The reasoning is in lib/succession/policy.ts. This is the storage for it,
-- and two things here are load-bearing rather than incidental.
--
-- **The handover is one function, not a sequence of updates.** Ownership
-- moves in a single transaction that also demotes the previous owner,
-- because there is a unique index allowing exactly one owner per family —
-- so any order of separate statements is briefly illegal, and the failure
-- mode of getting it wrong is a family with no owner at all.
--
-- **Nothing is deleted.** A handover changes who holds the keys. The
-- previous owner keeps their membership and their name stays on everything
-- they wrote. A handover that should not have happened can be reversed by
-- running it the other way.

-- --------------------------------------------------------------- last seen
--
-- Silence is measured against this. Updated at most every few hours by the
-- application, so it costs one no-op update per person per session rather
-- than a write per request.

alter table profiles add column if not exists last_seen_at timestamptz;

-- Everybody who exists today is treated as seen today. The alternative is
-- backdating every account to null and having the first sweep decide a
-- year and a half of silence has already elapsed.
update profiles set last_seen_at = now() where last_seen_at is null;

-- A function rather than an update from the application, so the throttle
-- lives with the column. Called on every authenticated request: the where
-- clause means almost all of those touch no row at all, and none of them
-- read one first.
create or replace function touch_last_seen(uid uuid, stale_hours int default 6)
returns void language sql security definer set search_path = public as $$
  update profiles
     set last_seen_at = now()
   where id = uid
     and (last_seen_at is null or last_seen_at < now() - make_interval(hours => stale_hours));
$$;

comment on function touch_last_seen(uuid, int) is
  'Record that a user is still around. What succession measures silence against.';

-- ----------------------------------------------------------- what to record
--
-- Succession is exactly the class of event the activity log exists for: it
-- changes who controls the archive, and the family reads that log
-- themselves. A refused claim is logged as loudly as a completed one —
-- somebody who tried to take an archive and failed is the single most
-- important thing that log will ever have to say.

alter type activity_kind add value if not exists 'named_keeper';
alter type activity_kind add value if not exists 'removed_keeper';
alter type activity_kind add value if not exists 'succession_claimed';
alter type activity_kind add value if not exists 'succession_refused';
alter type activity_kind add value if not exists 'succession_completed';

-- ----------------------------------------------------------------- keepers

create table if not exists family_keepers (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  -- Named by email, because the point is to work when the person has no
  -- account yet — and the moment that matters is not a good one to be
  -- asking somebody to sign up first.
  email        text not null,
  -- Filled in if and when they do have an account.
  user_id      uuid references auth.users(id) on delete set null,
  -- How the family would say it: "my sister Ruth", "Dad".
  relationship text,
  named_by     uuid references auth.users(id) on delete set null,
  named_at     timestamptz not null default now(),
  -- A keeper may say in advance that they would rather not, and that has to
  -- be recorded rather than leaving the owner to assume.
  declined_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (family_id, email)
);

create index if not exists family_keepers_family_idx on family_keepers(family_id);
create index if not exists family_keepers_email_idx on family_keepers(lower(email));

-- ------------------------------------------------------------------ claims

do $$ begin
  create type succession_opening as enum ('claimed', 'silence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type succession_status as enum ('notice', 'completed', 'refused', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists succession_claims (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  keeper_id   uuid references family_keepers(id) on delete set null,
  opening     succession_opening not null,
  status      succession_status not null default 'notice',
  -- Who the archive would go to, kept separately from keeper_id so the
  -- record still reads correctly if the nomination is later removed.
  keeper_email text not null,
  opened_at   timestamptz not null default now(),
  decides_at  timestamptz not null,
  -- Which reminder days have been sent, so a sweep that runs twice does not
  -- write to a grieving family twice.
  reminded_on int[] not null default '{}',
  settled_at  timestamptz,
  -- Plain English, shown to the family afterwards: "the owner signed in".
  settled_because text,
  created_at  timestamptz not null default now()
);

create index if not exists succession_claims_family_idx on succession_claims(family_id, created_at desc);

-- At most one open claim per family. Two people claiming the same archive at
-- once is not a race to resolve, it is a dispute — and the second one has to
-- be refused at the door rather than arbitrated later.
create unique index if not exists succession_one_open_claim
  on succession_claims (family_id) where status = 'notice';

-- ------------------------------------------------------------- the handover

create or replace function hand_over_family(fid uuid, to_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare previous uuid;
begin
  select owner_user_id into previous from families where id = fid;
  if previous is null then
    raise exception 'no such family';
  end if;
  if previous = to_user then
    return; -- already theirs; a retried job must not fail
  end if;

  -- Demote first. There is a unique index permitting one owner per family,
  -- so promoting before demoting is a constraint violation and the whole
  -- handover would roll back.
  update family_memberships set role = 'editor'
   where family_id = fid and user_id = previous;

  insert into family_memberships (family_id, user_id, role)
       values (fid, to_user, 'owner')
  on conflict (family_id, user_id) do update set role = 'owner';

  update families set owner_user_id = to_user where id = fid;
end;
$$;

comment on function hand_over_family(uuid, uuid) is
  'Move ownership of a family. Demotes the previous owner rather than removing them — nothing about a handover deletes anything.';

-- ---------------------------------------------------------------------- RLS
--
-- A keeper is usually not a member of the family — that is rather the point
-- — so the policies below have to recognise them by email. That is looked up
-- from our own profiles table rather than out of the auth token, which keeps
-- the identity provider behind signed_in_user() where migration 0022 put it.

create or replace function signed_in_email()
returns text language sql stable security definer set search_path = public as $$
  select email from profiles where id = signed_in_user()
$$;

comment on function signed_in_email() is
  'The signed-in user''s email, from profiles. Used where a policy has to recognise somebody who is not a member of the family.';

alter table family_keepers enable row level security;
alter table succession_claims enable row level security;

-- Only the owner names a keeper. An editor is usually the other parent and
-- could reasonably be trusted with it, but "who inherits this" is the one
-- decision that should sit with exactly one person.
create policy "keepers read" on family_keepers for select
  using (is_family_member(family_id) or lower(email) = lower(coalesce(signed_in_email(), '')));

create policy "keepers manage" on family_keepers for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- A claim is visible to the family and to the person who would receive it.
-- The second half matters: a keeper is usually not a member, and a process
-- they cannot see is one they cannot trust.
create policy "claims read" on succession_claims for select
  using (
    is_family_member(family_id)
    or lower(keeper_email) = lower(coalesce(signed_in_email(), ''))
  );

-- Written by the server only. Opening and settling a claim both go through
-- checks that no row-level policy can express.
create policy "claims no writes" on succession_claims for insert with check (false);
create policy "claims no updates" on succession_claims for update using (false);
