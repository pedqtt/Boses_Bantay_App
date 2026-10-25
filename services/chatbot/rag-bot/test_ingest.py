import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from pypdf import PdfWriter
import ingest


class FakeDatabase:
    def __init__(self):
        self.rows = []
        self.batches = []
        self.action = None

    def table(self, name):
        assert name == 'rag_documents'
        return self

    def delete(self):
        self.action = 'delete'
        return self

    def eq(self, field, value):
        assert field == 'metadata->>source'
        self.source = value
        return self

    def insert(self, rows, returning):
        self.action = 'insert'
        self.batch = rows
        return self

    def execute(self):
        if self.action == 'delete':
            self.rows = [r for r in self.rows if r['metadata']['source'] != self.source]
        else:
            self.rows.extend(self.batch)
            self.batches.append(len(self.batch))


class Models:
    def embed(self, **kwargs):
        assert kwargs['truncate'] is False
        assert all(text.startswith('search_document: ') for text in kwargs['input'])
        return SimpleNamespace(embeddings=[[1.0] + [0.0] * 767 for _ in kwargs['input']])


class IngestionTests(unittest.TestCase):
    def test_overlap_preserves_all_characters_and_bounds(self):
        text = ''.join(chr(0x400 + i) for i in range(3200))
        chunks = list(ingest.chunk_text(text))
        self.assertTrue(all(len(c) <= 1500 for c in chunks))
        self.assertEqual(chunks[0] + ''.join(c[200:] for c in chunks[1:]), text)

    def test_paragraph_and_sentence_boundaries(self):
        for text in ['a' * 900 + '\n\n' + 'b' * 900, 'a' * 900 + '. ' + 'b' * 900]:
            chunks = list(ingest.chunk_text(text))
            self.assertEqual(len(chunks), 2)
            self.assertLess(len(chunks[0]), 1500)
            self.assertIn('b' * 300, chunks[1])

    def test_invalid_overlap_and_whitespace(self):
        with self.assertRaises(ValueError):
            list(ingest.chunk_text('text', 100, 100))
        self.assertEqual(list(ingest.chunk_text(' \n\n ')), [])

    def test_pdf_pages_keep_original_numbers(self):
        pages = [SimpleNamespace(extract_text=lambda: ''),
                 SimpleNamespace(extract_text=lambda: 'Readable second page.')]
        with patch.object(ingest, 'PdfReader', return_value=SimpleNamespace(is_encrypted=False, pages=pages)):
            rows = ingest.prepare_rows(Path('guide.pdf'))
        self.assertEqual(rows[0]['metadata']['page'], 2)
        self.assertEqual(rows[0]['metadata']['chunk_index'], 0)

    def test_real_empty_pdf_and_corrupt_file_do_not_delete(self):
        db = FakeDatabase()
        db.rows = [{'metadata': {'source': 'empty.pdf'}}]
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / 'empty.pdf'
            writer = PdfWriter()
            writer.add_blank_page(width=72, height=72)
            with pdf.open('wb') as stream:
                writer.write(stream)
            self.assertEqual(ingest.ingest_file(pdf, db, Models()), 0)
            pdf.write_bytes(b'not a PDF')
            with self.assertRaises(ingest.IngestFailure):
                ingest.ingest_file(pdf, db, Models())
        self.assertEqual(len(db.rows), 1)

    def test_bad_embedding_preserves_previous_rows(self):
        db = FakeDatabase()
        db.rows = [{'metadata': {'source': 'guide.txt'}}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'guide.txt'
            path.write_text('Document information.', encoding='utf-8')
            broken = SimpleNamespace(embed=lambda **kwargs: SimpleNamespace(embeddings=[[float('nan')] * 768]))
            with self.assertRaises(ingest.IngestFailure):
                ingest.ingest_file(path, db, broken)
        self.assertEqual(len(db.rows), 1)

    def test_reingestion_replaces_file_only_and_batches_50(self):
        db = FakeDatabase()
        db.rows = [{'metadata': {'source': 'other.txt'}}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'guide.txt'
            path.write_text('x' * 68000, encoding='utf-8')
            first = ingest.ingest_file(path, db, Models())
            self.assertGreater(first, 50)
            self.assertEqual(ingest.ingest_file(path, db, Models()), first)
        self.assertEqual(len(db.rows), first + 1)
        self.assertTrue(all(size <= 50 for size in db.batches))
        self.assertEqual(db.rows[0]['metadata']['source'], 'other.txt')


if __name__ == '__main__':
    unittest.main()
