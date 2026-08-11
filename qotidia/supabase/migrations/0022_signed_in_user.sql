-- One name for "who is asking".
--
-- Every row-level security policy in this archive ultimately answers one
-- question — is the person making this request allowed to see this row —
-- and the answer starts with knowing who they are. Until now that was
-- `auth.uid()`, which is a function in Supabase's own schema. It works, and
-- there is nothing wrong with it, but it means the single most important
-- fact in the security model is spelled with somebody else's vendor name.
--
-- The point is not that Supabase is likely to be replaced. It is that a
-- family archive is supposed to outlive its hosting decisions, and the cost
-- of keeping that door open is one function.
--
-- Concretely: moving auth off Supabase today means rewriting three functions
-- and eighteen policies and getting every one of them right, in a system
-- where getting one wrong means one family reading another family's
-- photographs. After this migration it means rewriting one function body.
--
-- ## What this does not change
--
-- Nothing. Not one row's visibility differs before and after. The
-- definitions below were read back out of a live PostgreSQL — pg_proc and
-- pg_policies, after all twenty-one prior migrations had been applied — and
-- the only edit made to them was replacing the call. They are not
-- transcriptions of the migration files, because a transcription is where a
-- privacy hole would come from; several of these functions were redefined
-- two or three times across 0008, 0012 and 0019, and the file you would
-- naturally copy from is not the one that is running.
--
-- The access assertions in the harness are the proof. They ran against the
-- old policies and they run against these, unchanged.

/**
 * The signed-in user, or null.
 *
 * This is the seam. Everything that needs to know who is asking calls this
 * and nothing else, so the day the answer comes from somewhere other than a
 * Supabase JWT — a self-hosted GoTrue, Auth.js, an enterprise SSO — this
 * body changes and the eighteen policies below do not.
 *
 * Marked stable rather than volatile so PostgreSQL inlines it: the planner
 * folds a simple stable SQL function into the expression that calls it, so
 * the indirection costs nothing per row. Not security definer — it reads a
 * request setting and touches no table, so there is no privilege to lend.
 */
create or replace function signed_in_user()
returns uuid language sql stable
set search_path = ''
as $$ select auth.uid() $$;

comment on function signed_in_user() is
  'Who is making this request. The one place the archive learns that, so the identity provider stays replaceable.';

-- ------------------------------------------------------------------ helpers
--
-- Live definitions as of migration 0021, with the call swapped.

create or replace function family_role_of(fid uuid)
returns family_role language sql stable security definer set search_path = public as $$
  select role from family_memberships
   where family_id = fid and user_id = signed_in_user()
$$;

create or replace function can_see_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memories m
     where m.id = mid
       and is_family_member(m.family_id)
       and (m.contribution_status = 'approved'
            or m.created_by = signed_in_user()
            or can_edit_family(m.family_id)))
$$;

create or replace function can_edit_memory(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memories m
     where m.id = mid
       and (can_edit_family(m.family_id)
            or (m.created_by = signed_in_user() and m.contribution_status = 'pending')))
$$;

-- ----------------------------------------------------------------- policies

drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select using (id = signed_in_user());

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (id = signed_in_user());

drop policy if exists "families insert" on families;
create policy "families insert" on families
  for insert with check (owner_user_id = signed_in_user());

-- Leaving is allowed; an owner leaving would orphan the archive, so that one
-- goes through transferring ownership instead.
drop policy if exists "memberships leave" on family_memberships;
create policy "memberships leave" on family_memberships
  for delete using (user_id = signed_in_user() and role <> 'owner');

drop policy if exists "memories read" on memories;
create policy "memories read" on memories
  for select using (
    is_family_member(family_id)
    and (contribution_status = 'approved'
         or created_by = signed_in_user()
         or can_edit_family(family_id))
    and (visibility = 'family' or created_by = signed_in_user()));

drop policy if exists "memories insert" on memories;
create policy "memories insert" on memories
  for insert with check (is_family_member(family_id) and created_by = signed_in_user());

drop policy if exists "comments insert" on memory_comments;
create policy "comments insert" on memory_comments
  for insert with check (can_see_memory(memory_id) and author_user_id = signed_in_user());

drop policy if exists "comments update own" on memory_comments;
create policy "comments update own" on memory_comments
  for update using (author_user_id = signed_in_user())
  with check (author_user_id = signed_in_user());

drop policy if exists "comments delete" on memory_comments;
create policy "comments delete" on memory_comments
  for delete using (
    author_user_id = signed_in_user()
    or exists (select 1 from memories m
                where m.id = memory_comments.memory_id and can_edit_family(m.family_id)));

drop policy if exists "own email preferences" on email_preferences;
create policy "own email preferences" on email_preferences
  for all using (user_id = signed_in_user()) with check (user_id = signed_in_user());

drop policy if exists "own email deliveries" on email_deliveries;
create policy "own email deliveries" on email_deliveries
  for select using (user_id = signed_in_user());

drop policy if exists "exports request" on archive_exports;
create policy "exports request" on archive_exports
  for insert with check (can_edit_family(family_id) and requested_by = signed_in_user());

drop policy if exists "deletion read" on deletion_requests;
create policy "deletion read" on deletion_requests
  for select using (requested_by = signed_in_user() or is_family_member(family_id));

drop policy if exists "deletion request" on deletion_requests;
create policy "deletion request" on deletion_requests
  for insert with check (is_family_owner(family_id) and requested_by = signed_in_user());

-- ------------------------------------------------------------------ storage
--
-- These are the most vendor-shaped objects in the schema — they live in
-- Supabase's storage schema and use its foldername() helper — and they are
-- the ones most likely to be replaced first, because object storage is where
-- the hosting bill actually is. Swapped anyway, so that "nothing but
-- signed_in_user() knows about auth" is a rule with no exceptions to
-- remember, which is the only kind of rule that survives.

drop policy if exists "media owner select" on storage.objects;
create policy "media owner select" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = signed_in_user()::text);
