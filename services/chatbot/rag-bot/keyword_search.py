"""Bounded keyword/fuzzy candidates before multilingual embedding fallback.

The optional keyword_index.sql trigram index accelerates the ILIKE candidate
query. Without that migration the query works, but may scan a large table.
"""
import re
from difflib import SequenceMatcher

STOP = set('a an the is are what how much do does of for to in on and or please po ang ng mga sa ano magkano paano ba yung i need want'.split())


def words(text):
    return [w for w in re.findall(r'[^\W_]+', text.casefold()) if len(w) >= 3 and w not in STOP][:20]


def keyword_rows(question, database, table, top_k=5):
    tokens = list(dict.fromkeys(words(question)))
    if not tokens:
        return []
    # Only alphanumeric tokens enter PostgREST syntax. Prefix candidates allow
    # small spelling errors, while coverage below prevents broad keyword hits.
    patterns = list(dict.fromkeys(t[:4] if len(t) > 5 else t for t in tokens))
    query = ','.join('content.ilike.*' + t + '*' for t in patterns)
    rows = database.table(table).select('id,content,metadata').or_(query).or_(
        'metadata->>active.is.null,metadata->>active.eq.true').order('id').limit(100).execute().data
    if not isinstance(rows, list):
        raise ValueError('invalid_keyword_records')
    ranked = []
    for row in rows:
        metadata = row.get('metadata') or {}
        if metadata.get('active', True) is not True:
            continue
        vocabulary = set(words(row['content']))
        # Full chunk vocabulary, not the bounded question-token list.
        vocabulary.update(w for w in re.findall(r'[^\W_]+', row['content'].casefold()) if len(w) >= 3)
        matches = [max((1.0 if t == w else SequenceMatcher(None, t, w).ratio()
                        for w in vocabulary), default=0) for t in tokens]
        coverage = sum(s >= .86 for s in matches) / len(tokens)
        if coverage >= .8:
            ranked.append({**row, 'similarity': sum(matches) / len(matches)})
    return sorted(ranked, key=lambda r: (-r['similarity'], r['id']))[:top_k]
