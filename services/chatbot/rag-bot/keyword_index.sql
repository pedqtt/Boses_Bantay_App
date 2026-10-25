-- Optional performance migration for keyword-first search. Not auto-applied.
-- Review/run once in Supabase SQL editor as owner. No new table access granted.
begin;
create extension if not exists pg_trgm with schema extensions;
set local search_path = public, extensions, pg_catalog;
create index if not exists rag_documents_content_trgm
  on public.rag_documents using gin (content gin_trgm_ops);
-- Filter before the vector limit. Legacy rows without active are active;
-- metadata.active=false retires a chunk without deleting it.
create or replace function public.match_rag_documents(
  query_embedding vector(768), match_count int default 5
) returns table (id bigint, content text, metadata jsonb, similarity double precision)
language sql stable security invoker
set search_path = public, extensions, pg_catalog
as $$
  select d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from public.rag_documents d
  where d.embedding is not null
    and (d.metadata->>'active' is null or d.metadata->>'active' = 'true')
  order by d.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 100);
$$;
revoke all on function public.match_rag_documents(vector, int) from public, anon, authenticated;
grant execute on function public.match_rag_documents(vector, int) to service_role;
commit;
