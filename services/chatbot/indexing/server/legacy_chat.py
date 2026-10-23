"""Document-grounded Barangay-Bot. No mock answers or invented local policies."""
import math
import os
from functools import lru_cache

from chat_search import contextual_query, expanded_query, rank_matches, focused_excerpt, features, normalize, english_query, TOPICS
from pathlib import Path

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
EMBED_MODEL = os.getenv("CHAT_EMBED_MODEL", "nomic-embed-text:v1.5")
def _mobile_public_config():
    # Share the existing public project configuration for local development.
    # Server process variables always take precedence.
    path = Path(__file__).resolve().parent.parent / "boses-bantay-mobile" / ".env"
    try:
        values = {}
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() in {"EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"}:
                values[key.strip()] = value.strip().strip("\"'")
        return values
    except OSError:
        return {}


_public_config = _mobile_public_config()
SUPABASE_URL = os.getenv("SUPABASE_URL", _public_config.get("EXPO_PUBLIC_SUPABASE_URL", "")).rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", _public_config.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", ""))
VECTOR_RPC = os.getenv("CHAT_VECTOR_RPC", "match_document_chunks")
# Set these to the parameter names of the existing vector retrieval RPC.
EMBEDDING_PARAM = os.getenv("CHAT_EMBEDDING_PARAM", "query_embedding")
THRESHOLD_PARAM = os.getenv("CHAT_THRESHOLD_PARAM", "match_threshold")
COUNT_PARAM = os.getenv("CHAT_COUNT_PARAM", "match_count")
THRESHOLD = float(os.getenv("CHAT_SIMILARITY_THRESHOLD", "0.73"))
CANDIDATE_THRESHOLD = min(THRESHOLD, float(os.getenv("CHAT_CANDIDATE_THRESHOLD", "0.50")))
FALLBACK = "Paumanhin, wala akong nahanap na sapat na impormasyon tungkol dito sa aming mga dokumento. Mangyaring makipag-ugnayan sa Barangay Hall para sa tulong."


class ChatUnavailable(Exception):
    pass


def _post(path, payload):
    try:
        response = requests.post(f"{OLLAMA_URL}{path}", json=payload, timeout=(5, 120))
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as error:
        raise ChatUnavailable("Chat model unavailable") from error


@lru_cache(maxsize=128)
def _embed(text):
    body = _post("/api/embeddings", {"model": EMBED_MODEL, "prompt": text, "options": {"num_gpu": 0}})
    vector = body.get("embedding")
    if not isinstance(vector, list) or not vector or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector):
        raise ChatUnavailable("Invalid document embedding")
    return vector


def _retrieve(vector):
    if not SUPABASE_URL or not SUPABASE_KEY or not VECTOR_RPC:
        raise ChatUnavailable("Vector database configuration is incomplete")
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{VECTOR_RPC}",
            headers={"apikey": SUPABASE_KEY, **({"Authorization": f"Bearer {SUPABASE_KEY}"} if not SUPABASE_KEY.startswith("sb_publishable_") else {})},
            json={EMBEDDING_PARAM: vector, THRESHOLD_PARAM: CANDIDATE_THRESHOLD, COUNT_PARAM: 12},
            timeout=(5, 15),
        )
        response.raise_for_status()
        rows = response.json()
        if not isinstance(rows, list):
            raise ValueError("Expected vector matches")
        matches = []
        for row in rows:
            content = row.get("content") or row.get("text")
            score = row.get("similarity")
            if not isinstance(content, str) or not isinstance(score, (int, float)):
                raise ValueError("Expected content and similarity in vector results")
            if not math.isfinite(score) or score < CANDIDATE_THRESHOLD:
                continue
            metadata = row.get("metadata") or {}
            matches.append({
                "text": content,
                "similarity": score,
                "documentId": row.get("document_id"),
                "chunkId": row.get("chunk_id"),
                "documentTitle": row.get("document_title") or row.get("documentTitle") or metadata.get("documentTitle") or metadata.get("title") or "Barangay document",
                "section": row.get("section_title") or row.get("section") or metadata.get("section") or "Retrieved excerpt",
            })
        return matches
    except (requests.RequestException, ValueError, AttributeError, TypeError) as error:
        raise ChatUnavailable("Vector database retrieval unavailable") from error


def answer_query(query, history=None):
    query = query.strip()
    if not query:
        raise ValueError("Query cannot be blank")
    greeting = normalize(query)
    if greeting in {"hi", "hello", "hey", "kumusta", "kamusta", "magandang umaga", "good morning", "good evening"}:
        return {"answer": "Kumusta! Sabihin ang paksa at tanong mo. Hahanapin ko ang sagot sa mga dokumentong aprubado ng barangay, kasama ang pinanggalingang seksyon.", "citations": []}
    if greeting in {"salamat", "thank you", "thanks", "salamat po"}:
        return {"answer": "Walang anuman! Maaari ka pang magtanong tungkol sa ibang detalye sa dokumento.", "citations": []}
    effective = contextual_query(query, history)
    concepts, raw = features(effective, True)
    generic = {"registration", "requirements", "cost", "schedule", "venue", "age", "team"}
    if not concepts & TOPICS and concepts and concepts <= generic and not raw:
        return {"answer": "Anong paksa o serbisyo ang tinutukoy mo? Halimbawa, pagpaparehistro ng alagang hayop o pagsali sa paliga. Mas matutulungan kita kapag kasama ang paksa sa tanong.", "citations": []}
    if not SUPABASE_URL or not SUPABASE_KEY or not VECTOR_RPC:
        raise ChatUnavailable("Vector database configuration is incomplete")
    vector = _embed("search_query: " + expanded_query(effective))
    candidates = _retrieve(vector)
    selected = rank_matches(effective, candidates)
    if not selected:
        answer = ("I could not find enough information about that in the approved documents. Please name the topic or contact the Barangay Hall for confirmation." if english_query(query) else FALLBACK)
        return {"answer": answer, "citations": []}
    # Rank evidence, then extract complete source sentences/list items verbatim.
    # No generator can alter an amount, requirement, exception or penalty.
    sections = []
    for index, match in enumerate(selected, 1):
        excerpt = focused_excerpt(effective, match)
        sections.append((f"[{index}] {match['section']}\n" if len(selected) > 1 else "") + excerpt)
    prefix = "Here is what the approved document says:" if english_query(query) else "Narito ang nakasaad sa aprubadong dokumento:"
    return {
        "answer": prefix + "\n\n" + "\n\n".join(sections),
        "citations": [{"documentTitle": match["documentTitle"], "section": match["section"]} for match in selected],
    }
