"""
pipeline.py
-----------
run_full_pipeline(resume_text) -> JSON-friendly dict. Person C's UI should
call this one function.

detect (Person A) -> rewrite (Person B) -> optional fairness audit (Person B)
"""
from bias_detector import analyze_resume, load_lexicon
from adapter import flag_to_phrase
from rewrite_engine import suggest_rewrite

_LEXICON = None


def _apply_rewrites(text: str, edits: list) -> str:
    """edits: list of (start, end, replacement). Applied right-to-left so
    earlier offsets stay valid."""
    for start, end, rep in sorted(edits, key=lambda e: e[0], reverse=True):
        text = text[:start] + rep + text[end:]
    return text


def run_full_pipeline(resume_text: str, run_contextual: bool = False,
                      prefer_llm: bool = True) -> dict:
    global _LEXICON
    if _LEXICON is None:
        _LEXICON = load_lexicon()

    report = analyze_resume(resume_text, _LEXICON, run_contextual=run_contextual)

    edits, suggestions = [], []
    for flag in report["flags"]:
        if flag.get("source") == "ner":
            continue
        rewrite = suggest_rewrite(flag_to_phrase(flag), prefer_llm=prefer_llm)
        suggestions.append({**flag, "suggested_rewrite": rewrite})
        # skip placeholder text like "[no fallback available ...]"
        if not rewrite.startswith("["):
            for pos in flag.get("positions", [{"start": flag["start"], "end": flag["end"]}]):
                edits.append((pos["start"], pos["end"], rewrite))

    return {
        "original_text": resume_text,
        "flags": suggestions,
        "entities": report["entities"],
        "rewritten_text": _apply_rewrites(resume_text, edits),
    }
