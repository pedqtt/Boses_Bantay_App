# Filename and page citations

The current scope uses uploaded filenames and original PDF page numbers. TXT
files have no page number. No title, issuing office, verification date, or source
type form is required. Existing uploaded files remain compatible.

## Behavior

- Search keyword/fuzzy candidates first; use the existing multilingual embedding
  lookup when there is no sufficiently strong keyword match. At most five
  passages are passed to the model by default.
- `metadata.active=false` retires a chunk. Legacy chunks without `active` remain
  active; new ingestion writes `active=true`. Both retrieval paths filter retired
  rows. A missing filename is an index error, not missing content.
- The generation schema returns inline passage markers, stable retrieved row
  `source_ids`, and optional conflict groups. It does not generate source labels.
- Code checks sentence-level marker presence, retrieved-ID membership, exact
  agreement between used markers and declared IDs, and conflict references.
- Code renders the Sources / Pinagmulan block from the retrieved filename/page.
  The UI also offers expandable original excerpts. CLI uses the same block.
- Optional follow-up suggestions without markers are omitted; they never cause
  an otherwise supported answer to be lost. Invalid markers still trigger repair.
- Invalid citations and invalid guide order share one regeneration budget.
  Fabricated markers/IDs are removed from repair feedback. A second citation
  failure discards the answer and shows a localized verification failure. A
  second order-only failure can still show a cited guide with its caution.
- Empty retrieval returns a localized missing-information message, directs the
  resident to the Barangay Hall, and shows categories with matching navigation
  state. Technical failures remain separate. Menus need no citations.
- The prompt requires actual retrieved law text for legal claims and both sides
  of conflicting sources. Reported conflicts retain both citations and receive
  a code-rendered confirmation note. Dates are not inferred from filenames.

## Optional zero-generation answers

`ingest_file(path, database, models, answers=[...])` accepts curated records:

```python
{
    'questions': ['What is the fictional clearance fee?'],
    'language': 'english',
    'answer': 'A fictional clearance costs PHP 35 and takes two working days.'
}
```

The answer must be an exact excerpt in a chunk. It is used only for one retrieved
passage, an exact normalized question match, a matching language, and a non-guide
request. All other questions use grounded generation. The upload UI does not
require or collect curated answers.

## Optional database optimization

`keyword_index.sql` adds a trigram GIN index and filters inactive vector rows
before limiting results. It is **not automatically applied**. Keyword lookup
works against the existing schema, but without this index large datasets can
require scans. The current bounded candidate query examines at most 100 rows;
large-corpus ranking should eventually move into a ranked database RPC.

## Validation and limits

Run `python -m unittest discover -p 'test_*.py' -q` from this folder.
`verify_citations_live.py` is an optional read-only check using existing local
credentials and fictional indexed fixtures; it prints no keys.

Live checks on the fictional corpus returned correct citations in English,
Tagalog, and Taglish with one generation each. The Taglish hall-deposit answer
cited `synthetic_facility_guide.pdf`, page 1. This is a small smoke test, not a
general accuracy benchmark.

Citation checks establish provenance and structural coverage, not semantic
proof that a cited passage entails a claim. Conflict detection and recognition
of actual law text still depend on the model. File-only citations cannot certify
authority, freshness, or policy validity, so no stale-date warning is fabricated.
For PDF scans, OCR remains necessary. No new database or hosted service is added.
