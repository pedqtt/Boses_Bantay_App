-- Additive migration. Legacy documents/chunks and their permissions are unchanged.
BEGIN;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS bb_search_revision bigint NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.bb_source_metadata (
 document_id bigint PRIMARY KEY REFERENCES public.documents(document_id) ON DELETE CASCADE,
 authority_rank integer NOT NULL DEFAULT 0 CHECK(authority_rank BETWEEN 0 AND 100),
 policy_key text, jurisdiction text, effective_from date, effective_to date,
 supersedes_document_id bigint, source_url text,
 CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to>=effective_from)
);
CREATE TABLE IF NOT EXISTS public.bb_index_jobs (
 job_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id bigint NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
 revision bigint NOT NULL, model_id text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','running','ready','failed','superseded')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, error_code text, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,revision,model_id)
);
CREATE INDEX IF NOT EXISTS bb_jobs_pending ON public.bb_index_jobs(state,available_at);
CREATE TABLE IF NOT EXISTS public.bb_search_chunks (
 chunk_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id bigint NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
 revision bigint NOT NULL, model_id text NOT NULL,
 chunker_version text NOT NULL, chunk_index integer NOT NULL,
 section_title text NOT NULL, content text NOT NULL,
 content_hash text NOT NULL, token_count integer NOT NULL CHECK(token_count BETWEEN 1 AND 512),
 provenance jsonb NOT NULL DEFAULT '{}', embedding public.vector(1024) NOT NULL,
 is_current boolean NOT NULL DEFAULT true,
 search_text tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, section_title||' '||content)) STORED,
 UNIQUE(document_id,revision,model_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS bb_chunks_hnsw ON public.bb_search_chunks USING hnsw(embedding public.vector_cosine_ops) WHERE is_current;
CREATE INDEX IF NOT EXISTS bb_chunks_fts ON public.bb_search_chunks USING gin(search_text) WHERE is_current;
CREATE INDEX IF NOT EXISTS bb_chunks_document ON public.bb_search_chunks(document_id,revision,model_id) WHERE is_current;
ALTER TABLE public.bb_source_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_index_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_search_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_source_metadata,public.bb_index_jobs,public.bb_search_chunks FROM anon,authenticated;
GRANT ALL ON public.bb_source_metadata,public.bb_index_jobs,public.bb_search_chunks TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.bb_index_jobs_job_id_seq,public.bb_search_chunks_chunk_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.bb_document_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['bb_search_revision','chunk_count','vector_status','summary'])
     IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['bb_search_revision','chunk_count','vector_status','summary']) THEN
   NEW.bb_search_revision:=OLD.bb_search_revision; RETURN NEW;
  END IF;
  NEW.bb_search_revision:=OLD.bb_search_revision+1;
 ELSE NEW.bb_search_revision:=1;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.bb_document_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.bb_search_revision<>OLD.bb_search_revision THEN
  UPDATE public.bb_search_chunks SET is_current=false WHERE document_id=NEW.document_id AND is_current;
  UPDATE public.bb_index_jobs SET state='superseded',updated_at=now()
   WHERE document_id=NEW.document_id AND state IN('pending','running','failed');
  IF NEW.approval_status='Approved' AND NEW.is_active THEN
   INSERT INTO public.bb_index_jobs(document_id,revision,model_id)
   VALUES(NEW.document_id,NEW.bb_search_revision,'BAAI/bge-m3@5617a9f61b028005a4858fdac845db406aefb181') ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bb_document_revision ON public.documents;
CREATE TRIGGER bb_document_revision BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.bb_document_revision();
DROP TRIGGER IF EXISTS bb_document_enqueue ON public.documents;
CREATE TRIGGER bb_document_enqueue AFTER INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.bb_document_enqueue();

CREATE OR REPLACE FUNCTION public.bb_claim_job() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.bb_index_jobs; d public.documents;
BEGIN
 SELECT * INTO j FROM public.bb_index_jobs WHERE attempts<5 AND
 ((state='pending' AND available_at<=now()) OR (state='running' AND leased_until<now()))
 ORDER BY available_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.bb_index_jobs SET state='running',attempts=attempts+1,
 lease_token=extensions.gen_random_uuid(),leased_until=now()+interval '10 minutes',updated_at=now()
 WHERE job_id=j.job_id RETURNING * INTO j;
 SELECT * INTO d FROM public.documents WHERE document_id=j.document_id;
 RETURN jsonb_build_object('job',to_jsonb(j),'document',to_jsonb(d));
