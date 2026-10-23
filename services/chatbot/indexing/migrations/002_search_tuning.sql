-- Tune per lookup after the vector extension has loaded. No new permissions.
CREATE OR REPLACE FUNCTION public.bb_search_hybrid(p_embedding public.vector(1024),p_query text,p_model text,p_count integer DEFAULT 32)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_model<>'BAAI/bge-m3@5617a9f61b028005a4858fdac845db406aefb181' THEN RAISE EXCEPTION 'model_mismatch'; END IF;
 PERFORM set_config('hnsw.ef_search','400',true);
 PERFORM set_config('hnsw.iterative_scan','strict_order',true);
 WITH eligible AS NOT MATERIALIZED (
  SELECT c.*,d.title,d.document_type,d.ordinance_no FROM public.bb_search_chunks c
  JOIN public.documents d ON d.document_id=c.document_id AND d.bb_search_revision=c.revision
  WHERE c.is_current AND c.model_id=p_model AND d.approval_status='Approved' AND d.is_active
 ), vs AS MATERIALIZED (
  SELECT chunk_id,row_number() OVER(ORDER BY embedding OPERATOR(public.<=>) p_embedding) rank
  FROM (SELECT * FROM eligible ORDER BY embedding OPERATOR(public.<=>) p_embedding LIMIT 80) v
 ), fs AS MATERIALIZED (
  SELECT chunk_id,row_number() OVER(ORDER BY ts_rank_cd(search_text,websearch_to_tsquery('simple',left(p_query,4000))) DESC) rank
  FROM eligible WHERE search_text@@websearch_to_tsquery('simple',left(p_query,4000))
  ORDER BY ts_rank_cd(search_text,websearch_to_tsquery('simple',left(p_query,4000))) DESC LIMIT 80
 ), fused AS (
 SELECT coalesce(vs.chunk_id,fs.chunk_id) chunk_id,coalesce(1.0/(60+vs.rank),0)+coalesce(1.0/(60+fs.rank),0) score
 FROM vs FULL JOIN fs USING(chunk_id)
 ), chosen AS (
 SELECT c.chunk_id,c.document_id,c.revision,c.title,c.document_type,c.ordinance_no,c.section_title,c.content,c.content_hash,c.token_count,c.provenance,
 1-(c.embedding OPERATOR(public.<=>) p_embedding) similarity,f.score,
 coalesce(to_jsonb(m)-'document_id','{}'::jsonb) metadata
 FROM fused f JOIN eligible c USING(chunk_id) LEFT JOIN public.bb_source_metadata m USING(document_id)
 ORDER BY f.score DESC LIMIT greatest(1,least(p_count,80))
 ) SELECT coalesce(jsonb_agg(to_jsonb(chosen)),'[]'::jsonb) INTO result FROM chosen;
 RETURN result;
END $$;
