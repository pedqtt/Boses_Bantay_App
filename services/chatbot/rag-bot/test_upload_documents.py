import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from ingest import IngestFailure
from upload_documents import preview_upload, ingest_upload, validate_upload


class UploadTests(unittest.TestCase):
    def test_preview_without_database(self):
        preview = preview_upload('guide.txt', b'A local document with readable content.')
        self.assertEqual(preview.chunk_count, 1)
        self.assertEqual(preview.pages, ())
        self.assertIn('readable content', preview.excerpt)

    def test_reject_paths_reserved_names_empty_and_unsupported(self):
        for name in ['../bad.txt', r'..\bad.txt', 'CON.txt', 'x.exe', 'bad:stream.txt']:
            with self.subTest(name=name), self.assertRaises(IngestFailure):
                validate_upload(name, b'text')
        with self.assertRaises(IngestFailure):
            validate_upload('empty.txt', b'')

    def test_size_limit_and_unreadable_text(self):
        with patch('upload_documents.MAX_UPLOAD_BYTES', 3):
            with self.assertRaises(IngestFailure):
                validate_upload('big.txt', b'1234')
        for data in [b'\xff\xfe\xff', b' \n\n ']:
            with self.assertRaises(IngestFailure):
                preview_upload('bad.txt', data)

    def test_new_upload_saves_and_calls_existing_ingestion(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
        with tempfile.TemporaryDirectory() as folder, patch('upload_documents.ingest_file', return_value=1) as ingest:
            self.assertEqual(ingest_upload('guide.txt', b'Document content.', db, object(), folder), 1)
            self.assertEqual((Path(folder) / 'guide.txt').read_bytes(), b'Document content.')
            ingest.assert_called_once()
            self.assertFalse((Path(folder) / '.upload.lock').exists())

    def test_local_duplicate_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'guide.txt'
            path.write_bytes(b'Original')
            with self.assertRaises(IngestFailure):
                ingest_upload('guide.txt', b'Replacement', MagicMock(), object(), folder)
            self.assertEqual(path.read_bytes(), b'Original')

    def test_indexed_duplicate_is_not_saved(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[{'id': 1}])
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(IngestFailure):
                ingest_upload('guide.txt', b'Document content.', db, object(), folder)
            self.assertFalse((Path(folder) / 'guide.txt').exists())

    def test_index_failure_removes_local_upload_and_releases_lock(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
        with tempfile.TemporaryDirectory() as folder, patch('upload_documents.ingest_file', side_effect=IngestFailure('Embedding failed')):
            with self.assertRaises(IngestFailure):
                ingest_upload('guide.txt', b'Document content.', db, object(), folder)
            self.assertEqual(list(Path(folder).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
