"""Token-aware ingestion independent of document topic or file name."""
import hashlib
import re
from pathlib import Path
from config import CHUNKER_VERSION


def source_units(document, source_root=None):
    sections = document.get('sections')
    if isinstance(sections, list) and sections:
        units = [{'section': str(s.get('title') or 'Untitled section'), 'text': str(s.get('content') or ''),
                  'location': {'section_index': i, 'source': 'approved_sections'}}
                 for i, s in enumerate(sections) if isinstance(s, dict)]
        if any(u['text'].strip() for u in units):
            return units
    if not source_root:
        raise ValueError('source_text_unavailable')
    root = Path(source_root).resolve()
    relative = str(document.get('file_path') or '').replace('\\', '/').lstrip('/')
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 40_000_000:
        raise ValueError('source_file_unavailable')
    suffix = path.suffix.lower()
    if suffix == '.pdf':
        from pypdf import PdfReader
        return [{'section': f'Page {i+1}', 'text': p.extract_text() or '',
                 'location': {'page': i+1, 'source': 'pdf'}} for i,p in enumerate(PdfReader(path).pages)]
    if suffix == '.docx':
        from docx import Document
        doc = Document(path)
        # Preserve paragraph/table order, including table cells used for fees and schedules.
        from docx.oxml.ns import qn
        def element_text(element):
            return ''.join(node.text or '' for node in element.iter(qn('w:t')))
        texts=[]
        for child in doc.element.body:
            if child.tag == qn('w:p'):
                texts.append(element_text(child))
            elif child.tag == qn('w:tbl'):
                for row in child.findall(qn('w:tr')):
                    texts.append(' | '.join(element_text(cell) for cell in row.findall(qn('w:tc'))))
        return [{'section': document.get('title') or path.name, 'text': '\n\n'.join(texts), 'location': {'source': 'docx'}}]
    if suffix in {'.txt','.md'}:
        return [{'section': document.get('title') or path.name, 'text': path.read_text(encoding='utf-8-sig'),
                 'location': {'source': 'text'}}]
    raise ValueError('unsupported_source_format')


def chunk_document(document, tokenizer, source_root=None, target=384, overlap=48):
    if not 0 <= overlap < target <= 448:
        raise ValueError('invalid_chunk_budget')
    chunks=[]
    seen=set()
    for unit in source_units(document, source_root):
        # Offset mappings preserve exact text, rather than decoding subword fragments.
        text=unit['text'].replace('\r\n','\n').replace('\r','\n').replace('\x00','')
        if not text.strip():
            continue
        encoded=tokenizer(text, add_special_tokens=False, return_offsets_mapping=True)
        offsets=encoded['offset_mapping']
        start=0
        while start<len(offsets):
            end=min(start+target,len(offsets))
            if end<len(offsets):
                # Prefer a paragraph or sentence boundary in the final quarter of this window.
                low=offsets[start+max(1,target*3//4)][0]
                high=offsets[end-1][1]
                boundaries=list(re.finditer(r'\n\s*\n|(?<=[.!?])\s+',text[low:high]))
                if boundaries:
                    boundary=low+boundaries[-1].end()
                    end=next((i for i in range(end-1,start,-1) if offsets[i][0]<boundary),end-1)+1
            a,b=offsets[start][0],offsets[end-1][1]
            content=text[a:b].strip()
            # Header is capped by tokens; content is never silently truncated by the embedder.
            title=str(document.get('title') or 'Untitled document')
            section=unit['section']
            header=tokenizer.decode(tokenizer(f'{title}\n{section}',add_special_tokens=False)['input_ids'][:80])
            embedding_text=f'{header}\n{content}'
            count=len(tokenizer(embedding_text,add_special_tokens=True)['input_ids'])
            if count>512:
                raise ValueError('chunk_token_budget_exceeded')
            digest=hashlib.sha256(content.encode()).hexdigest()
            if content and (section,digest) not in seen:
                seen.add((section,digest))
                chunks.append({'chunk_index':len(chunks),'section_title':section,'content':content,
                    'content_hash':digest,'token_count':count,'chunker_version':CHUNKER_VERSION,
                    'provenance':{**unit['location'],'char_start':a,'char_end':b},'embedding_text':embedding_text})
            if end==len(offsets):
                break
            start=max(start+1,end-overlap)
    if not chunks:
        raise ValueError('no_extractable_text')
    return chunks
