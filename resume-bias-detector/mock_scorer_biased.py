"""
mock_scorer_biased.py
----------------------
A SECOND mock scorer, with bias intentionally built in on purpose.

Why this file exists: fairness_audit.py is only convincing if you can
show it correctly catches bias when bias is actually present, not just
that it reports "all clear" on a neutral scorer. Run the audit against
THIS scorer and it should flag every variable — that's your proof the
statistics pipeline actually works, for your demo/viva.

The bias rules below are deliberately crude and obvious (penalize
non-Anglo-coded names, less-known universities, and employment gaps) —
this mirrors real documented failure modes in early ATS systems, not
anything you'd ever want to ship.
"""

from mock_scorer import score as neutral_score

# Deliberately biased adjustments, keyed on tokens that will appear in
# counterfactual_generator.py's variable pools.
PENALTY_TOKENS = {
    "lakisha": -15,
    "jessica": -8,
    "state college of technology": -12,
    "career break": -20,
}

BONUS_TOKENS = {
    "mit": +10,
}


def score(resume_text: str) -> float:
    base = neutral_score(resume_text)
    text_lower = resume_text.lower()

    for token, penalty in PENALTY_TOKENS.items():
        if token in text_lower:
            base += penalty
    for token, bonus in BONUS_TOKENS.items():
        if token in text_lower:
            base += bonus

    return round(max(0.0, min(100.0, base)), 2)