END $$;
CREATE OR REPLACE FUNCTION public.bb_job_heartbeat(p_job bigint,p_lease uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH u AS (UPDATE public.bb_index_jobs SET leased_until=now()+interval '10 minutes',updated_at=now()
 WHERE job_id=p_job AND lease_token=p_lease AND state='running' AND leased_until>now() RETURNING 1)
 SELECT EXISTS(SELECT 1 FROM u)
$$;
CREATE OR REPLACE FUNCTION public.bb_fail_job(p_job bigint,p_lease uuid,p_code text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.bb_index_jobs SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
 available_at=now()+make_interval(secs=>least(900,30*power(2,attempts)::int)),
 error_code=left(p_code,80),lease_token=NULL,leased_until=NULL,updated_at=now()
 WHERE job_id=p_job AND lease_token=p_lease AND state='running'
$$;
CREATE OR REPLACE FUNCTION public.bb_publish_chunks(p_job bigint,p_lease uuid,p_chunks jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.bb_index_jobs; d public.documents; n integer;
BEGIN
 SELECT * INTO j FROM public.bb_index_jobs WHERE job_id=p_job FOR UPDATE;
 IF j.state<>'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.leased_until<now() THEN RAISE EXCEPTION 'lease_invalid'; END IF;
 SELECT * INTO d FROM public.documents WHERE document_id=j.document_id FOR UPDATE;
 IF d.bb_search_revision<>j.revision OR d.approval_status<>'Approved' OR NOT d.is_active THEN RAISE EXCEPTION 'source_changed'; END IF;
 IF jsonb_array_length(p_chunks) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_chunk_count'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_chunks) c WHERE
  length(c->>'content')=0 OR length(c->>'content_hash')<>64 OR
  c->>'chunker_version'<>'paragraph-token-v2-t384-o48' OR
  jsonb_array_length(c->'embedding')<>1024) THEN RAISE EXCEPTION 'invalid_chunk_contract'; END IF;
 UPDATE public.bb_search_chunks SET is_current=false WHERE document_id=j.document_id AND is_current;
 INSERT INTO public.bb_search_chunks(document_id,revision,model_id,chunker_version,chunk_index,section_title,content,content_hash,token_count,provenance,embedding)
 SELECT j.document_id,j.revision,j.model_id,c->>'chunker_version',(c->>'chunk_index')::int,c->>'section_title',c->>'content',c->>'content_hash',
 (c->>'token_count')::int,c->'provenance',(c->'embedding')::text::public.vector
 FROM jsonb_array_elements(p_chunks) c;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.bb_index_jobs SET state='ready',lease_token=NULL,leased_until=NULL,error_code=NULL,updated_at=now() WHERE job_id=j.job_id;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.bb_search_hybrid(p_embedding public.vector(1024),p_query text,p_model text,p_count integer DEFAULT 32)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_model<>'BAAI/bge-m3@5617a9f61b028005a4858fdac845db406aefb181' THEN RAISE EXCEPTION 'model_mismatch'; END IF;
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
CREATE OR REPLACE FUNCTION public.bb_search_catalogue() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('approved',count(*),'indexed',count(*) FILTER(WHERE EXISTS(
 SELECT 1 FROM public.bb_search_chunks c WHERE c.document_id=d.document_id AND c.revision=d.bb_search_revision AND c.is_current)),
 'titles',(SELECT coalesce(jsonb_agg(title),'[]') FROM (SELECT title FROM public.documents WHERE approval_status='Approved' AND is_active ORDER BY document_id DESC LIMIT 8) x))
 FROM public.documents d WHERE approval_status='Approved' AND is_active
$$;
CREATE OR REPLACE FUNCTION public.bb_validate_sources(p_sources jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_sources) s WHERE NOT EXISTS(
 SELECT 1 FROM public.bb_search_chunks c JOIN public.documents d USING(document_id)
 WHERE c.chunk_id=(s->>'chunk_id')::bigint AND c.revision=(s->>'revision')::bigint AND c.is_current
 AND d.bb_search_revision=c.revision AND d.approval_status='Approved' AND d.is_active))
$$;
REVOKE ALL ON FUNCTION public.bb_document_revision(),public.bb_document_enqueue(),public.bb_claim_job(),public.bb_job_heartbeat(bigint,uuid),public.bb_fail_job(bigint,uuid,text),public.bb_publish_chunks(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bb_claim_job(),public.bb_job_heartbeat(bigint,uuid),public.bb_fail_job(bigint,uuid,text),public.bb_publish_chunks(bigint,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bb_search_hybrid(public.vector,text,text,integer),public.bb_search_catalogue(),public.bb_validate_sources(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_search_hybrid(public.vector,text,text,integer),public.bb_search_catalogue(),public.bb_validate_sources(jsonb) TO anon,authenticated,service_role;
INSERT INTO public.bb_index_jobs(document_id,revision,model_id)
SELECT document_id,bb_search_revision,'BAAI/bge-m3@5617a9f61b028005a4858fdac845db406aefb181' FROM public.documents
WHERE approval_status='Approved' AND is_active ON CONFLICT DO NOTHING;
NOTIFY pgrst,'reload schema';
COMMIT;
