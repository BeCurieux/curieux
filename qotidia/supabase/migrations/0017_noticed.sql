-- What we noticed, and what the family said about it.
--
-- Two jobs, and the second is the one that compounds.
--
-- It stops a weekly note repeating itself: an observation shown last Sunday
-- should not be the lead again this Sunday, and without a record there is no
-- way to know.
--
-- And it turns the note into a loop rather than a broadcast. "Keep" means a
-- thread matters and should reach the book. "Ignore" means we were wrong
-- about it, and being told so is the only way this gets better at a family
-- it has never met. A product that observes and never learns is a product
-- that makes the same wrong observation for six years.

create type noticed_verdict as enum ('shown', 'kept', 'more', 'ignored');

create table noticed (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references subjects(id) on delete cascade,
  -- The entity key from lib/graph/extract.ts, e.g. "thing:bun bun". Not a
  -- foreign key: entities are derived, not stored, so that they can be
  -- recomputed whenever the extraction improves without a migration.
  entity_id   text not null,
  -- What was said, kept verbatim. A family asking "why did you tell me that"
  -- deserves the sentence they actually saw, not a reconstruction from
  -- today's code.
  line        text not null,
  shape       text not null,
  verdict     noticed_verdict not null default 'shown',
  -- Which memories the observation was computed from. The provenance rule,
  -- carried into storage: every line can be traced back to the things a
  -- family put there.
  memory_ids  jsonb not null default '[]',
  shown_at    timestamptz not null default now(),
  answered_at timestamptz
);

create index noticed_subject_idx on noticed (subject_id, shown_at desc);
create unique index noticed_recent_idx on noticed (subject_id, entity_id, shown_at);

alter table noticed enable row level security;

-- Family-visible, like the archive it describes. A grandparent who can see
-- the memories can see what was noticed about them. owns_subject() is the
-- existing membership helper from 0008 — the name reads like ownership and
-- means "is in the family that has this subject".
create policy "noticed read" on noticed for select
  using (owns_subject(subject_id));

-- A verdict is an edit to the archive's shape, so it takes the same standard
-- as editing a memory: contributors may add, but only an editor decides that
-- a thread matters. The rows themselves are written by the service role.
create policy "noticed update" on noticed for update
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));
