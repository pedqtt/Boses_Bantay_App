"""Language-aware ranking and verbatim excerpts; no generated policy claims."""
import difflib
import re
import unicodedata

# Retrieval vocabulary, not answers: the source documents remain authoritative.
ALIASES = {
    "pets": "pet pets dog dogs cat cats animal animals aso pusa hayop alaga alagang ownership",
    "league": "league tournament basketball paliga liga laro game games sports koponan manlalaro sumali pagsali makasali kasali play playing",
    "registration": "registration register registering registered rehistro pagpaparehistro magparehistro pagrehistro parehistro",
    "requirements": "requirements requirement required documents papers paperwork needed kailangan kailangang requisitos waiver consent parental",
    "cost": "cost costs fee fees price prices pay payment bayad magkano halaga libre free gastos gagastos gastusin gastusing",
    "penalties": "penalty penalties fine fines offense offences multa parusa paglabag lalabag paglabag pinabayaan violation violations",
    "vaccination": "vaccine vaccines vaccination vaccinated vaccinate rabies bakuna pagpapabakuna magpabakuna bakunahan shot shots",
    "bite": "bite bites bitten biting kagat nakagat nakakagat makakagat pagkagat pinsala nakapanakit",
    "leash": "leash tali",
    "walking": "walk walking maglalakad paglalakad",
    "length": "mahaba haba kahaba length metro",
    "stray": "stray roam roaming strays gala pagala pagpapagala pagpapagala-gala impound impounding pakawalan pagpapakawala",
    "age": "age ages old year years edad taon taong gulang kwalipikasyon eligibility eligible qualification",
    "team": "team teams player players members member koponan manlalaro bilang",
    "schedule": "schedule schedules time when date dates kailan oras iskedyul gaganapin ginaganap tuwing",
    "venue": "venue location where saan lokasyon lugar",
    "deadline": "deadline deadlines huli huling last cutoff",
    "kickoff": "start starts begin begins opening kickoff magsisimula simula pagbubukas",
    "prizes": "prize prizes reward rewards champion champions winner winners premyo kampeon mananalo medalya tropeo mvp",
    "first": "first una unang 1st",
    "second": "second ikalawa ikalawang pangalawa pangalawang 2nd",
    "third": "third ikatlo ikatlong pangatlo pangatlong 3rd",
}
ALIASES = {key: set(value.split()) for key, value in ALIASES.items()}
VOCABULARY = sorted(set().union(*ALIASES.values()))
TOPICS = {"pets", "league"}
ORDINALS = {"first", "second", "third"}
STOP = set("a an the what which how is are do does can could would should i my me we our your you it its this that there here about of to for on in with and or at by from have has be as much many need tell please po opo naman ba ang ng mga sa ay ano anong paano para kapag kung ko mo ni ito iyong yan iyon yung rin din pa na lang pwede puwede pede gusto malaman tungkol nito may sinong sino buong within ka nung then yung paki anti get want know now must without pag ilang ilan talaga naman ba registrationfee gaano barangay ordinance ordinansa document documents dokumento policy serbisyo service rules patakaran".split())


def normalize(text):
    return " ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()))


def features(text, correct_typos=False):
    words = set(normalize(text).split()) - STOP
    if correct_typos:
        for word in tuple(words):
            if len(word) >= 4 and word not in VOCABULARY:
                close = difflib.get_close_matches(word, VOCABULARY, n=1, cutoff=0.82)
                if close:
                    words.discard(word)
                    words.add(close[0])
    concepts = {key for key, aliases in ALIASES.items() if words & aliases}
    if re.search(r"[₱$€]\s*\d|\bPHP\b|\b\d+\.\d{2}\b", text, re.I):
        concepts.add("cost")
    if concepts & {"deadline", "kickoff"} and not words & {"iskedyul", "schedule", "schedules", "gaganapin", "time"}:
        concepts.discard("schedule")
    raw = {word for word in words if not word.isdigit() and len(word) >= 3 and word not in VOCABULARY}
    return concepts, raw


def contextual_query(query, history):
    """Only borrow a topic for short follow-ups; explicit new topics win."""
    concepts, raw = features(query, True)
    if concepts & TOPICS or len(normalize(query).split()) > 10:
        return query
    # New, specific nouns (e.g. clearance, spaghetti) must not inherit a topic.
    if raw - {"offense", "registration", "deadline"}:
        return query
    for turn in reversed(history or []):
        if turn.get("role") != "user":
            continue
        old_concepts, _ = features(turn.get("content", ""), True)
        if not old_concepts & TOPICS:
            if features(turn.get("content", ""), True)[1]:
                return query
            continue
        borrowed = old_concepts & TOPICS
        if concepts <= {"cost", "schedule", "venue", "first", "second", "third"}:
            borrowed |= old_concepts & {"registration", "requirements", "penalties", "vaccination", "prizes", "bite"}
        words = {"pets": "alagang aso pusa", "league": "paliga", "registration": "pagpaparehistro", "requirements": "requirements", "penalties": "multa parusa", "vaccination": "bakuna", "prizes": "premyo", "bite": "pagkagat"}
        return query + " " + " ".join(words[c] for c in sorted(borrowed))
    return query


