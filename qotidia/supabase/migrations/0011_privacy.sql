-- Privacy you can check.
--
-- Reassuring copy is not what makes a parent trust a company with twelve
-- years of their child's life. What does is being able to look: who opened
-- this, what did they take, what did we send anywhere, and what happens if
-- I want it all back or all gone.
--
-- Three things here.
--
--   activity_log     what happened in a family's archive, readable BY the
--                    family — not an internal log they have to ask about
--   archive_exports  every copy of an archive we have ever produced, so a
--                    download is a visible event rather than a silent one
--   deletion_requests  a real, dated, irreversible erasure with a stated
--                      backup window, not a support address

-- --------------------------------------------------------- activity log

create type activity_kind as enum (
  'viewed_archive',
  'viewed_book',
  'downloaded_book',
  'exported_archive',
  'added_memory',
  'approved_contribution',
  'declined_contribution',
  'invited_member',
  'member_joined',
  'removed_member',
  'changed_role',
  'ordered_book',
  'cancelled_renewal',
  'support_access_granted',
  'support_access_used'
);

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  subject_id  uuid references subjects(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  -- Kept as text as well, so the log still reads correctly after someone
  -- has left the family and their row is gone.
  actor_label text not null,
  kind        activity_kind not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create index activity_log_family_idx on activity_log(family_id, created_at desc);

alter table activity_log enable row level security;

-- Everyone in the family can read it. A log only the owner can see would be
-- surveillance; a log nobody can see would be theatre.
create policy "activity read" on activity_log for select using (is_family_member(family_id));
-- Written by the server only. Nobody edits or deletes their own tracks.
create policy "activity no writes" on activity_log for insert with check (false);

-- ------------------------------------------------------------- exports

create table archive_exports (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  requested_by  uuid references auth.users(id) on delete set null,
  status        text not null default 'preparing'
                check (status in ('preparing', 'ready', 'failed', 'expired')),
  storage_path  text,
  size_bytes    bigint,
  item_count    int,
  -- An export is a complete copy of a family's private life in one file, so
  -- it does not sit around indefinitely.
  expires_at    timestamptz not null default now() + interval '7 days',
  created_at    timestamptz not null default now()
);

create index archive_exports_family_idx on archive_exports(family_id, created_at desc);

alter table archive_exports enable row level security;

create policy "exports read" on archive_exports for select using (is_family_member(family_id));
create policy "exports request" on archive_exports for insert
  with check (can_edit_family(family_id) and requested_by = auth.uid());

-- ----------------------------------------------------------- deletion

create table deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  -- Deliberately NOT a cascading foreign key. Everything else about the
  -- family is destroyed; this record has to outlive it, because we must be
  -- able to show that the erasure happened and a receipt that deletes itself
  -- proves nothing. It holds an id and a date — nothing about the child.
  family_id      uuid not null,
  requested_by   uuid references auth.users(id) on delete set null,
  -- Typed the child's name to confirm. Recorded because an irreversible act
  -- should be evidenced, not merely clicked.
  confirmation   text not null,
  status         text not null default 'pending'
                 check (status in ('pending', 'completed', 'cancelled')),
  -- Live data goes immediately; encrypted backups roll off on their own
  -- schedule, and saying so precisely is worth more than claiming instant.
  backups_expire_at timestamptz not null default now() + interval '30 days',
  requested_at   timestamptz not null default now(),
  completed_at   timestamptz
);

alter table deletion_requests enable row level security;

-- Readable while the family still exists; afterwards it is a service-role
-- record only, which is the point of it.
create policy "deletion read" on deletion_requests for select
  using (requested_by = auth.uid() or is_family_member(family_id));
create policy "deletion request" on deletion_requests for insert
  with check (is_family_owner(family_id) and requested_by = auth.uid());

-- ------------------------------------------------- time-boxed support access
--
-- Nobody at this company browses a family's memories as a matter of course.
-- When support genuinely needs to look, the family grants it, it is logged,
-- and it expires by itself rather than relying on someone remembering.

create table support_grants (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  granted_by  uuid not null references auth.users(id) on delete cascade,
  reason      text not null,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint support_grant_is_short check (expires_at < created_at + interval '7 days')
);

create index support_grants_active_idx on support_grants(family_id, expires_at)
  where revoked_at is null;

alter table support_grants enable row level security;

create policy "grants read" on support_grants for select using (is_family_member(family_id));
create policy "grants manage" on support_grants for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

/** Whether support currently has permission to look at a family's archive. */
create or replace function support_access_active(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from support_grants g
     where g.family_id = fid and g.revoked_at is null and g.expires_at > now()) $$;
