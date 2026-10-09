"""
bias_taxonomy.py
-----------------
A minimal, standalone bias taxonomy so Person B (fairness audit + rewrite
engine) can build and test independently before Person A's full NLP
detector exists.

Once Person A's real detection engine is ready, its output (a list of
FlaggedPhrase-shaped dicts) should be used INSTEAD of the sample data in
run_demo.py. This file just needs to stay import-compatible with theirs:
category + severity + explanation per flagged span.

Categories are based loosely on established HR-bias research
(e.g. Gaucher, Friesen & Kay 2011 on gendered wording in job ads).
"""

from dataclasses import dataclass
from typing import List


@dataclass
class FlaggedPhrase:
    text: str            # the exact phrase found in the resume
    category: str        # e.g. "gender_coded", "age_coded", "prestige_bias"
    severity: float       # 0.0 (mild) to 1.0 (severe)
    explanation: str      # why this is flagged, in plain language


# Small starter lexicon — enough to demo the pipeline end-to-end.
# Person A's real module will replace/expand this.
MASCULINE_CODED_WORDS = [
    "rockstar", "ninja", "dominant", "aggressive", "competitive",
    "fearless", "superior", "driven to win",
]

FEMININE_CODED_WORDS = [
    "collaborative", "nurturing", "supportive", "empathetic",
    "warm", "dependable team player",
]

AGE_CODED_PHRASES = [
    "digital native", "recent graduate", "young and energetic",
    "fresh perspective", "old-school",
]

PRESTIGE_MARKERS = [
    "Ivy League", "top-tier university", "elite institution",
]


def flag_sample_text(text: str) -> List[FlaggedPhrase]:
    """
    Cheap keyword-based scan, used ONLY to generate sample flagged phrases
    for testing the rewrite engine before Person A's real detector exists.
    Not a substitute for the real detection engine.
    """
    text_lower = text.lower()
    flags: List[FlaggedPhrase] = []

    for word in MASCULINE_CODED_WORDS + FEMININE_CODED_WORDS:
        if word.lower() in text_lower:
            flags.append(FlaggedPhrase(
                text=word,
                category="gender_coded",
                severity=0.5,
                explanation=f"'{word}' is a gender-coded term that can "
                            f"discourage applicants of the opposite "
                            f"gender association from applying.",
            ))

    for phrase in AGE_CODED_PHRASES:
        if phrase.lower() in text_lower:
            flags.append(FlaggedPhrase(
                text=phrase,
                category="age_coded",
                severity=0.6,
                explanation=f"'{phrase}' implies an age preference and "
                            f"may be read as age discrimination.",
            ))

    for marker in PRESTIGE_MARKERS:
        if marker.lower() in text_lower:
            flags.append(FlaggedPhrase(
                text=marker,
                category="prestige_bias",
                severity=0.4,
                explanation=f"'{marker}' signals institutional prestige "
                            f"bias, disadvantaging equally qualified "
                            f"candidates from other schools.",
            ))

    return flags
