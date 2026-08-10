-- Two things about who may read a family's memories.
--
-- The second is the one this migration was opened for. The first was found
-- on the way and matters more.
--
--
-- ## 1. "Keep this to myself" was only half true
--
-- The rule that a private memory is private was written in two places: the
-- `memories read` policy, and can_see_memory(). 0012 introduced it in both.
-- 0019 and 0022 each rewrote the function — for unrelated reasons, one to
-- move to the family_id column and one to swap auth.uid() for
-- signed_in_user() — and neither carried the visibility clause across. The
-- policy kept it. The function lost it.
--
-- Nothing failed, because the two are only ever compared by reading them.
-- The result, verified against a live database rather than reasoned about:
--
--     as a contributor, reading the owner's private memory
--       memories row    0     <- correctly hidden
--       media_assets    1     <- the photograph
--       can_see_memory  true
--
-- The row is hidden and the file is not. can_see_memory() also gates
-- memory_people, memory_tags, memory_comments and memory_subjects, so the
-- tags and the people on a private memory were readable too. Meanwhile the
-- upload page's checkbox says "Only you can see this... nobody else in the
-- family will ever see it."
--
-- The fix is not to patch the function to match the policy. It is to have
-- one copy: can_see_memory() carries the whole rule, and `memories read`
-- calls it, which is what 0008 did before 0012 inlined a second version.
-- Two copies of a privacy rule will diverge again — this one took three
-- migrations.
--
--
-- ## 2. The support grant unlocked nothing
--
-- support_access_active() has existed since 0011 and is referenced by no
-- policy. A family could grant support access from their settings, the grant
-- was recorded, it expired on its own, it appeared in the activity log — and
-- it permitted exactly nothing, because the only way anybody here could read
-- an archive was the service credential, which bypasses row-level security
-- entirely and does not consult grants.
--
-- A consent a family gives that unlocks nothing is worse than not offering
-- it. So the grant becomes a real key, and a deliberately small one:
--
--   **Staff and a live grant, both.** Being an administrator grants nothing
--   on its own. There is no path here that a grant alone opens either.
--
--   **Read only.** No insert, update or delete, on anything. "Support never
--   edits your archive" stops being a promise and becomes a fact about the
--   database.
--
--   **Never private.** Support reads strictly less than a family member
--   does. It runs through can_see_memory_as_support(), which is the ordinary
--   rule with the membership test swapped and the private exclusion made
--   unconditional — a parent's private note is not a support matter.
--
--   **Five tables.** Subjects, memories, media assets, books and pages: what
--   is needed to answer "why is her book stuck". Not comments, not people,
--   not tags, not the entity graph.
--
-- What this does not do, and the /help page says so in as many words: the
-- service credential that runs the product can still read any row. This
-- closes the supported path, not physics.

-- ---------------------------------------------------------------- 1. private

-- The whole rule, in one place. The last clause is the one that went missing.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and is_family_member(m.family_id)
        and (m.contribution_status = 'approved'
             or m.created_by = signed_in_user()
             or can_edit_family(m.family_id))
        -- Private is private, including from the people who can moderate.
        -- A parent who marks something private has not asked anybody to
        -- review it, and an owner who could read it anyway would make the
        -- word meaningless.
        and (m.visibility = 'family' or m.created_by = signed_in_user())) $$;

-- And the policy defers to it rather than restating it. This is the line
-- whose absence let the two drift for three migrations.
drop policy if exists "memories read" on memories;
create policy "memories read" on memories for select using (can_see_memory(id));

-- Editing had the same hole: 0012 excluded private from can_edit_memory and
-- 0019/0022 dropped that too. An owner could not see another member's
-- private memory and could still update it by id.
create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and (m.visibility = 'family' or m.created_by = signed_in_user())
        and (can_edit_family(m.family_id)
             or (m.created_by = signed_in_user() and m.contribution_status = 'pending'))) $$;

-- ---------------------------------------------------------------- 2. support

/** Whether the signed-in person is staff here. Says nothing about access. */
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(
     (select p.is_admin from profiles p where p.id = signed_in_user()), false) $$;

/**
 * Whether support may read this family right now.
 *
 * Both halves, always. An administrator with no grant reads nothing, and a
 * grant with nobody to use it opens nothing.
 */
create or replace function support_may_read(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_staff() and support_access_active(fid) $$;

/**
 * A memory, as support may see it.
 *
 * Strictly less than a family member sees. The private exclusion has no
 * "unless you wrote it" escape here, because support wrote none of it and a
 * parent's private note is not a support matter. Unapproved contributions
 * are excluded for the same reason: they are not yet part of the archive
 * and nobody outside the family has been asked to look at them.
 */
create or replace function can_see_memory_as_support(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
      where m.id = mid
        and support_may_read(m.family_id)
        and m.visibility = 'family'
        and m.contribution_status = 'approved') $$;

-- The five tables. Select only, every one of them — there is deliberately no
-- support policy anywhere in this file that permits a write.
drop policy if exists "subjects support read" on subjects;
create policy "subjects support read" on subjects
  for select using (support_may_read(family_id));

drop policy if exists "memories support read" on memories;
create policy "memories support read" on memories
  for select using (can_see_memory_as_support(id));

drop policy if exists "media_assets support read" on media_assets;
create policy "media_assets support read" on media_assets
  for select using (can_see_memory_as_support(memory_id));

-- books hangs off subject_id, not family_id, and book_pages off book_id.
-- Routed through the same helpers the ordinary policies use rather than a
-- second way of spelling the same join.
drop policy if exists "books support read" on books;
create policy "books support read" on books
  for select using (support_may_read(family_of_subject(subject_id)));

drop policy if exists "book_pages support read" on book_pages;
create policy "book_pages support read" on book_pages
  for select using (
    exists (select 1 from books b
             where b.id = book_pages.book_id
               and support_may_read(family_of_subject(b.subject_id))));
