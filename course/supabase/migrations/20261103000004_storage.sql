-- The private bucket for lesson downloads (SPEC.md → Content loading):
-- benchmark sheets, PDFs and templates.
--
-- Private, and with no storage policies for anon or authenticated, so no
-- customer can list or fetch a file directly. /api/assets/[id] checks her
-- tier, then hands out a signed URL that expires in a minute.
--
-- Needs Supabase's storage schema, so the plain-Postgres RLS tests skip it.

insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-assets', 'lesson-assets', false, 52428800)
on conflict (id) do update set public = false;
