-- Product photos and logos, in a private bucket.
--
-- Each customer's files live under a folder named for her user id
-- (`<user id>/<file id>.<ext>`), and these policies let her touch only that
-- folder. Nothing is public: the app hands out short-lived signed URLs after
-- checking ownership (src/app/api/uploads/[...path]/route.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "read own uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "add own uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "remove own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
