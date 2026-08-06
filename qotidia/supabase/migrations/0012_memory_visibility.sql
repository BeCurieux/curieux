-- Keeping something to yourself.
--
-- Sharing an archive with grandparents is the point, but it also means
-- everything a parent writes is read by their mother-in-law. Some things
-- belong in a childhood record and not in that conversation: a hard week, a
-- worry, a thing you want to remember and don't want discussed at Christmas.
--
-- So a memory is either shared with the family or private to whoever wrote
-- it. Two levels, not five — a privacy control nobody understands is worse
-- than none, because people assume the reassuring reading and are wrong.
--
-- A private memory NEVER reaches the book. The book is shared: the whole
-- family reads it and extra copies go to grandparents, so a private note
-- printed on page forty would be the most complete failure of this feature
-- imaginable. The UI says so at the moment of choosing, in those words.

create type memory_visibility as enum ('family', 'private');

alter table memories
  add column if not exists visibility memory_visibility not null default 'family';

-- Private memories are read constantly by exactly one person; index for that
-- rather than across the whole table.
create index memories_private_idx on memories (created_by, created_at desc)
  where visibility = 'private';

-- ------------------------------------------------------------------ RLS

-- Extends the moderation rules already in 0008: a memory must clear both.
-- Being approved does not make a private note visible, and being shared does
-- not make an unapproved contribution visible.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(family_of_subject(m.subject_id))
       -- Private is private, including from the people who can moderate.
       -- A parent who marks something private has not asked anyone to
       -- review it, and an owner who could read it anyway would make the
       -- word meaningless.
       and (m.visibility = 'family' or m.created_by = auth.uid())
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(family_of_subject(m.subject_id)))) $$;

-- Editing follows the same rule: nobody edits what they cannot see.
create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (m.visibility = 'family' or m.created_by = auth.uid())
       and (can_edit_family(family_of_subject(m.subject_id))
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;
