"""
mock_scorer.py
--------------
A stand-in "ATS" scoring model. This is NOT a real trained model — it's
scaffolding so the fairness-audit pipeline (fairness_audit.py) has
something to run counterfactual pairs through, without waiting for the
team to source or train a real scoring model.

IMPORTANT: this mock scorer is intentionally written WITHOUT explicit
bias rules — it scores on keyword overlap with a "job description," the
same way many simple ATS keyword-matchers actually work. If it still
produces a score gap between counterfactual pairs, that's worth noting:
it means bias can creep in through indirect correlations (e.g. certain
name/university tokens interacting with matching logic) even when no
one intentionally coded it in — which is itself a real finding worth
including in your write-up.

Swap this file out for a real model's API call later; keep the same
`score(resume_text: str) -> float` interface so nothing else has to change.
"""

import re

JOB_DESCRIPTION_KEYWORDS = [
    "python", "sql", "distributed systems", "rest apis",
    "software engineer", "computer science",
]


def score(resume_text: str) -> float:
    """
    Returns a score 0-100 based on keyword overlap with a fixed job
    description. Deliberately simple and deterministic so any score
    difference between counterfactual pairs is easy to trace.
    """
    text_lower = resume_text.lower()
    matches = sum(1 for kw in JOB_DESCRIPTION_KEYWORDS if kw in text_lower)
    base_score = (matches / len(JOB_DESCRIPTION_KEYWORDS)) * 100

    # Small deterministic "noise" derived from text length, so scores
    # aren't perfectly identical for near-identical resumes (mimics how
    # real scoring models are sensitive to superficial text differences).
    length_adjustment = (len(re.findall(r"\w+", resume_text)) % 5) * 0.5

    return round(min(100.0, base_score + length_adjustment), 2)
