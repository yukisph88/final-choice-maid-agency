-- =====================================================================================
-- Final Choice — file storage (run after 0001, in Supabase → SQL Editor)
--
--   maid-private : PRIVATE bucket. Working photos (<CODE>.webp) and biodata PDFs (pdfs/<CODE>.pdf).
--                  Only signed-in active staff can view; editors/admins can upload/replace/delete.
--                  Passports, medical reports and other confidential documents: keep them in the
--                  office files — do not upload them at all.
--   maid-public  : PUBLIC bucket (the website shows these). A file can be written ONLY for a maid who is
--                  published AND has photo consent, and it must be named <CODE>.webp. Max 300 KB, WebP only.
--                  No listing: visitors can only load a photo whose exact address the website gives them.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maid-private', 'maid-private', false, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maid-public', 'maid-public', true, 307200, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- private bucket
drop policy if exists "fc private read" on storage.objects;
create policy "fc private read" on storage.objects for select to authenticated
  using (bucket_id = 'maid-private' and public.is_staff());
drop policy if exists "fc private write" on storage.objects;
create policy "fc private write" on storage.objects for insert to authenticated
  with check (bucket_id = 'maid-private' and public.can_edit());
drop policy if exists "fc private update" on storage.objects;
create policy "fc private update" on storage.objects for update to authenticated
  using (bucket_id = 'maid-private' and public.can_edit()) with check (bucket_id = 'maid-private' and public.can_edit());
drop policy if exists "fc private delete" on storage.objects;
create policy "fc private delete" on storage.objects for delete to authenticated
  using (bucket_id = 'maid-private' and public.can_edit());

-- public bucket: only for a published maid with photo consent, file name = <code>.webp
create or replace function public.public_photo_allowed(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.maids m
    where object_name = lower(m.code) || '.webp' and m.published and m.photo_consent and m.consent_recorded
  );
$$;
revoke all on function public.public_photo_allowed(text) from public, anon;
grant execute on function public.public_photo_allowed(text) to authenticated;

drop policy if exists "fc public staff read" on storage.objects;
create policy "fc public staff read" on storage.objects for select to authenticated
  using (bucket_id = 'maid-public' and public.is_staff());
drop policy if exists "fc public write" on storage.objects;
create policy "fc public write" on storage.objects for insert to authenticated
  with check (bucket_id = 'maid-public' and public.can_edit() and public.public_photo_allowed(name));
drop policy if exists "fc public update" on storage.objects;
create policy "fc public update" on storage.objects for update to authenticated
  using (bucket_id = 'maid-public' and public.can_edit()) with check (bucket_id = 'maid-public' and public.can_edit() and public.public_photo_allowed(name));
drop policy if exists "fc public delete" on storage.objects;
create policy "fc public delete" on storage.objects for delete to authenticated
  using (bucket_id = 'maid-public' and public.can_edit());
