-- Bounded ingestion requests with one atomic visibility switch per document.
ALTER TABLE public.bb_search_chunks ADD COLUMN IF NOT EXISTS staging_lease uuid;
CREATE OR REPLACE FUNCTION public.bb_stage_chunks(p_job bigint,p_lease uuid,p_chunks jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.bb_index_jobs; n integer;
BEGIN
 SELECT * INTO j FROM public.bb_index_jobs WHERE job_id=p_job FOR UPDATE;
 IF j.state<>'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.leased_until<now() THEN RAISE EXCEPTION 'lease_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.document_id=j.document_id AND d.bb_search_revision=j.revision AND d.approval_status='Approved' AND d.is_active) THEN RAISE EXCEPTION 'source_changed'; END IF;
 IF jsonb_array_length(p_chunks) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'invalid_batch_size'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_chunks) c WHERE length(c->>'content')=0 OR length(c->>'content_hash')<>64
  OR c->>'chunker_version'<>'paragraph-token-v2-t384-o48' OR jsonb_array_length(c->'embedding')<>1024) THEN RAISE EXCEPTION 'invalid_chunk_contract'; END IF;
 INSERT INTO public.bb_search_chunks(document_id,revision,model_id,chunker_version,chunk_index,section_title,content,content_hash,token_count,provenance,embedding,is_current,staging_lease)
 SELECT j.document_id,j.revision,j.model_id,c->>'chunker_version',(c->>'chunk_index')::int,c->>'section_title',c->>'content',c->>'content_hash',(c->>'token_count')::int,c->'provenance',(c->'embedding')::text::public.vector,false,p_lease
 FROM jsonb_array_elements(p_chunks) c
 ON CONFLICT(document_id,revision,model_id,chunk_index) DO UPDATE SET
 chunker_version=EXCLUDED.chunker_version,section_title=EXCLUDED.section_title,content=EXCLUDED.content,
 content_hash=EXCLUDED.content_hash,token_count=EXCLUDED.token_count,provenance=EXCLUDED.provenance,
 embedding=EXCLUDED.embedding,is_current=false,staging_lease=p_lease;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.bb_finish_job(p_job bigint,p_lease uuid,p_expected integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.bb_index_jobs; n integer;
BEGIN
 SELECT * INTO j FROM public.bb_index_jobs WHERE job_id=p_job FOR UPDATE;
 IF j.state<>'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.leased_until<now() THEN RAISE EXCEPTION 'lease_invalid'; END IF;
 PERFORM 1 FROM public.documents d WHERE d.document_id=j.document_id AND d.bb_search_revision=j.revision AND d.approval_status='Approved' AND d.is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'source_changed'; END IF;
 SELECT count(*) INTO n FROM public.bb_search_chunks WHERE document_id=j.document_id AND revision=j.revision AND model_id=j.model_id AND staging_lease=p_lease;
 IF p_expected NOT BETWEEN 1 AND 10000 OR n<>p_expected THEN RAISE EXCEPTION 'incomplete_staging'; END IF;
 IF (SELECT min(chunk_index)<>0 OR max(chunk_index)<>p_expected-1 FROM public.bb_search_chunks WHERE document_id=j.document_id AND revision=j.revision AND model_id=j.model_id AND staging_lease=p_lease) THEN RAISE EXCEPTION 'invalid_chunk_sequence'; END IF;
 UPDATE public.bb_search_chunks SET is_current=false WHERE document_id=j.document_id AND is_current;
 UPDATE public.bb_search_chunks SET is_current=true WHERE document_id=j.document_id AND revision=j.revision AND model_id=j.model_id AND staging_lease=p_lease;
 UPDATE public.bb_index_jobs SET state='ready',lease_token=NULL,leased_until=NULL,error_code=NULL,updated_at=now() WHERE job_id=j.job_id;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bb_stage_chunks(bigint,uuid,jsonb),public.bb_finish_job(bigint,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bb_stage_chunks(bigint,uuid,jsonb),public.bb_finish_job(bigint,uuid,integer) TO service_role;
NOTIFY pgrst,'reload schema';
