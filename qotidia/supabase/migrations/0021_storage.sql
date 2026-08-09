-- Counting the bytes.
--
-- Nothing in this product has ever recorded the size of a file. There is no
-- size column on an asset and no total on a family, so "unlimited" has been
-- the implied offer since the first upload — and a household with four
-- hundred gigabytes of 4K video costs more per year than they pay. It is the
-- largest unmodelled liability in the business, and it is invisible right up
-- until it is expensive.
--
-- Two decisions worth arguing about.
--
-- **The total is maintained, not counted.** Summing media_assets on every
-- upload is fine at a thousand families and a table scan at a hundred
-- thousand, and the check runs on the hot path — the moment somebody is
-- adding photographs. A trigger keeps a running total on the family instead.
-- The cost is that a bug in the trigger drifts silently, so there is a
-- function here to recompute from source, and the harness asserts the two
-- agree.
--
-- **Only originals count.** Thumbnails, keyframes and derivatives are our
-- cost of doing business. Charging a family for the previews we chose to
-- generate would be both petty and impossible to explain.
--
-- What this does *not* do is as important. Being full never deletes
-- anything, never locks the archive, and never stops an export. It stops new
-- uploads, which is the only thing that actually costs money — see
-- lib/storage/allowance.ts, where that is enforced by the shape of the type.

alter table media_assets add column if not exists bytes bigint not null default 0;

-- The owning family, carried on the asset itself.
--
-- Denormalised on purpose, and the harness is the reason. Deleting a memory
-- cascades to its assets, and by the time the asset's delete trigger runs the
-- memory row is already gone — so looking the family up from memories returns
-- null, the update matches nothing, and the bytes are never released. A
-- family who deleted a memory would keep paying for it for ever, silently.
--
-- Kept in step by a trigger rather than trusted to callers, and the
-- cross-family check goes with it: an asset must belong to its memory's
-- family and nobody else's.
alter table media_assets add column if not exists family_id uuid references families(id) on delete cascade;

update media_assets a set family_id = m.family_id
  from memories m where m.id = a.memory_id and a.family_id is null;

create index if not exists media_assets_family_idx on media_assets(family_id);

create or replace function media_assets_set_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select family_id into new.family_id from memories where id = new.memory_id;
  if new.family_id is null then
    raise exception 'an asset must belong to a memory that has a family';
  end if;
  return new;
end;
$$;

drop trigger if exists media_assets_set_family_trg on media_assets;
create trigger media_assets_set_family_trg
  before insert or update of memory_id on media_assets
  for each row execute function media_assets_set_family();

alter table families add column if not exists storage_bytes bigint not null default 0;

-- Blocks of extra storage the family has bought. An integer rather than a
-- byte count, so the bill and the allowance cannot disagree about what a
-- block is.
alter table families add column if not exists storage_blocks int not null default 0;

alter table families
  add constraint families_storage_sane check (storage_bytes >= 0 and storage_blocks >= 0)
  not valid;

-- ---------------------------------------------------------- the running total

create or replace function media_assets_count_bytes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Reads new.family_id / old.family_id and never joins back to memories.
  -- That is the whole fix: on a cascading delete the memory is already gone.
  if tg_op = 'INSERT' then
    update families set storage_bytes = storage_bytes + coalesce(new.bytes, 0)
      where id = new.family_id;

  elsif tg_op = 'DELETE' then
    -- greatest(...) so a drifted total can never go negative and leave a
    -- family with a nonsense allowance.
    update families set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0))
      where id = old.family_id;

  elsif old.family_id is not distinct from new.family_id then
    update families
       set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0) + coalesce(new.bytes, 0))
     where id = new.family_id;

  else
    -- An asset moving between families should be impossible. The arithmetic
    -- is here so that if it ever happens the totals still add up rather than
    -- one family carrying another's bytes for ever.
    update families set storage_bytes = greatest(0, storage_bytes - coalesce(old.bytes, 0))
      where id = old.family_id;
    update families set storage_bytes = storage_bytes + coalesce(new.bytes, 0)
      where id = new.family_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists media_assets_count_bytes_trg on media_assets;
create trigger media_assets_count_bytes_trg
  after insert or update or delete on media_assets
  for each row execute function media_assets_count_bytes();

-- ------------------------------------------------------------- the safety net
--
-- A maintained total drifts if anything ever writes around the trigger. This
-- recomputes from the assets themselves; the schema harness runs it and
-- asserts nothing moved, which is the only way to know the trigger is still
-- telling the truth.

create or replace function recount_storage(fid uuid default null)
returns void language sql security definer set search_path = public as $$
  update families f
     set storage_bytes = coalesce((
       select sum(a.bytes) from media_assets a where a.family_id = f.id
     ), 0)
   where fid is null or f.id = fid;
$$;

-- Backfill: every asset currently records nothing, so every total is zero and
-- already correct. Run anyway, so the column is right by construction rather
-- than by argument.
select recount_storage();
