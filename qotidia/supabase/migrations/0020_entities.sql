-- The family memory graph, made durable.
--
-- Until now the graph has been computed and thrown away. buildEntities()
-- reads the tags, works out that Bun Bun is a thing appearing in forty
-- memories, produces a weekly note, and forgets. Every run starts again from
-- strings.
--
-- That is enough to notice things. It is not enough to *know* anything, and
-- the difference is the whole business. An archive that knows "Mimi" and
-- "Grandma Sue" are one grandmother can make a book called Nana & Me. An
-- archive that has two tag strings cannot, and no amount of cleverness later
-- recovers the answer — because the answer was never a computation. It was
-- something a family knew and nobody wrote down.
--
-- So: entities are records. They have their own identity, they carry the
-- names a family has used for them, and the fact that two names are one
-- person is stored the moment somebody says so.
--
-- Three decisions worth arguing about, all of them here rather than in
-- application code.
--
-- **Nothing is ever inferred.** No face matching, no clustering on
-- co-occurrence, no guessing from context. An entity exists because somebody
-- tagged something, and two entities become one because somebody was asked
-- and said yes. See lib/graph/identity.ts, which ranks the questions and
-- deliberately has no opinion about the answers.
--
-- **A "no" is stored as hard as a "yes".** resolutions holds both. The
-- product must never ask twice whether Nana and Grandma are the same person,
-- because asking twice says nobody was listening the first time, and they
-- would be right.
--
-- **Merging is not destructive.** Saying Mimi is Grandma Sue folds one
-- entity into the other and keeps both names as aliases. The family's own
-- word for someone is not a spelling mistake to be corrected — "Mimi" is
-- what a two-year-old called her, and in ten years that is the part worth
-- having.

-- ----------------------------------------------------------- the records

create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  -- person | thing | place | phrase | ritual, matching EntityKind in
  -- lib/graph/presence.ts. Text rather than an enum: this list will grow —
  -- foods, traditions and routines are all coming — and a migration to add
  -- a value to an enum is a lock on a table nobody can afford to lock.
  kind        text not null,
  -- What to call it now. Always one of its own aliases.
  label       text not null,
  -- Set when this entity has been folded into another. The row stays so the
  -- old id keeps resolving; nothing that referenced it breaks.
  merged_into uuid references entities(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint entities_kind_known
    check (kind in ('person', 'thing', 'place', 'phrase', 'ritual'))
);

create index if not exists entities_family_idx on entities(family_id, kind);
create index if not exists entities_merged_idx on entities(merged_into) where merged_into is not null;

-- Every name this family has used for it, including the ones they stopped
-- using. Nothing here is a correction.
create table if not exists entity_aliases (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,
  label      text not null,
  -- Lowercased for matching. The label above keeps the family's own case.
  key        text not null,
  created_at timestamptz not null default now(),
  unique (entity_id, key)
);

create index if not exists entity_aliases_key_idx on entity_aliases(key);

-- Which memories an entity appears in. Written when somebody tags, so this
-- is a record of what a person did rather than of what we worked out.
create table if not exists entity_memories (
  entity_id  uuid not null references entities(id) on delete cascade,
  memory_id  uuid not null references memories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entity_id, memory_id)
);

create index if not exists entity_memories_memory_idx on entity_memories(memory_id);

-- ------------------------------------------------------- what we've asked
--
-- One row per pair the family has ruled on, in either direction. `pair_key`
-- is the two ids sorted and joined, so the same question cannot be recorded
-- twice by arriving in the other order — see pairKey() in identity.ts, which
-- computes the same string.

create table if not exists entity_resolutions (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  pair_key   text not null,
  same       boolean not null,
  -- Who said so. A resolution is somebody's assertion, not a system fact,
  -- and in five years it may need to be traceable to a person.
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  unique (family_id, pair_key)
);

