-- The Memory Inbox.
--
-- Capture that takes more than a few seconds is capture that stops
-- happening, so this exists to let things arrive without anybody opening the
-- app: shared from a phone, forwarded by a partner, mailed in from a work
-- laptop on the way home.
--
-- The important decision is what is *not* here. There is no inbox table.
--
-- A separate holding area would mean everything else in the product has to
-- learn about it, and the two things that must never miss anything are the
-- export and the Delete Everything button. A parent who deletes their
-- archive and finds forty photographs still sitting in a queue has been lied
-- to, and no amount of care elsewhere makes up for it. So an arrival is a
-- memory from the moment it lands — counted, exported, deleted, part of the
-- graph — and "the inbox" is a view over the few that still have an open
-- question.

create type arrived_via as enum ('share', 'email', 'quick');

-- Rotating an address is an access change: the old one stops working, and
-- anybody who had been mailing things in is now silently unable to. That is
-- worth a family being able to see, in the log they already have.
alter type activity_kind add value if not exists 'inbox_address_rotated';

alter table memories
  -- Null for the ordinary path: added through the app, on purpose.
  add column if not exists arrived_via arrived_via,
  -- Whatever came with it: a share sheet's title, a mail subject. Kept
  -- verbatim and never treated as the memory's text, because a subject line
  -- is what somebody typed into their mail client, not what they'd have
  -- written down as a memory.
  add column if not exists arrival_note text,
  -- Null while something is still unanswered. Not a gate on anything: an
  -- unfiled memory is kept exactly as thoroughly as a filed one.
  add column if not exists filed_at timestamptz;

-- The inbox is the residue, so this index is over the small set.
create index if not exists memories_unfiled_idx
  on memories (subject_id)
  where filed_at is null and arrived_via is not null;

-- ------------------------------------------------------------- the address

-- One private address per child.
--
-- A bearer credential: anyone who knows it can write into this family's
-- archive. Three things follow, and all three are columns here rather than
-- conventions somewhere in the application.
create table subject_inboxes (
  subject_id  uuid primary key references subjects(id) on delete cascade,
  -- Long and random. Never derived from a name or a birthday, which a person
  -- who already knows the family could guess.
  token       text not null unique,
  -- Whether mail from outside the family lands in the review queue or is
  -- refused. Default closed: the privacy brief's rule was to invite people
  -- individually rather than generate something anyone can post to.
  accept_from_anyone boolean not null default false,
  -- Rotating issues a new token in place. Anything given out eventually ends
  -- up somewhere it shouldn't, and a credential you cannot change is one you
  -- can only hope about.
  rotated_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table subject_inboxes enable row level security;

-- Readable by the family, because everyone who can contribute needs the
-- address to contribute by mail.
create policy "inbox address read" on subject_inboxes for select
  using (owns_subject(subject_id));

-- Changed only by someone who can edit the archive. Handing out a write
-- credential is an access decision, and access decisions are an editor's.
create policy "inbox address change" on subject_inboxes for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

create policy "inbox address create" on subject_inboxes for insert
  with check (can_edit_subject(subject_id));
