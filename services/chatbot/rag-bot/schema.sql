-- Phase 2. Run in the Supabase SQL editor as the project owner.
-- Separate from the existing app documents and 1024-dimensional chunks.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set local search_path = public, extensions, pg_catalog;

create table public.rag_documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768)
);
create index rag_documents_embedding_hnsw
  on public.rag_documents using hnsw (embedding vector_cosine_ops);
alter table public.rag_documents enable row level security;
revoke all on table public.rag_documents from public, anon, authenticated;
revoke all on sequence public.rag_documents_id_seq from public, anon, authenticated;
grant select, insert, update, delete on public.rag_documents to service_role;
grant usage, select on sequence public.rag_documents_id_seq to service_role;

create function public.match_rag_documents(
  query_embedding vector(768), match_count int default 5
) returns table (id bigint, content text, metadata jsonb, similarity double precision)
language sql stable security invoker
set search_path = public, extensions, pg_catalog
as $$
  select d.id, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from public.rag_documents d
  where d.embedding is not null
  order by d.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 100);
$$;
revoke all on function public.match_rag_documents(vector, int) from public, anon, authenticated;
grant execute on function public.match_rag_documents(vector, int) to service_role;
commit;
-- Intentionally fails if rag_documents already exists; do not overwrite an unknown schema.
