"""Reusable local-admin upload functions, independent of Streamlit.

Only new filenames are accepted. Replacement/version management is deferred.
"""
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
import re

import config
from ingest import IngestFailure, ingest_file, prepare_rows

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@dataclass(frozen=True)
class UploadPreview:
    filename: str
    chunk_count: int
    pages: tuple
    excerpt: str


def validate_upload(filename: str, data: bytes) -> str:
    if not filename or filename != filename.strip() or re.search(r'[<>:"/\\|?*\x00-\x1f]', filename):
        raise IngestFailure("Use a plain filename without paths or special characters.")
    if len(filename) > 180 or filename.endswith((".", " ")):
        raise IngestFailure("Use a filename under 181 characters without a trailing dot or space.")
    stem = filename.split(".")[0].upper()
    if stem in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?:COM|LPT)[1-9]", stem):
        raise IngestFailure("This filename is reserved by Windows. Rename the file.")
    if Path(filename).suffix.lower() not in {".pdf", ".txt"}:
        raise IngestFailure("Only PDF and UTF-8 TXT files are supported.")
    if not isinstance(data, bytes) or not data:
        raise IngestFailure("The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise IngestFailure("The file exceeds the 20 MB upload limit.")
    return filename


def preview_upload(filename: str, data: bytes) -> UploadPreview:
    """Validate and extract without saving to docs, embedding or database access."""
    filename = validate_upload(filename, data)
    try:
        with TemporaryDirectory() as directory:
            source = Path(directory) / filename
            source.write_bytes(data)
            rows = prepare_rows(source)
    except IngestFailure:
        raise
    except Exception as error:
        raise IngestFailure(f"Cannot read this file ({type(error).__name__}). Use a valid PDF or UTF-8 TXT.") from None
    if not rows:
        raise IngestFailure("No readable text found. Scanned PDFs need OCR before upload.")
    return UploadPreview(filename, len(rows), tuple(sorted({r['metadata']['page'] for r in rows
                                                           if 'page' in r['metadata']})),
                         "\n\n".join(r['content'] for r in rows)[:2000])


def ingest_upload(filename: str, data: bytes, database, models, docs_dir=None) -> int:
    """Save and index one new file. Inject clients to reuse this in another UI.

    Existing filenames are rejected. The existing ingestion backend is not atomic;
    a database insert failure can leave partial rows requiring manual cleanup.
    """
    preview = preview_upload(filename, data)
    directory = Path(docs_dir) if docs_dir is not None else config.DOCS_DIR
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / preview.filename
    lock = directory / ".upload.lock"
    try:
        handle = lock.open("x")
    except FileExistsError:
        raise IngestFailure("Another upload is indexing. Wait for it to finish and retry.") from None
    try:
        with handle:
            if target.exists():
                raise IngestFailure("That filename already exists locally. Rename the new file; replacement is not supported yet.")
            try:
                existing = database.table(config.DOCUMENTS_TABLE).select("id").eq(
                    "metadata->>source", preview.filename).limit(1).execute().data
            except Exception as error:
                raise IngestFailure(f"Could not check Supabase ({type(error).__name__}). Nothing was saved.") from None
            if existing:
                raise IngestFailure("That filename is already indexed. Rename the new file; replacement is not supported yet.")
            try:
                with target.open("xb") as stream:
                    stream.write(data)
                return ingest_file(target, database, models)
            except IngestFailure:
                target.unlink(missing_ok=True)
                raise
            except Exception as error:
                # A conflicting file must never be removed.
                raise IngestFailure(f"Could not save/index the file ({type(error).__name__}). Check local storage and database state.") from None
    finally:
        lock.unlink(missing_ok=True)
