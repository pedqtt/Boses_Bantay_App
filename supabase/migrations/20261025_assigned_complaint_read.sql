-- Add only the ability to read complaints explicitly assigned to the signed-in account.
begin;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='service_complaints' and policyname='Users view complaints assigned to them') then
    create policy "Users view complaints assigned to them" on public.service_complaints
      for select to authenticated using (assigned_to = (select auth.uid()));
  end if;
end $$;
create index if not exists service_complaints_assigned_to_created_idx on public.service_complaints (assigned_to, created_at desc) where assigned_to is not null;
commit;
