"""Load PDF/TXT documents into the isolated rag_documents table.

Run only one ingestion process at a time. File replacements are not transactional.
"""
import json
import math
import re
import sys
from pathlib import Path

from ollama import Client
from pypdf import PdfReader
from supabase import create_client
import config

BATCH_SIZE = 50
EMBED_BATCH_SIZE = 8


class IngestFailure(Exception):
    """A safe, actionable message without SDK payloads or credentials."""


def chunk_text(text, size=config.CHUNK_SIZE, overlap=config.CHUNK_OVERLAP):
    if size <= 0 or not 0 <= overlap < size:
        raise ValueError("Require chunk size > overlap >= 0.")
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            # Search near the end, so boundaries never prevent forward progress.
            floor = start + max(overlap + 1, size // 2)
            candidates = list(re.finditer(r"\n\s*\n|(?<=[.!?])\s+", text[floor:end]))
            if candidates:
                end = floor + candidates[-1].end()
            else:
                space = text.rfind(" ", floor, end)
                if space >= floor:
                    end = space + 1
        content = text[start:end].strip()
        if content:
            yield content
        if end == len(text):
            break
        start = end - overlap


def load_units(path):
    """Extract each PDF page separately, retaining original 1-based page numbers."""
    if path.suffix.lower() == ".txt":
        return [(None, path.read_text(encoding="utf-8-sig"))]
    reader = PdfReader(path)
    if reader.is_encrypted and not reader.decrypt(""):
        raise IngestFailure("Password-protected PDF. Supply an unlocked copy.")
    return [(number, page.extract_text() or "")
            for number, page in enumerate(reader.pages, 1)]


def prepare_rows(path, answers=None):
    if not path.name.strip():
        raise IngestFailure("A source filename is required.")
    answers = [] if answers is None else answers
    if not isinstance(answers, list):
        raise IngestFailure('Stored answers must be a list of question/language/answer records.')
    for entry in answers:
        if (not isinstance(entry, dict) or set(entry) != {'questions', 'language', 'answer'}
                or entry['language'] not in {'english', 'tagalog', 'taglish'}
                or not isinstance(entry['questions'], list) or not entry['questions']
                or any(not isinstance(q, str) or not q.strip() for q in entry['questions'])
                or not isinstance(entry['answer'], str) or not entry['answer'].strip()
                or re.search(r'\[\d+\]|https?://', entry['answer'])):
            raise IngestFailure('Invalid stored answer: supply questions, language, and an exact source excerpt without citation markers or links.')
    rows = []
    for page, text in load_units(path):
        for content in chunk_text(text):
            metadata = {"source": path.name, "chunk_index": len(rows),
                        "embedding_model": config.EMBED_MODEL, "active": True}
            if page is not None:
                metadata["page"] = page
            matching = [entry for entry in answers if entry['answer'] in content]
            if matching:
                metadata['answers'] = matching
            rows.append({"content": content, "metadata": metadata})
    if any(not any(entry['answer'] in row['content'] for row in rows) for entry in answers):
        raise IngestFailure('A stored answer must be an exact excerpt contained in a document chunk. Nothing was indexed.')
    return rows


def embed_rows(rows, models):
    for offset in range(0, len(rows), EMBED_BATCH_SIZE):
        batch = rows[offset:offset + EMBED_BATCH_SIZE]
        try:
            result = models.embed(model=config.EMBED_MODEL,
                                  input=["search_document: " + row["content"] for row in batch],
                                  truncate=False, keep_alive="0s")
        except Exception as error:
            raise IngestFailure("Ollama embedding failed (" + type(error).__name__ +
                                "). Check Ollama and model availability; existing rows retained.") from None
        if len(result.embeddings) != len(batch):
            raise IngestFailure("Ollama returned an unexpected embedding count; existing rows retained.")
        for row, vector in zip(batch, result.embeddings):
            if len(vector) != config.EMBED_DIMENSIONS or not all(
                    isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
                    for v in vector):
                raise IngestFailure("Invalid 768-dimensional embedding; existing rows retained.")
            if not any(vector):
                raise IngestFailure("Zero embedding cannot be cosine-indexed; existing rows retained.")
            row["embedding"] = vector


def ingest_file(path, database, models, answers=None):
    # Finish extraction and embeddings before deleting an existing file's index.
    try:
        rows = prepare_rows(path, answers=answers)
    except IngestFailure:
        raise
    except Exception as error:
        raise IngestFailure("Cannot read file (" + type(error).__name__ +
                            "). Check encoding/PDF integrity; existing rows retained.") from None
    if not rows:
        print(f"SKIP {path.name}: no extractable text. Existing rows retained; scans need OCR.")
        return 0
    print(f"{path.name}: {len(rows)} chunks, embedding...")
    embed_rows(rows, models)
    written = 0
    try:
        database.table(config.DOCUMENTS_TABLE).delete().eq("metadata->>source", path.name).execute()
        for offset in range(0, len(rows), BATCH_SIZE):
            batch = rows[offset:offset + BATCH_SIZE]
            database.table(config.DOCUMENTS_TABLE).insert(batch, returning="minimal").execute()
            written += len(batch)
    except Exception as error:
        raise IngestFailure(f"Supabase replacement failed ({type(error).__name__}); "
                            f"{written}/{len(rows)} rows confirmed. Replacement is not atomic; "
                            "fix connectivity and rerun this file to replace any partial rows.") from None
    print(f"OK {path.name}: {written} rows inserted.")
    return written


def main():
    paths = sorted(path for path in config.DOCS_DIR.iterdir()
                   if path.is_file() and path.suffix.lower() in {".pdf", ".txt"}) if config.DOCS_DIR.is_dir() else []
    if not paths:
        print(f"No PDF/TXT files found. Add documents to {config.DOCS_DIR} and rerun.")
        return 1
    try:
        config.validate_supabase()
        database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
        models = Client(host=config.OLLAMA_HOST, timeout=180)
    except Exception as error:
        print(f"FAIL: Configuration/client setup failed ({type(error).__name__}). Check local .env.")
        return 1
    inserted = failures = 0
    for path in paths:
        try:
            inserted += ingest_file(path, database, models)
        except IngestFailure as error:
            failures += 1
            print(f"FAIL {path.name}: {error}")
    print(f"Total rows inserted this run: {inserted}; failed files: {failures}.")
    try:
        count = database.table(config.DOCUMENTS_TABLE).select("id", count="exact", head=True).execute().count
        samples = database.table(config.DOCUMENTS_TABLE).select("id,content,metadata").order("id").limit(3).execute().data
        print(f"Total rows currently stored: {count}")
        print("Sample rows (excerpts, no embeddings or keys):")
        for row in samples:
            row["content"] = row["content"][:180]
            print(json.dumps(row, ensure_ascii=True))
    except Exception as error:
        print(f"FAIL: Could not verify stored rows ({type(error).__name__}). Check Supabase connectivity.")
        return 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
