-- Row Level Security for the shared archive.
--
-- The rule from the brief is unchanged and absolute: a user must never reach
-- another family's subjects, memories or books. What changes is that "this
-- family" is no longer one account — it is everyone with a membership row.
--
-- Access is therefore membership, and what you may *do* is your role:
--
--   read    any member, though a contributor sees approved content plus
--           whatever they themselves have added and is still waiting
--   write   owner and editor freely; a contributor may add, and may edit or
--           withdraw only their own contribution while it is still pending
--   manage  owner alone — access, moderation, print approval
--
-- Every helper is security definer with a pinned search_path, so a policy
-- cannot be subverted by a shadowed table name.

-- ------------------------------------------------------- role helpers

create or replace function family_role_of(fid uuid)
returns family_role language sql stable security definer set search_path = public as
$$ select role from family_memberships
   where family_id = fid and user_id = auth.uid() $$;

create or replace function is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) is not null $$;

create or replace function can_edit_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) in ('owner', 'editor') $$;

create or replace function is_family_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select family_role_of(fid) = 'owner' $$;

-- ---------------------------------------------------- subject helpers

create or replace function family_of_subject(sid uuid)
returns uuid language sql stable security definer set search_path = public as
$$ select family_id from subjects where id = sid $$;

-- Replaces the old owns_subject: membership, not ownership. Kept under the
-- same name so every policy that already calls it keeps working.
create or replace function owns_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_family_member(family_of_subject(sid)) $$;

create or replace function can_edit_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select can_edit_family(family_of_subject(sid)) $$;

create or replace function owns_family(fid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select is_family_member(fid) $$;

-- A memory is visible to any member once approved; while it is pending only
-- the person who added it and those who can moderate it may see it.
create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and is_family_member(family_of_subject(m.subject_id))
       and (m.contribution_status = 'approved'
            or m.created_by = auth.uid()
            or can_edit_family(family_of_subject(m.subject_id)))) $$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     where m.id = mid
       and (can_edit_family(family_of_subject(m.subject_id))
            -- A contributor may correct or withdraw their own, until it is
            -- reviewed. After that it belongs to the archive.
            or (m.created_by = auth.uid() and m.contribution_status = 'pending'))) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select can_see_memory(mid) $$;

-- ------------------------------------------------------ enable new tables

alter table family_memberships enable row level security;
alter table family_invitations enable row level security;
alter table memory_comments    enable row level security;

-- ------------------------------------------------------------- families

drop policy if exists "families all" on families;

create policy "families read" on families for select using (is_family_member(id));
create policy "families insert" on families for insert with check (owner_user_id = auth.uid());
create policy "families update" on families for update
  using (is_family_owner(id)) with check (is_family_owner(id));
create policy "families delete" on families for delete using (is_family_owner(id));

-- --------------------------------------------------------- memberships
--
-- Everyone can see who else is in the family — a shared archive with a
-- hidden guest list would be worse than no sharing at all. Only the owner
-- may add, change or remove access.

create policy "memberships read" on family_memberships for select
  using (is_family_member(family_id));
create policy "memberships manage" on family_memberships for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));
-- A member may always remove themselves.
create policy "memberships leave" on family_memberships for delete
  using (user_id = auth.uid() and role <> 'owner');

-- --------------------------------------------------------- invitations

create policy "invitations read" on family_invitations for select
  using (is_family_member(family_id));
create policy "invitations manage" on family_invitations for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- ------------------------------------------------------------- subjects

drop policy if exists "subjects all" on subjects;
drop policy if exists "children all" on subjects;

create policy "subjects read" on subjects for select using (is_family_member(family_id));
create policy "subjects write" on subjects for all
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- ------------------------------------------------------------- memories

drop policy if exists "memories all" on memories;

create policy "memories read" on memories for select using (can_see_memory(id));

-- Anyone in the family may add. What they may set contribution_status to is
-- enforced in the application, which knows the role; the database guarantees
-- only that you cannot add to a family you are not in, and cannot attribute
-- a memory to somebody else.
create policy "memories insert" on memories for insert
  with check (owns_subject(subject_id) and created_by = auth.uid());

create policy "memories update" on memories for update
  using (can_edit_memory(id)) with check (can_edit_memory(id));
