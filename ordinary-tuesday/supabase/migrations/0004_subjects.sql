-- Generalise `children` into `subjects`.
--
-- The engine — memories, clustering, questions, provenance, books, print —
-- was always category-agnostic. This migration removes the last assumption
-- that a book is about a child, so the same machinery can carry:
--
--   child   a year of one child's life        "The Year You Were Two"
--   family  a calendar year of a household    "Our Year, 2027"
--   life    a whole life, told in eras        "The Life of Margaret"
--
-- Per-type behaviour (titling, sections, question style, little-thing
-- categories) lives in src/lib/subjects/config.ts, not in the schema.

create type subject_type as enum ('child', 'family', 'life');

-- A life story is chaptered by era rather than by month.
alter type section_type add value if not exists 'era';

-- ---------------------------------------------------------------- table

alter table children rename to subjects;
alter table subjects rename column first_name to display_name;
alter table subjects rename column profile_photo_path to photo_path;

alter table subjects add column subject_type subject_type not null default 'child';

-- A family has no birthday; a life story may only know a birth year.
alter table subjects alter column date_of_birth drop not null;

-- Child books are anchored to a date of birth. Nothing else requires one.
alter table subjects add constraint child_requires_dob
  check (subject_type <> 'child' or date_of_birth is not null);

-- ---------------------------------------------------------------- columns

alter table memories            rename column child_id to subject_id;
alter table memory_clusters     rename column child_id to subject_id;
alter table follow_up_questions rename column child_id to subject_id;
alter table little_things       rename column child_id to subject_id;
alter table books               rename column child_id to subject_id;

alter index memories_child_date_idx rename to memories_subject_date_idx;

-- `year_number` counts a child's years of life. For a family it is the
-- calendar year; for a life story it is unused.
alter table books alter column year_number drop not null;

-- ---------------------------------------------------------------- ownership

-- Policies follow the renamed table automatically, but the helper they call
-- still points at `children`. Replace it, then repoint every dependent policy.
create or replace function owns_subject(sid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from subjects s join families f on f.id = s.family_id
     where s.id = sid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memories m
     join subjects s on s.id = m.subject_id
     join families f on f.id = s.family_id
     where m.id = mid and f.owner_user_id = auth.uid()) $$;

create or replace function owns_cluster(clid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from memory_clusters mc
     where mc.id = clid and owns_subject(mc.subject_id)) $$;

create or replace function owns_book(bid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from books b where b.id = bid and owns_subject(b.subject_id)) $$;

-- Recreate the policies that referenced owns_child / child_id.
drop policy if exists "children all"            on subjects;
drop policy if exists "memories all"            on memories;
drop policy if exists "memory_clusters all"     on memory_clusters;
drop policy if exists "follow_up_questions all" on follow_up_questions;
drop policy if exists "little_things all"       on little_things;
drop policy if exists "books all"               on books;

create policy "subjects all" on subjects for all
  using (owns_family(family_id)) with check (owns_family(family_id));

create policy "memories all" on memories for all
  using (owns_subject(subject_id))
  with check (owns_subject(subject_id) and created_by = auth.uid());

create policy "memory_clusters all" on memory_clusters for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "follow_up_questions all" on follow_up_questions for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "little_things all" on little_things for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

create policy "books all" on books for all
  using (owns_subject(subject_id)) with check (owns_subject(subject_id));

drop function if exists owns_child(uuid);

-- Age remains derived, never stored.
drop function if exists child_age_years(date, date);

create or replace function subject_age_years(dob date, at_date date default current_date)
returns int language sql immutable as
$$ select case when dob is null then null
                else date_part('year', age(at_date, dob))::int end $$;
