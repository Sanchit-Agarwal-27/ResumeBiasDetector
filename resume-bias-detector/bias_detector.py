"""
bias_detector.py
=================
Person A's deliverable (Phases 1-2): Data & Detection Core (NLP Engine)

Public contract (this is what Person B and Person C will import and call):

    from bias_detector import analyze_resume
    report = analyze_resume(resume_text)

`report` is a JSON-serializable dict:
{
    "text_length": int,
    "flags": [
        {
            "category": "gender_coded.masculine_coded" | "age_coded" | ... ,
            "span": "aggressive",
            "start": 42,          # position of the FIRST occurrence
            "end": 52,
            "severity": 1-3,
            "source": "lexicon" | "contextual" | "ner",
            "explanation": str,
            "occurrences": 2,     # how many times this exact (category, span) was found
            "positions": [{"start": 42, "end": 52}, {"start": 310, "end": 320}]
        },
        ...
    ],
    "entities": {
        "names": [...],
        "orgs": [...],       # universities/companies picked up by NER
        "dates": [...],      # graduation years etc.
        "education_years": [...],  # years found near an education keyword
    }
}

NOTE: flags are deduplicated by (category, span text, case-insensitive) — if
the same word/phrase is flagged more than once in a resume, it's collapsed
into a single flag entry with occurrences/positions rather than repeated
entries. If Person C wants to highlight every occurrence in the UI, loop
over `positions`, not just `start`/`end`.
}

This shape is the interface contract with Person B (consumes `flags` to
generate rewrite suggestions + fairness stats) and Person C (renders
`flags` as highlighted spans in the UI). Don't change key names without
telling them.
"""

import json
import re
from pathlib import Path

LEXICON_PATH = Path(__file__).parent / "lexicon.json"