create policy "memories delete" on memories for delete using (can_edit_memory(id));

-- --------------------------------------------------- memory attachments

drop policy if exists "media_assets all" on media_assets;
drop policy if exists "memory_people all" on memory_people;
drop policy if exists "memory_tags all" on memory_tags;

create policy "media_assets read" on media_assets for select using (can_see_memory(memory_id));
create policy "media_assets write" on media_assets for all
  using (can_edit_memory(memory_id)) with check (can_see_memory(memory_id));

create policy "memory_people read" on memory_people for select using (can_see_memory(memory_id));
create policy "memory_people write" on memory_people for all
  using (can_edit_memory(memory_id)) with check (can_edit_memory(memory_id));

create policy "memory_tags read" on memory_tags for select using (can_see_memory(memory_id));
create policy "memory_tags write" on memory_tags for all
  using (can_edit_memory(memory_id)) with check (can_edit_memory(memory_id));

-- --------------------------------------------------------------- comments
--
-- Any member may comment and may read the conversation. You may delete your
-- own; the owner may delete any, because they are answerable for the archive.

create policy "comments read" on memory_comments for select
  using (can_see_memory(memory_id));

create policy "comments insert" on memory_comments for insert
  with check (can_see_memory(memory_id) and author_user_id = auth.uid());

create policy "comments update own" on memory_comments for update
  using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());

create policy "comments delete" on memory_comments for delete
  using (
    author_user_id = auth.uid()
    or exists (select 1 from memories m
               where m.id = memory_id and can_edit_family(family_of_subject(m.subject_id)))
  );

-- ------------------------------------------- family_members (descriptive)
--
-- The cast list for the book — "Grandpa", "Nonna" — which is not the same
-- thing as who can log in. Readable by all, edited by owner and editor.

drop policy if exists "family_members all" on family_members;
create policy "family_members read" on family_members for select
  using (is_family_member(family_id));
create policy "family_members write" on family_members for all
  using (can_edit_family(family_id)) with check (can_edit_family(family_id));

-- ------------------------------------------------- everything downstream
--
-- Clusters, questions, little things and books are derived from the archive
-- rather than contributed to it, so they are readable by every member and
-- writable by those who can edit.

drop policy if exists "memory_clusters all" on memory_clusters;
create policy "memory_clusters read" on memory_clusters for select using (owns_subject(subject_id));
create policy "memory_clusters write" on memory_clusters for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "follow_up_questions all" on follow_up_questions;
create policy "questions read" on follow_up_questions for select using (owns_subject(subject_id));
create policy "questions write" on follow_up_questions for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "little_things all" on little_things;
create policy "little_things read" on little_things for select using (owns_subject(subject_id));
create policy "little_things write" on little_things for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

drop policy if exists "books all" on books;
create policy "books read" on books for select using (owns_subject(subject_id));
create policy "books write" on books for all
  using (can_edit_subject(subject_id)) with check (can_edit_subject(subject_id));

-- book_sections / book_pages / book_content_blocks route through owns_book,
-- which routes through owns_subject, so they follow automatically. Writes to
-- book structure are restricted to editors via the same helper.

create or replace function can_edit_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from books b where b.id = bid and can_edit_subject(b.subject_id)) $$;

drop policy if exists "book_sections all" on book_sections;
create policy "book_sections read" on book_sections for select using (owns_book(book_id));
create policy "book_sections write" on book_sections for all
  using (can_edit_book(book_id)) with check (can_edit_book(book_id));

drop policy if exists "book_pages all" on book_pages;
create policy "book_pages read" on book_pages for select using (owns_book(book_id));
create policy "book_pages write" on book_pages for all
  using (can_edit_book(book_id)) with check (can_edit_book(book_id));

drop policy if exists "book_content_blocks all" on book_content_blocks;
create policy "book_content_blocks read" on book_content_blocks for select using (owns_page(page_id));
create policy "book_content_blocks write" on book_content_blocks for all
  using (exists (select 1 from book_pages p where p.id = page_id and can_edit_book(p.book_id)))
  with check (exists (select 1 from book_pages p where p.id = page_id and can_edit_book(p.book_id)));
