-- Run AFTER schema.sql. The dummy row is rolled back, even on success.
begin;
set local search_path = public, extensions, pg_catalog;
do $$
declare
  probe vector(768) := (array[1.0::real] || array_fill(0.0::real, array[767]))::vector;
  probe_id bigint;
  score double precision;
begin
  insert into public.rag_documents(content, metadata, embedding)
    values ('Phase 2 temporary verification', '{"verification":true}', probe)
    returning id into probe_id;
  select r.similarity into score from public.match_rag_documents(probe, 100) r
    where r.id = probe_id;
  if score is null or abs(score - 1.0) > 0.000001 then
    raise exception 'Self-match verification failed: %', score;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.rag_documents'::regclass) then
    raise exception 'RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.rag_documents', 'SELECT') or
     has_function_privilege('anon', 'public.match_rag_documents(vector,integer)', 'EXECUTE') then
    raise exception 'Unexpected anonymous access';
  end if;
  raise notice 'PASS: self-match similarity %, RLS enabled, anonymous access denied', score;
end $$;
rollback;
select count(*) as remaining_verification_rows from public.rag_documents
where metadata @> '{"verification":true}'::jsonb;
-- Expected: NOTICE with similarity 1, and remaining_verification_rows = 0.
