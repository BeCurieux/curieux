-- One archive, many books.
--
-- Until now a memory belonged to a subject: this photograph is Florence's.
-- That was right while Qotidia made one kind of book, and it is wrong the
-- moment it makes two. A morning in Cornwall with Florence, Theo and both
-- grandparents in it is one morning. Asking a family to file it under a
-- child, and then to upload it again under the household, is asking them to
-- do the work the product exists to do.
--
-- So the archive owns the memories, and a book is a question asked of the
-- archive:
--
--   Florence · Two        the memories Florence is in
--   The Wilsons · 2028    the year, all of it
--   Theo · Five           the same Cornwall morning, a different story
--
-- Two rules decide what a book may take, and both are here rather than in
-- application code, because the failure mode of getting them wrong is one
-- family's memories appearing in another family's book.
--
-- **A memory with nobody tagged belongs to the household.** It is in the
-- family annual and in no child's book. The alternative is inferring who a
-- photograph is about, and this product does not infer.
--
-- **A child's book takes only memories tagged with that child.** Not ones
-- that mention them, not ones from the same afternoon. Tagged, by a person.
-- Anything looser is a guess about a child's life dressed as a record of it.
--
-- Threads stay per-story on purpose. A cluster is a thread *within* a book,
-- and the same Cornwall morning supports "collecting shells" in Florence's
-- book and "learning to swim" in Theo's. Those are two threads over one
-- memory, which is the whole point.

-- ------------------------------------------------------------- the owner

alter table memories add column if not exists family_id uuid references families(id) on delete cascade;

update memories m
   set family_id = s.family_id
  from subjects s
 where s.id = m.subject_id
   and m.family_id is null;

-- Anything orphaned by an older bug would silently become unreachable, so it
-- is louder to fail the migration than to ship an archive with holes in it.
alter table memories alter column family_id set not null;

create index if not exists memories_family_idx on memories (family_id, memory_date);

-- ------------------------------------------------------- who it is about

create table if not exists memory_subjects (
  memory_id  uuid not null references memories(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (memory_id, subject_id)
);

create index if not exists memory_subjects_subject_idx on memory_subjects (subject_id);

-- Everything already in the archive is about the subject it was filed under.
insert into memory_subjects (memory_id, subject_id)
select id, subject_id from memories where subject_id is not null
on conflict do nothing;

-- The old column goes rather than staying as a hint. Two places recording
-- which subject a memory belongs to is two places to disagree, and this
-- codebase has paid for that mistake more than once — a price in five
-- places, a tagline in two.
alter table memories drop column if exists subject_id;

-- ---------------------------------------------------------------- access

-- Rewritten to read family_id off the memory directly. It used to reach
-- through the subject, which no longer exists here and was always a hop
-- longer than it needed to be.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(m.family_id)
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(m.family_id))) $$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (can_edit_family(m.family_id)
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;

-- Memories were reachable through owns_subject(subject_id). That column is
-- gone, so every policy on the table is restated against the family.
drop policy if exists "memories readable by family" on memories;
drop policy if exists "memories insertable by family" on memories;
drop policy if exists "memories updatable by family" on memories;
drop policy if exists "memories deletable by family" on memories;
drop policy if exists "memories read" on memories;
drop policy if exists "memories insert" on memories;
drop policy if exists "memories update" on memories;
drop policy if exists "memories delete" on memories;

create policy "memories read" on memories for select
  using (is_family_member(family_id)
         and (contribution_status = 'approved'
              or created_by = auth.uid()
              or can_edit_family(family_id))
         and (visibility = 'family' or created_by = auth.uid()));

-- A contributor may add. Whether it is published is contribution_status's
-- job, not this policy's.
create policy "memories insert" on memories for insert
  with check (is_family_member(family_id) and created_by = auth.uid());

create policy "memories update" on memories for update
  using (can_edit_memory(id)) with check (is_family_member(family_id));

create policy "memories delete" on memories for delete
  using (can_edit_family(family_id));

create or replace function family_of_memory(mid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from memories where id = mid $$;

-- A link may never cross families.
--
-- Enforced by a trigger rather than by the policy below, because the policy
-- does not run for the service role and several jobs legitimately use it.
-- The failure this prevents is the worst one available in this product: a
-- memory from one family appearing in another family's book. It should not
-- depend on every caller remembering, and it should not depend on which
-- client happened to make the call.
create or replace function memory_subject_same_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if family_of_memory(new.memory_id) is distinct from family_of_subject(new.subject_id) then
    raise exception 'memory % and subject % are not in the same family',
      new.memory_id, new.subject_id;
  end if;
  return new;
end $$;

drop trigger if exists memory_subjects_same_family on memory_subjects;
create trigger memory_subjects_same_family
  before insert or update on memory_subjects
  for each row execute function memory_subject_same_family();

-- The links follow the memory: if you can see it you can see who it is
-- about, and if you can edit it you can say who it is about.
alter table memory_subjects enable row level security;

create policy "memory subjects read" on memory_subjects for select
  using (can_see_memory(memory_id));

create policy "memory subjects write" on memory_subjects for insert
  with check (can_edit_memory(memory_id) and owns_subject(subject_id));

create policy "memory subjects remove" on memory_subjects for delete
  using (can_edit_memory(memory_id));