def expanded_query(query):
    concepts, _ = features(query, True)
    # A few bilingual anchors improve English/Taglish embeddings without
    # replacing the original question or supplying invented facts.
    anchors = {"pets": "aso pusa alagang hayop", "league": "paliga liga",
               "registration": "pagpaparehistro registration", "requirements": "requisitos requirements",
               "cost": "bayad fee", "penalties": "multa parusa", "vaccination": "bakuna rabies",
               "bite": "pagkagat pinsala", "leash": "tali leash", "length": "haba ng tali", "walking": "paglalakad maglalakad", "age": "edad gulang",
               "schedule": "iskedyul oras", "venue": "lokasyon", "deadline": "huling pagpaparehistro",
               "prizes": "premyo", "kickoff": "pagbubukas simula", "second": "ikalawang paglabag", "first": "unang paglabag", "third": "ikatlong paglabag"}
    return query + "\n" + " ".join(anchors[c] for c in sorted(concepts) if c in anchors)


def rank_matches(query, matches):
    if not matches:
        return []
    q_concepts, q_raw = features(query, True)
    q_topics = q_concepts & TOPICS
    facets = q_concepts - TOPICS
    document_topics = {}
    for match in matches:
        concepts, _ = features(match["text"] + " " + match["section"])
        document_topics.setdefault(match.get("documentId", match["documentTitle"]), set()).update(concepts & TOPICS)
    all_raw = set().union(*(features(m["text"] + " " + m["section"])[1] for m in matches))
    # Do not answer an unsupported named subject with a nearby fee/registration
    # passage. A high cosine alone is insufficient for short questions.
    if q_raw - all_raw:
        return []
    if not q_concepts and not q_raw:
        return []
    ranked = []
    for match in matches:
        title_concepts, title_raw = features(match["section"])
        concepts, raw = features(match["text"] + " " + match["section"])
        topic = document_topics[match.get("documentId", match["documentTitle"])]
        if q_topics and not q_topics <= topic:
            continue
        overlap = facets & concepts
        if facets and not overlap:
            continue
        if q_raw and not q_raw & raw:
            continue
        similarity = match.get("similarity", 0)
        coverage = len(overlap) / max(1, len(facets))
        title_coverage = len(facets & title_concepts) / max(1, len(facets))
        raw_coverage = len(q_raw & raw) / max(1, len(q_raw))
        # Hybrid confidence: retain a semantic floor, then require corroborating
        # lexical evidence for candidates below the old 0.73 threshold.
        strong_lexical = bool(q_topics and overlap) or bool(q_raw & raw) or len(overlap) >= 2 or bool(overlap & {"leash", "length", "bite", "vaccination", "penalties", "prizes", "deadline", "kickoff"})
        if similarity < 0.73 and not (similarity >= 0.50 and strong_lexical):
            continue
        score = 0.45 * similarity + 0.35 * coverage + 0.15 * title_coverage + 0.05 * raw_coverage
        ranked.append({**match, "rankScore": score, "concepts": concepts, "titleConcepts": title_concepts})
    ranked.sort(key=lambda match: match["rankScore"], reverse=True)
    if not ranked:
        return []
    selected = [ranked[0]]
    # Answer multi-part questions across sections within the strongest document.
    covered = ranked[0]["concepts"]
    missing = facets - covered
    for match in ranked[1:]:
        if len(selected) >= 3:
            break
        if match.get("documentId", match["documentTitle"]) != selected[0].get("documentId", selected[0]["documentTitle"]):
            continue
        if missing & match["concepts"]:
            selected.append(match)
            missing -= match["concepts"]
    return selected


def focused_excerpt(query, match):
    concepts, raw = features(query, True)
    focus = concepts - TOPICS
    text = match["text"].strip()
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    units = []
    for block in blocks:
        if re.match(r"^(?:\d+\.|[-•])\s", block):
            units.append(block)  # Keep list conditions, exceptions and amounts together.
        else:
            units.extend(re.split(r"(?<!\d)(?<=[.!?])\s+(?=[A-Z])", block))
    if len(units) <= 1:
        return text
    tagged = [(unit, *features(unit)) for unit in units]
    ordinals = focus & ORDINALS
    if ordinals and "prizes" not in focus:
        picked = [i for i, (_, groups, _) in enumerate(tagged) if groups & ordinals]
        if picked:
            return "\n\n".join(units[i] for i in picked)
    # Prefer specific aspects over generic cost/time words where both appear.
    wanted = focus - ORDINALS
    picked = set()
    for facet in wanted:
        candidates = [(i, groups, words) for i, (_, groups, words) in enumerate(tagged) if facet in groups]
        if candidates:
            best = max(candidates, key=lambda item: (len(item[1] & wanted) + 0.5 * len(item[2] & raw), -item[0]))
            picked.add(best[0])
    if not picked:
        return text
    # Broad penalty/prize questions ask for the list, not only its introduction.
    if "penalties" in wanted and not ordinals:
        listed = {i for i, (unit, groups, _) in enumerate(tagged) if groups & ORDINALS and "penalties" in groups}
        if listed:
            picked = listed
    if "prizes" in wanted:
        picked.update(i for i, (_, groups, _) in enumerate(tagged) if "prizes" in groups or groups & ORDINALS)
    return "\n\n".join(units[i] for i in sorted(picked))


def english_query(query):
    return not bool(set(normalize(query).split()) & set("ano anong paano magkano kailan saan ba po ang ng mga sa ko alaga aso pusa paliga liga multa bakuna salamat paglabag parusa pangalawang ikalawang unang ikatlong rehistro".split()))
