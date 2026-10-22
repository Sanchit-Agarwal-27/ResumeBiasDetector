from __future__ import annotations
import re
from typing import Dict, List, Optional, Tuple

from ..schemas import BiasCategory, RewriteSuggestion
from .taxonomy import BIAS_TAXONOMY_RULES

XYZ_ACTION_PATTERNS = [
    (r"\b(?:aggressive(?:ly)?|competitive(?:ly)?)\s+(?:lead|managed|architected|drove)\b", "Spearheaded and scaled"),
    (r"\b(?:rockstar|ninja|guru)\s+(?:developer|engineer|coder)\b", "Senior Software Engineer"),
    (r"\b(?:helped\s+with|assisted\s+with|worked\s+on)\b", "Engineered and optimized"),
    (r"\b(?:responsible\s+for\s+managing|responsible\s+for)\b", "Directed and executed"),
    (r"\b(?:young\s+and\s+energetic|recent\s+college\s+grad)\b", "Driven technical professional"),
]


def generate_sentence_rewrite(
    span_id: str,
    original_sentence: str,
    matched_text: str,
    category: BiasCategory,
) -> RewriteSuggestion:
    """
    Produces both a localized inline replacement and a Google XYZ Formula
    full-sentence rewrite ("Accomplished [X] as measured by [Y], by doing [Z]").
    Preserves all technical numbers, metrics, and tools while stripping biased proxies.
    """
    matched_lower = matched_text.lower().strip()
    matching_rule = next(
        (r for r in BIAS_TAXONOMY_RULES if r["term"].lower() in matched_lower or matched_lower in r["term"].lower()),
        None,
    )

    if matching_rule:
        inline_replacement = matching_rule["replacement"]
        rationale = matching_rule["rationale"]
    else:
        # Sensible category fallbacks
        if category == BiasCategory.GENDER_CODED:
            inline_replacement = "collaborative leadership"
            rationale = "Replaces masculine/agentic-coded descriptor with inclusive competency framing (Gaucher et al., 2011)."
        elif category == BiasCategory.AGE_INDICATIVE:
            inline_replacement = "extensive experience"
            rationale = "Removes overt graduation/tenure time boundaries to mitigate ageist algorithmic filtering (EEOC ADEA)."
        elif category == BiasCategory.PRESTIGE_PROXY:
            inline_replacement = "accredited computer science program"
            rationale = "Neutralizes pedigree proxy to focus recruiter evaluation on verifiable technical competencies (Rivera, 2012)."
        elif category == BiasCategory.GAP_FRAMING:
            inline_replacement = "professional sabbatical for skill development"
            rationale = "Recontextualizes career pause around deliberate capability development and domain focus."
        elif category == BiasCategory.DISABILITY_CODED:
            inline_replacement = "meticulous attention to system requirements"
            rationale = "Removes neurodiverse or health-coded idioms to comply with ADA Title I guidelines."
        else:
            inline_replacement = "demonstrated technical proficiency"
            rationale = "Substitutes subjective personality characterizations with concrete behavioral outcomes."

    # Build full-sentence rewrite
    full_sentence = original_sentence
    # 1. Replace the matched text cleanly (case-insensitive where possible)
    if matched_text and matched_text in full_sentence:
        full_sentence = full_sentence.replace(matched_text, inline_replacement)
    else:
        pattern = re.compile(re.escape(matched_text), re.IGNORECASE)
        full_sentence = pattern.sub(inline_replacement, full_sentence)

    # 2. Check for passive or weak verb constructs in the same sentence and elevate
    for pat, rep in XYZ_ACTION_PATTERNS:
        full_sentence = re.sub(pat, rep, full_sentence, flags=re.IGNORECASE)

    # 3. Clean up double spaces or awkward punctuation
    full_sentence = re.sub(r"\s{2,}", " ", full_sentence).strip()

    # Formulate Google XYZ impact formula note
    impact_formula = "Accomplished [Objective Outcome] through [Neutral Competency] as measured by [Metrics/SLA]"

    return RewriteSuggestion(
        span_id=span_id,
        original_text=matched_text,
        suggested_text=inline_replacement,
        rationale=rationale,
        full_sentence_rewrite=full_sentence,
        impact_formula_applied=impact_formula,
    )
