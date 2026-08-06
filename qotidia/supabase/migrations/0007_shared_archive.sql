-- The shared archive.
--
-- Until now a family was one login: families.owner_user_id, and every policy
-- read `owner_user_id = auth.uid()`. Meanwhile the landing page promised
-- "unlimited family contributors, free". This closes that gap.
--
-- The shape:
--   owner        the parent who set it up. Moderates, approves the book, pays.
--   editor       the other parent. Adds directly; nothing to approve.
--   contributor  a grandparent, a godparent. Adds, and what they add waits
--                for the owner. Comments freely.
--
-- Moderation is not distrust — it is the never-invent rule extended to
-- people. The owner is answerable for every word and photograph in a book
-- about their child, so nothing reaches it without them saying yes.

-- ------------------------------------------------------------ memberships

create type family_role as enum ('owner', 'editor', 'contributor');

create table family_memberships (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         family_role not null default 'contributor',
  -- How this person is known to the child, for the book: "Grandpa", "Nonna".
  display_name text,
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_memberships_user_idx on family_memberships(user_id);

-- Everyone who already has a family becomes its owner, so no existing
-- account loses access the moment this lands.
insert into family_memberships (family_id, user_id, role)
select f.id, f.owner_user_id, 'owner' from families f
on conflict (family_id, user_id) do nothing;

-- Exactly one owner per family: the person who pays and approves the print.
create unique index family_one_owner on family_memberships (family_id)
  where role = 'owner';

-- ------------------------------------------------------------ invitations

create table family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  email       text not null,
  role        family_role not null default 'contributor',
  -- Random, single-use, and the only thing the invitee needs.
  token       text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Nobody may be invited as owner; ownership transfers deliberately.
  constraint invitation_not_owner check (role <> 'owner')
);

create index family_invitations_family_idx on family_invitations(family_id);
create unique index family_invitations_pending on family_invitations (family_id, lower(email))
  where accepted_at is null;

-- ------------------------------------------------------------- moderation

create type contribution_status as enum ('approved', 'pending', 'declined');

alter table memories
  add column if not exists contribution_status contribution_status not null default 'approved',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Everything already in the archive was added by the owner, so it stands.
update memories set contribution_status = 'approved' where contribution_status is null;

-- The review queue is read constantly and is almost always short; index the
-- part that matters rather than the whole table.
create index memories_pending_idx on memories (subject_id, created_at desc)
  where contribution_status = 'pending';

-- --------------------------------------------------------------- comments
--
-- Conversation, not book content. A grandmother saying "she's been doing that
-- since she could walk" is worth keeping and is not a caption. Comments never
-- reach the printed page on their own — if something said here belongs in the
-- book, it is added as a memory, with provenance, like everything else.

create table memory_comments (
  id             uuid primary key default gen_random_uuid(),
  memory_id      uuid not null references memories(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 2000),
  created_at     timestamptz not null default now()
);

create index memory_comments_memory_idx on memory_comments(memory_id, created_at);
