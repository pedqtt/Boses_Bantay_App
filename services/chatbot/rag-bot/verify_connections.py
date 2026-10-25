"""Phase 3 checks. Never prints credentials, document contents, or request headers."""
import sys
import httpx
from ollama import Client, ResponseError
from supabase import create_client
import config


def main():
    failures = 0
    try:
        client = Client(host=config.OLLAMA_HOST, timeout=120)
        available = {item.model for item in client.list().models}
        missing = [name for name in (config.CHAT_MODEL, config.EMBED_MODEL)
                   if name not in available and name + ":latest" not in available]
        if missing:
            raise ValueError("Missing models: " + ", ".join(missing))
        response = client.embed(model=config.EMBED_MODEL,
                                input="search_document: Connection verification.", keep_alive=0)
        vector = response.embeddings[0]
        import math
        if len(vector) != config.EMBED_DIMENSIONS or not all(math.isfinite(v) for v in vector):
            raise ValueError("Expected 768 finite embedding values.")
        print("OK: Ollama connected; both models available; embedding dimensions = 768.")
    except (ConnectionError, httpx.ConnectError):
        failures += 1
        print("FAIL: Ollama is unreachable. Start Ollama, then rerun this check.")
    except ResponseError as error:
        failures += 1
        print(f"FAIL: Ollama returned HTTP {error.status_code}. Check the installed models and server logs.")
    except ValueError as error:
        failures += 1
        print("FAIL: " + str(error))
    except Exception as error:
        failures += 1
        print(f"FAIL: Ollama check failed ({type(error).__name__}); no credentials or response payload printed.")
    try:
        config.validate_supabase()
        database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
        database.table(config.DOCUMENTS_TABLE).select("id", count="exact", head=True).execute()
        print("OK: Supabase connected; rag_documents is accessible.")
    except ValueError as error:
        failures += 1
        print("FAIL: " + str(error))
    except Exception as error:
        failures += 1
        print(f"FAIL: Supabase check failed ({type(error).__name__}). Check URL, backend key, network and Phase 2 schema. Sensitive error details withheld.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
