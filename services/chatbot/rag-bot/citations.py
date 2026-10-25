"""Code-only citation checks. Filenames/pages always come from retrieved rows.

These checks establish citation integrity, not semantic entailment of every claim.
"""
import re

MARKER = re.compile(r'\[(\d+)\]')


def source_id(passage):
    return passage.source_id or str(passage.number)


def citation_errors(response, passages):
    allowed = {p.number: p for p in passages}
    allowed_ids = {source_id(p) for p in passages}
    errors = []
    texts = [response.overview, response.answer, *[s.action for s in response.steps], *response.related_topics]
    used = set()
    for text in filter(str.strip, texts):
        if re.search(r'(?im)^\s*(?:sources|pinagmulan|mga sanggunian)\s*:|https?://', text):
            errors.append('Do not generate a Sources block or links; code supplies filenames and pages.')
        # Accept markers immediately before OR after sentence-ending punctuation.
        sentences = re.split(r'(?<=[.!?])\s+(?!\[\d+\])', text.strip())
        if response.kind == 'answer' and text == response.answer and len(sentences) > 4:
            errors.append('Keep the direct answer to 1-4 short sentences without omitting conditions or conflicts.')
        for sentence in sentences:
            numbers = {int(n) for n in MARKER.findall(sentence)}
            if not numbers:
                errors.append('Missing inline citation for: ' + sentence[:120])
            invalid = numbers - allowed.keys()
            if invalid:
                errors.append('Unretrieved citation markers: ' + ', '.join(map(str, sorted(invalid))))
            used.update(numbers & allowed.keys())
    expected_ids = {source_id(allowed[n]) for n in used}
    declared = set(response.source_ids)
    if declared - allowed_ids:
        errors.append('source_ids includes an ID that was not retrieved.')
    if declared != expected_ids:
        errors.append('source_ids must exactly match the source IDs used by inline markers: ' + ', '.join(sorted(expected_ids)))
    for group in response.conflicts:
        if len(set(group)) < 2 or not set(group).issubset(expected_ids):
            errors.append('Each conflict must reference at least two different retrieved and cited source_ids.')
    return list(dict.fromkeys(errors))


def safe_label(text):
    # Render stored filenames literally, not as injected Markdown links/markup.
    return re.sub(r'([\\`*_{}\[\]<>#|])', r'\\\1', str(text).replace('\n', ' ').replace('\r', ' '))


def sources_block(passages, language='english'):
    if not passages:
        return ''
    heading = 'Pinagmulan' if language == 'tagalog' else 'Sources'
    page_label = 'pahina' if language == 'tagalog' else 'page'
    lines = []
    for p in passages:
        location = f', {page_label} {p.page}' if p.page is not None else ''
        lines.append(f'[{p.number}] {safe_label(p.source)}{location}')
    return heading + ':\n\n' + '\n\n'.join(lines)


UNVERIFIED = {
    'english': "Sorry, I couldn't verify the answer's citations. Please retry or confirm with the Barangay Hall.",
    'tagalog': 'Paumanhin po, hindi ko ma-verify ang mga pinagmulan ng sagot. Pakisubukan muli o kumpirmahin sa Barangay Hall.',
    'taglish': 'Sorry po, hindi ko ma-verify ang citations ng answer. Paki-try ulit o i-confirm sa Barangay Hall.',
}
CONFLICT = {
    'english': 'The retrieved files disagree. Please confirm with the Barangay Hall; filenames and pages alone do not establish which version is current.',
    'tagalog': 'Magkaiba ang impormasyon sa mga nakuhang file. Kumpirmahin po sa Barangay Hall; hindi matitiyak sa filename at pahina lamang kung alin ang pinakabago.',
    'taglish': 'Magkaiba ang information sa retrieved files. Paki-confirm sa Barangay Hall; filename at page lang ay hindi sapat para malaman kung alin ang current version.',
}
REFUSAL = {
    'english': 'Sorry, I can only help with barangay-related concerns and services.',
    'tagalog': 'Paumanhin po, mga usapin at serbisyo ng barangay lamang ang maaari kong tulungan.',
    'taglish': 'Sorry po, barangay-related concerns and services lang ang maitutulong ko.',
}
