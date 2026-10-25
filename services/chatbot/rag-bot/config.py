"""Configuration for the isolated local Ollama chatbot."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").strip()
CHAT_MODEL = "qwen3:8b"
CHAT_THINK = False
EMBED_MODEL = "nomic-embed-text"
EMBED_DIMENSIONS = 768
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200
TOP_K = 5
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.3"))
DOCS_DIR = ROOT / "docs"
DOCUMENTS_TABLE = "rag_documents"
MATCH_FUNCTION = "match_rag_documents"


def validate_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in rag-bot/.env.")
    if not SUPABASE_URL.startswith("https://"):
        raise ValueError("SUPABASE_URL must use HTTPS.")