-- ------------------------------------------------------------------ merge
--
-- One place, so the rule cannot be reimplemented differently by the next
-- caller. Folds `loser` into `winner`: the aliases move, the memory links
-- move, and the loser is left as a tombstone pointing at the winner.
--
-- Deliberately not a trigger. This runs because a person answered a
-- question, and something that rearranges a family's graph should be called
-- on purpose rather than happening as a side effect of a write.
--
-- Not in the activity log, and that is a decision rather than an omission:
-- the log is deliberately short — the events involving another person or a
-- copy of the archive leaving — and a log of everything is a log nobody
-- reads. Resolutions are visible where they matter, on the who's-who page,
-- with the name and the date attached.

create or replace function merge_entities(winner uuid, loser uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  wf uuid;
  lf uuid;
begin
  if winner = loser then
    raise exception 'cannot merge an entity into itself';
  end if;

  select family_id into wf from entities where id = winner;
  select family_id into lf from entities where id = loser;

  if wf is null or lf is null then
    raise exception 'both entities must exist';
  end if;

  -- The check that matters. Two families' graphs must never touch, and the
  -- service role bypasses row-level security, so this cannot live only in a
  -- policy.
  if wf <> lf then
    raise exception 'entities belong to different families';
  end if;

  -- Names move across and nothing is discarded.
  update entity_aliases set entity_id = winner where entity_id = loser
    and key not in (select key from entity_aliases where entity_id = winner);
  delete from entity_aliases where entity_id = loser;

  -- Memory links move, skipping any the winner already has.
  insert into entity_memories (entity_id, memory_id)
    select winner, memory_id from entity_memories where entity_id = loser
    on conflict do nothing;
  delete from entity_memories where entity_id = loser;

  -- The tombstone, so an id held anywhere still resolves.
  update entities set merged_into = winner where id = loser;
end;
$$;

-- ------------------------------------------------------------------- RLS
--
-- Same shape as everything else: a row is visible to the family it belongs
-- to and to nobody else. The alias and link tables have no family_id of
-- their own and reach it through their entity, which is the one join worth
-- paying for rather than denormalising a family id that could drift.

alter table entities           enable row level security;
alter table entity_aliases     enable row level security;
alter table entity_memories    enable row level security;
alter table entity_resolutions enable row level security;

create or replace function family_of_entity(eid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from entities where id = eid $$;

drop policy if exists "entities read" on entities;
create policy "entities read" on entities
  for select using (is_family_member(family_id));

drop policy if exists "entities write" on entities;
create policy "entities write" on entities
  for all using (can_edit_family(family_id))
  with check (can_edit_family(family_id));

drop policy if exists "aliases read" on entity_aliases;
create policy "aliases read" on entity_aliases
  for select using (is_family_member(family_of_entity(entity_id)));

drop policy if exists "aliases write" on entity_aliases;
create policy "aliases write" on entity_aliases
  for all using (can_edit_family(family_of_entity(entity_id)))
  with check (can_edit_family(family_of_entity(entity_id)));

drop policy if exists "entity memories read" on entity_memories;
create policy "entity memories read" on entity_memories
  for select using (is_family_member(family_of_entity(entity_id)));

drop policy if exists "entity memories write" on entity_memories;
create policy "entity memories write" on entity_memories
  for all using (can_edit_family(family_of_entity(entity_id)))
  with check (can_edit_family(family_of_entity(entity_id)));

drop policy if exists "resolutions read" on entity_resolutions;
create policy "resolutions read" on entity_resolutions
  for select using (is_family_member(family_id));

drop policy if exists "resolutions write" on entity_resolutions;
create policy "resolutions write" on entity_resolutions
  for all using (can_edit_family(family_id))
  with check (can_edit_family(family_id));

-- A memory can only ever be linked to an entity of its own family. RLS does
-- not cover the service role, and the seed and the job runner both use it.
create or replace function entity_memory_same_family()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ef uuid;
  mf uuid;
begin
  select family_id into ef from entities where id = new.entity_id;
  select family_id into mf from memories where id = new.memory_id;
  if ef is null or mf is null or ef <> mf then
    raise exception 'entity and memory belong to different families';
  end if;
  return new;
end;
$$;

drop trigger if exists entity_memory_same_family_trg on entity_memories;
create trigger entity_memory_same_family_trg
  before insert or update on entity_memories
  for each row execute function entity_memory_same_family();
