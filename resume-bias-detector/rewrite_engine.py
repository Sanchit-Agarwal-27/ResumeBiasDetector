"""
rewrite_engine.py
------------------
Turns a flagged bias phrase (from bias_taxonomy.py, or eventually Person
A's real detector) into a neutral rewrite suggestion.

Two modes:
1. LLM mode — calls the Anthropic API for context-aware rewrites.
   Requires `pip install anthropic` and an ANTHROPIC_API_KEY environment
   variable. Best quality, handles phrasing the fallback dict can't.
2. Fallback mode — a small hand-written dictionary of common flagged
   phrases -> neutral replacements. Works offline, no API key, good
   enough to demo the pipeline before you've wired up the API key.

The module auto-detects which mode is available so the rest of the
pipeline doesn't need to care.
"""

import os
from typing import Optional

from bias_taxonomy import FlaggedPhrase

# --- Fallback dictionary (offline mode) ------------------------------
FALLBACK_REWRITES = {
    "rockstar": "high-performing",
    "ninja": "skilled",
    "dominant": "results-oriented",
    "aggressive": "proactive",
    "competitive": "goal-oriented",
    "fearless": "confident",
    "superior": "highly capable",
    "driven to win": "results-driven",
    "collaborative": "collaborative",  # already neutral, kept for completeness
    "nurturing": "supportive",
    "digital native": "proficient with modern technology",
    "recent graduate": "early-career professional",
    "young and energetic": "motivated and enthusiastic",
    "fresh perspective": "innovative thinker",
    "old-school": "experienced",
    "ivy league": "highly-regarded",
    "top-tier university": "accredited university",
    "elite institution": "accredited institution",
    # --- added to cover Person A's lexicon.json ---
    "headstrong": "determined", "battle-tested": "experienced",
    "boast": "highlight", "greedy": "motivated", "hierarchical": "structured",
    "outperform": "exceed targets", "reckless": "bold", "stubborn": "persistent",
    "unreasonable": "exacting",
    "ambitious": "motivated", "assertive": "clear communicator",
    "decisive": "decision-making", "independent": "self-directed",
    "self-reliant": "self-directed", "confident": "capable", "driven": "motivated",
    "individualistic": "self-directed", "analytical": "data-driven",
    "athletic": "active", "challenging": "demanding", "objective": "impartial",
    "persist": "follow through", "principle": "standard",
    "flatterable": "open-minded", "sympathetic": "attentive",
    "yield": "adapt", "emotional": "engaged",
    "communal": "team-oriented", "compassionate": "attentive",
    "considerate": "attentive", "cooperative": "team-oriented",
    "dependable": "reliable", "empathetic": "attentive", "gentle": "measured",
    "honest": "transparent", "interpersonal": "communication", "kind": "respectful",
    "loyal": "committed", "pleasant": "professional", "polite": "professional",
    "responsive": "prompt", "sensitive": "attentive", "tactful": "diplomatic",
    "together": "organized", "trustworthy": "reliable", "understanding": "attentive",
    "warm": "approachable", "rockstar": "high-performing",
    "summa cum laude": "graduated with distinction",
}


def _fallback_rewrite(phrase: FlaggedPhrase) -> str:
    key = phrase.text.lower()
    return FALLBACK_REWRITES.get(
        key,
        f"[no fallback available for '{phrase.text}' — consider rephrasing "
        f"to remove the {phrase.category.replace('_', ' ')} connotation]",
    )


def _llm_available() -> bool:
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _llm_rewrite(phrase: FlaggedPhrase) -> str:
    import anthropic

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    prompt = (
        f"You are helping neutralize biased language in a resume or job "
        f"description. The phrase \"{phrase.text}\" was flagged as "
        f"{phrase.category} bias. Reason: {phrase.explanation}\n\n"
        f"Give ONLY a short, neutral replacement phrase (a few words), "
        f"with no explanation, no quotes, no punctuation around it."
    )
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=30,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def suggest_rewrite(phrase: FlaggedPhrase, prefer_llm: bool = True) -> str:
    """
    Returns a neutral rewrite suggestion for a flagged phrase.
    Tries the LLM if available and prefer_llm=True; otherwise falls back
    to the offline dictionary.
    """
    if prefer_llm and _llm_available():
        try:
            return _llm_rewrite(phrase)
        except Exception as e:  # network/auth errors etc. — don't crash the demo
            return f"[LLM call failed ({e}); fallback: {_fallback_rewrite(phrase)}]"
    return _fallback_rewrite(phrase)
