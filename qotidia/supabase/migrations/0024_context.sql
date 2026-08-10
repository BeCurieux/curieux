-- What the family told us about a thing.
--
-- The graph can already see that something matters — twenty-three mentions
-- across four years is not a coincidence. What it cannot see is what the
-- thing *was*. This table is where that goes, and it is the single most
-- valuable table in the schema per byte, because everything in it decays
-- outside the database: it lives in one person's memory, it fades, and
-- eventually that person is not there to ask.
--
-- Photographs survive on their own. A competitor starting in ten years can
-- index the same photographs with a better model. They cannot go back and
-- ask what the rabbit was called.
--
-- ## Two decisions
--
-- **A skip is stored, not absent.** "I'd rather not say" and "nobody has
-- asked yet" have to be different rows, because a question re-asked after
-- being declined is worse than one never asked — it says nobody was
-- listening. The unique constraint is what makes settled permanent.
--
-- **Keyed by entity key, not entity id.** An entity id is derived from the
-- archive and is recomputed on every read; the answer has to outlive that.
-- `thing:bun_bun` is stable across rebuilds of the graph in a way that a row
-- id is not.

create table if not exists entity_context (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  -- e.g. 'thing:bun_bun', 'ritual:saturday swimming'.
  entity_key  text not null,
  -- what_is_it | was_it_a_ritual | what_happened
  wondering   text not null,
  -- The family's own words. Null when they chose not to say.
  answer      text,
  skipped     boolean not null default false,
  -- What the arithmetic was at the time, so the answer can be read back with
  -- the question it was answering. Without this, "It just stopped" is a row
  -- nobody can interpret in five years.
  because     text,
  answered_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (family_id, entity_key, wondering),
  -- An answer or a skip, never neither: a row here means the question is
  -- settled, and a settled question with nothing in it is a silenced
  -- question with no reason.
  constraint entity_context_said_something
    check (skipped or (answer is not null and length(btrim(answer)) > 0))
);

create index if not exists entity_context_family_idx on entity_context(family_id);

alter table entity_context enable row level security;

create policy "context read" on entity_context for select
  using (is_family_member(family_id));

-- Anyone who can add to the archive can answer. A grandmother knowing what
-- the rabbit was called is the entire point, and routing it through the
-- owner would lose most of the answers worth having.
create policy "context write" on entity_context for insert
  with check (can_edit_family(family_id) and answered_by = signed_in_user());

-- Editable, because a family correcting themselves is the mechanism this
-- whole thing runs on. Not deletable: a settled question stays settled.
create policy "context amend" on entity_context for update
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));
