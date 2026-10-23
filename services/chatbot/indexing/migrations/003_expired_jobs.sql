-- Recover a crashed worker's final exhausted attempt into a visible failed state.
CREATE OR REPLACE FUNCTION public.bb_claim_job() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.bb_index_jobs; d public.documents;
BEGIN
 UPDATE public.bb_index_jobs SET state='failed',error_code='lease_expired',lease_token=NULL,leased_until=NULL,updated_at=now()
 WHERE state='running' AND attempts>=5 AND leased_until<now();
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
