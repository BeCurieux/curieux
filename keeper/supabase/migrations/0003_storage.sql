-- Keeper — private storage buckets.
-- All child media is private by default (brief §4). No public buckets.
-- Print PDFs are shared with the printer only via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

-- media/: user uploads, path convention  <user_id>/<child_id>/<filename>
-- Users can only touch objects under their own user id folder.
create policy "media owner select" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner insert" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media owner delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- renders/: generated PDFs. No user policies — service role only.
-- Users receive their digital PDF via server-generated signed URLs.
