"""Lease-based indexing worker. No database write key is used by the mobile app."""
import argparse
import logging
import os
import threading
import time
from transformers import AutoTokenizer
from config import ROOT,Settings,MODEL_ID
from clients import Database,Models
from ingestion import chunk_document
from secrets_store import load_key

log=logging.getLogger('index_worker')


def process(db,models,tokenizer,claimed):
    job=claimed['job']; stop=threading.Event(); lost=threading.Event()
    params={'p_job':job['job_id'],'p_lease':job['lease_token']}
    def heartbeat():
        while not stop.wait(60):
            try:
                if not db.rpc('bb_job_heartbeat',params):
                    lost.set(); return
            except Exception:
                lost.set(); return
    thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
    try:
        if job.get('model_id')!=MODEL_ID:
            raise ValueError('model_version_mismatch')
        chunks=chunk_document(claimed['document'],tokenizer,os.getenv('BB_SOURCE_ROOT'))
        if len(chunks)>10000:
            raise ValueError('document_exceeds_chunk_limit')
        for offset in range(0,len(chunks),16):
            if lost.is_set():
                raise ValueError('lease_lost')
            batch=chunks[offset:offset+16]
            vectors=models.embed([c['embedding_text'] for c in batch])
            for chunk,vector in zip(batch,vectors):
                chunk.pop('embedding_text');chunk['embedding']=vector
            db.rpc('bb_stage_chunks',{**params,'p_chunks':batch})
            for chunk in batch:
                chunk.pop('embedding')
        db.rpc('bb_finish_job',{**params,'p_expected':len(chunks)})
        log.info('job=%s revision=%s chunks=%s ready',job['job_id'],job['revision'],len(chunks))
    except Exception as error:
        # Store only a bounded error code; no document content, credentials, or request payloads.
        code=getattr(error,'code',None) or (str(error) if isinstance(error,ValueError) else type(error).__name__)
        db.rpc('bb_fail_job',{**params,'p_code':code[:80]})
        log.warning('job=%s failed code=%s',job['job_id'],code[:80])
    finally:
        stop.set();thread.join(timeout=2)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');args=parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    key=load_key()
    if not key:
        raise SystemExit('Configure the server-only worker credential before starting ingestion.')
    settings=Settings.from_env();db=Database(settings,key);models=Models(settings)
    tokenizer=AutoTokenizer.from_pretrained(ROOT/'models'/'embedding',local_files_only=True)
    connection_failures=0
    while True:
        try:
            claimed=db.rpc('bb_claim_job')
            connection_failures=0
            if claimed:
                process(db,models,tokenizer,claimed)
            elif args.once:
                break
            else:
                time.sleep(5)
        except Exception as error:
            connection_failures+=1
            log.warning('worker connection unavailable stage=%s',getattr(error,'stage','indexing'))
            if args.once:
                raise SystemExit(1) from None
            time.sleep(min(60,2**min(connection_failures,6)))


if __name__=='__main__':
    main()
