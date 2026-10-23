"""One version contract shared by ingestion, retrieval and model services."""
from dataclasses import dataclass
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent.parent
EMBED_REVISION = "5617a9f61b028005a4858fdac845db406aefb181"
RERANK_REVISION = "953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e"
VERIFY_REVISION = "8adb042d524ecd5c26d3e3ba0e3fbcf7e2d0864c"
GENERATOR_TOKENIZER_REVISION = 'cdbee75f17c01a7cc42f958dc650907174af0554'
MODEL_ID = "BAAI/bge-m3@" + EMBED_REVISION
CHUNKER_VERSION = "paragraph-token-v2-t384-o48"


def mobile_config():
    path = Path(os.getenv("BB_MOBILE_ENV", str(ROOT.parent.parent.parent / ".env")))
    values = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip().startswith("EXPO_PUBLIC_"):
                values[key.strip()] = value.strip().strip("\"'")
    return values


@dataclass(frozen=True)
class Settings:
    database_url: str
    public_key: str
    inference_url: str = "http://127.0.0.1:8002"
    embedding_model: str = MODEL_ID
    embedding_dimensions: int = 1024
    candidate_count: int = 32
    rerank_count: int = 24
    context_count: int = 6
    context_tokens: int = 2400
    # Cross-encoder sigmoid scores are ranking scores, not calibrated correctness probabilities.
    minimum_relevance: float = 0.025
    confident_relevance: float = 0.075
    minimum_entailment: float = 0.75
    max_concurrent_requests: int = 4
    model_timeout: float = 120.0
    source_languages: str = 'English, Filipino'

    @classmethod
    def from_env(cls):
        public = mobile_config()
        return cls(
            database_url=os.getenv("SUPABASE_URL", public.get("EXPO_PUBLIC_SUPABASE_URL", "")).rstrip("/"),
            public_key=os.getenv("SUPABASE_ANON_KEY", public.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")),
            inference_url=os.getenv("BB_INFERENCE_URL", "http://127.0.0.1:8002").rstrip("/"),
            candidate_count=min(80, max(8, int(os.getenv("BB_CANDIDATES", "32")))),
            rerank_count=min(48, max(4, int(os.getenv("BB_RERANK_COUNT", "24")))),
            context_count=min(12, max(2, int(os.getenv("BB_CONTEXT_COUNT", "6")))),
            context_tokens=min(6000, max(800, int(os.getenv("BB_CONTEXT_TOKENS", "2400")))),
            minimum_relevance=float(os.getenv("BB_MIN_RELEVANCE", "0.025")),
            confident_relevance=float(os.getenv("BB_CONFIDENT_RELEVANCE", "0.075")),
            minimum_entailment=float(os.getenv("BB_MIN_ENTAILMENT", "0.75")),
            max_concurrent_requests=max(1, int(os.getenv("BB_MAX_INFLIGHT", "4"))),
            source_languages=os.getenv('BB_SOURCE_LANGUAGES','English, Filipino'),
        )
