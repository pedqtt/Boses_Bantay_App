-- Private photo evidence for existing public.reports service-complaint records.
-- No report rows or existing report policies are modified.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report_evidence', 'report_evidence', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'report_evidence' and public) then
    raise exception 'Existing report_evidence bucket is public; review before applying private photo policies';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Residents upload own report photos') then
    create policy "Residents upload own report photos" on storage.objects for insert to authenticated
      with check (bucket_id = 'report_evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Residents read own report photos') then
    create policy "Residents read own report photos" on storage.objects for select to authenticated
      using (bucket_id = 'report_evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Residents remove own report photos') then
    create policy "Residents remove own report photos" on storage.objects for delete to authenticated
      using (bucket_id = 'report_evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
commit;