def load_lexicon(path: Path = LEXICON_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _iter_lexicon_terms(lexicon: dict):
    """Flatten the nested lexicon into (category_path, severity, word) tuples."""
    for top_key, top_val in lexicon.items():
        if "words" in top_val:
            # flat category e.g. age_coded, ability_coded, prestige_bias
            for w in top_val["words"]:
                yield top_key, top_val.get("severity", 2), w
        else:
            # nested category e.g. gender_coded.masculine_coded
            for sub_key, sub_val in top_val.items():
                if isinstance(sub_val, dict) and "words" in sub_val:
                    for w in sub_val["words"]:
                        yield f"{top_key}.{sub_key}", sub_val.get("severity", 2), w


def lexicon_scan(text: str, lexicon: dict) -> list:
    """
    Pass 1: keyword/phrase matching against the bias taxonomy.
    Case-insensitive, word-boundary aware so 'ability' doesn't match inside
    'accountability', etc.
    """
    flags = []
    lower_text = text.lower()
    for category, severity, term in _iter_lexicon_terms(lexicon):
        term_lower = term.lower()
        # multi-word phrases: plain substring is fine; single words: word boundary
        if " " in term_lower:
            pattern = re.escape(term_lower)
        else:
            pattern = r"\b" + re.escape(term_lower) + r"\b"

        for m in re.finditer(pattern, lower_text):
            flags.append({
                "category": category,
                "span": text[m.start():m.end()],
                "start": m.start(),
                "end": m.end(),
                "severity": severity,
                "source": "lexicon",
                "explanation": f"'{text[m.start():m.end()]}' matches the {category} "
                                f"lexicon and may signal biased phrasing."
            })
    return flags


EDUCATION_KEYWORDS = [
    "graduated", "graduate", "graduation", "b.s.", "b.a.", "bachelor",
    "bachelors", "m.s.", "m.a.", "master", "masters", "ph.d.", "phd",
    "doctorate", "degree", "university", "college", "diploma", "gpa",
]


def _find_education_years(text: str) -> list:
    """
    Find 4-digit years that appear in the SAME SENTENCE as an education
    keyword. Deliberately sentence-scoped rather than a raw character
    window — a raw window bleeds across sentence boundaries and still
    catches work-history ranges like "2001-2004" whenever the next
    sentence happens to mention "graduated". This avoids that: only years
    genuinely tied to schooling context count.
    """
    hits = []
    for sent_match in re.finditer(r"[^.!?]*[.!?]|[^.!?]+$", text):
        sent = sent_match.group()
        sent_start = sent_match.start()
        sent_lower = sent.lower()
        if not any(kw in sent_lower for kw in EDUCATION_KEYWORDS):
            continue
        for m in re.finditer(r"\b(19[5-9]\d|20[0-4]\d)\b", sent):
            hits.append({
                "year": m.group(),
                "start": sent_start + m.start(),
                "end": sent_start + m.end(),
            })
    return hits


def ner_scan(text: str) -> dict:
    """
    Pass 2: proxy-variable extraction (names, universities, graduation years).
    Uses spaCy if available. Falls back to a regex-only pass for dates so the
    pipeline still runs on a machine without the model downloaded yet.

    Install: pip install spacy && python -m spacy download en_core_web_sm
    """
    entities = {"names": [], "orgs": [], "dates": []}

    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")

        # Resume PDFs often extract to text with irregular runs of whitespace
        # (table/column artifacts) that confuse the NER model into treating
        # label fragments as entities. Collapsing whitespace before tagging
        # noticeably improves precision — this is a display-only cleanup for
        # entity extraction, it does not affect lexicon_scan's character
        # positions since those run on the original `text`.
        cleaned = re.sub(r"\s{2,}", " ", text)
        doc = nlp(cleaned)
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                entities["names"].append(ent.text)
            elif ent.label_ == "ORG":
                entities["orgs"].append(ent.text)
            elif ent.label_ == "DATE":
                entities["dates"].append(ent.text)
    except OSError:
        # model not downloaded yet
        entities["_warning"] = (
            "spaCy model 'en_core_web_sm' not found. Run: "
            "python -m spacy download en_core_web_sm"
        )
    except ImportError:
        entities["_warning"] = "spaCy not installed. Run: pip install spacy"

    # NOTE: we deliberately do NOT dump every 4-digit number found in the
    # text into entities["dates"] here anymore — resumes are full of work-
    # history date ranges (e.g. "2001-2004") that aren't graduation years.
    # See _find_education_years() for the proximity-filtered version used
    # by analyze_resume() to flag actual age-proxy graduation years.

    # dedupe while preserving order
    for k in ("names", "orgs", "dates"):
        seen = set()
        deduped = []
        for v in entities[k]:
            if v not in seen:
                seen.add(v)
                deduped.append(v)
        entities[k] = deduped

    return entities


CONTEXTUAL_LABELS = [
    "gender-biased language",
    "age-biased language",
    "ability-biased language",
    "neutral professional language",
]


_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*"
_DATE_TOKEN = rf"(?:{_MONTH})?(?:\d{{1,2}}/)?\b(?:19|20)\d{{2}}\b"
_JOB_HEADER_PATTERN = re.compile(
    rf"{_DATE_TOKEN}\s*(?:to|-|–|—)\s*(?:{_MONTH})?(?:{_DATE_TOKEN}|current|present)",
    re.IGNORECASE,
)


def _is_low_content_fragment(segment: str, min_words: int = 3) -> bool:
    """
    True if a segment is a bare acronym/keyword list rather than real prose
    — e.g. 'FMLA/ADA/EEO/WC' or a slash/comma-separated skills dump. These
    were getting fed to the zero-shot classifier, which has nothing
    substantive to work with on a short acronym string and ends up
    assigning weak, spread-out confidence across multiple unrelated
    categories (we saw a single acronym fragment flagged as ability, age,
    AND gender bias simultaneously — classic noise, not signal). Mentioning
    a compliance acronym like ADA (Americans with Disabilities Act) is
    normal HR domain knowledge, not evidence of ability bias.

    Heuristic: requires at least `min_words` whitespace-separated tokens.
    A fragment like 'FMLA/ADA/EEO/WC' is one token (no internal spaces) and
    gets filtered; real sentences like 'Negotiate budget revisions to
    include HR initiatives.' have plenty of tokens and pass through.
    """
    return len(segment.split()) < min_words


def _is_job_header_line(segment: str) -> bool:
    """
    True if a segment is a structural résumé header — job title + date
    range + company/location — rather than descriptive prose. These lines
    (e.g. "Jun 2004 to Jul 2007 Company Name") were getting misclassified
    by the zero-shot contextual model as "age-biased language" purely
    because they contain years, which is a false-positive pattern: a date
    range is not biased phrasing, it's just when someone worked somewhere.
    Graduation-year age signals are already handled separately and more
    reliably by _find_education_years(), so filtering these out of the
    contextual pass loses no real detection, only false positives.
    """
    return bool(_JOB_HEADER_PATTERN.search(segment))


def _segment_resume_text(text: str, min_len: int = 15, max_len: int = 300) -> list:
    """
    Split resume text into classifiable chunks for the contextual pass.
    Resumes are bullet/newline-structured, not prose — a plain sentence
    splitter (only breaking on '.', '!', '?') fails badly here and produces
    giant multi-paragraph "sentences". This splits on newlines FIRST (the
    real structural boundary in resume text), then further splits any long
    line by sentence punctuation, and finally falls back to splitting on
    runs of 2+ spaces (common in this dataset's extracted text, used as a
    field separator in place of punctuation) if a line is still too long.

    Segments that are purely structural job-header lines (date range +
    company name, no real descriptive content) are dropped — see
    _is_job_header_line(). This cuts wasted model calls and the false
    positives they were producing.

    Returns a list of (segment_text, start_offset, end_offset) tuples with
    accurate positions into the original `text`.
    """
    segments = []
    search_from = 0

    for line in text.split("\n"):
        line_stripped = line.strip()
        if not line_stripped:
            continue

        if len(line_stripped) > max_len:
            parts = re.split(r"(?<=[.!?])\s+", line_stripped)
            # if sentence punctuation didn't actually break it up (common —
            # resume lines often have no periods at all), fall back to
            # splitting on runs of 2+ spaces, which this dataset uses as a
            # de facto field separator between job title / dates / company
            parts = [
                p for part in parts
                for p in (re.split(r"\s{2,}", part) if len(part) > max_len else [part])
            ]
        else:
            parts = [line_stripped]

        for part in parts:
            part = part.strip()
            if len(part) < min_len:
                continue  # skip fragments/headers too short to classify meaningfully
            if _is_job_header_line(part):
                continue  # skip structural date-range headers (see docstring)
            if _is_low_content_fragment(part):
                continue  # skip bare acronym/keyword fragments (see docstring)
            start = text.find(part, search_from)
            if start == -1:
                continue
            end = start + len(part)
            search_from = end
            segments.append((part, start, end))

    return segments


def contextual_scan(text: str, threshold: float = 0.55) -> list:
    """
    Pass 3: catches bias the lexicon misses (tone, implied assumptions,
    coded phrasing) using zero-shot classification, run on resume-aware
    text segments (see _segment_resume_text).

    Uses HuggingFace zero-shot-classification (facebook/bart-large-mnli).
    Install: pip install transformers torch

    NOTE for today's deadline: this pass is the most expensive (model
    download + inference). If you're short on time, ship with lexicon_scan +
    ner_scan working end-to-end first, wire this in last, and cap it to only
    scan segments the lexicon pass didn't already flag (avoids double work
    and keeps demo latency reasonable).
    """
    flags = []
    try:
        from transformers import pipeline
    except ImportError:
        return [{
            "category": "contextual",
            "span": None,
            "start": None,
            "end": None,
            "severity": 0,
            "source": "contextual",
            "explanation": "transformers not installed — pip install transformers torch"
        }]

    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

    for segment, start, end in _segment_resume_text(text):
        result = classifier(segment, CONTEXTUAL_LABELS, multi_label=True)
        for label, score in zip(result["labels"], result["scores"]):
            if label != "neutral professional language" and score >= threshold:
                flags.append({
                    "category": f"contextual.{label.split('-')[0]}",
                    "span": segment,
                    "start": start,
                    "end": end,
                    "severity": 2,
                    "source": "contextual",
                    "explanation": f"Segment classified as '{label}' "
                                    f"(confidence {score:.2f}) by contextual model."
                })
    return flags


def _dedupe_flags(flags: list) -> list:
    """
    Collapse identical (category, span) flags into a single entry with an
    'occurrences' count and a 'positions' list of every (start, end) it was
    found at. Two flags count as identical if they share the same category
    and the same span text (case-insensitive) — e.g. 'driven' at position 12
    and 'Driven' at position 340 collapse into one entry with occurrences=2.
    """
    grouped = {}
    order = []  # preserve first-seen order for stable output

    for f in flags:
        key = (f["category"], (f["span"] or "").lower())
        if key not in grouped:
            grouped[key] = {**f, "occurrences": 1, "positions": [
                {"start": f["start"], "end": f["end"]}
            ]}
            order.append(key)
        else:
            grouped[key]["occurrences"] += 1
            grouped[key]["positions"].append({"start": f["start"], "end": f["end"]})

    return [grouped[k] for k in order]


def analyze_resume(text: str, lexicon: dict = None, run_contextual: bool = True) -> dict:
    """
    Main entry point — this is the function Person B and Person C call.
    """
    if lexicon is None:
        lexicon = load_lexicon()

    flags = []
    flags.extend(lexicon_scan(text, lexicon))
    if run_contextual:
        flags.extend(contextual_scan(text))

    entities = ner_scan(text)

    # Only flag years that sit near an actual education keyword — this is
    # the fix for the false-positive spam where every work-history date
    # range (e.g. "2001-2004") was getting flagged as a graduation year.
    edu_years = _find_education_years(text)
    entities["education_years"] = [h["year"] for h in edu_years]

    for hit in edu_years:
        y = hit["year"]
        if int(y) < 2005:
            flags.append({
                "category": "age_coded.graduation_year",
                "span": y,
                "start": hit["start"],
                "end": hit["end"],
                "severity": 3,
                "source": "ner",
                "explanation": f"Graduation year {y} (near an education keyword) "
                                f"is a common proxy variable for candidate age."
            })

    return {
        "text_length": len(text),
        "flags": _dedupe_flags(flags),
        "entities": entities,
    }


if __name__ == "__main__":
    # Quick smoke test — run: python bias_detector.py
    sample = (
        "John Smith graduated from Ivy University in 1998. "
        "He is an aggressive, competitive leader who dominates every project. "
        "Member of Sigma Chi Fraternity. Must be able to stand for long periods."
    )
    report = analyze_resume(sample, run_contextual=False)  # skip heavy model for smoke test
    print(json.dumps(report, indent=2))
