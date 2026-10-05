"""
adapter.py
----------
Bridges Person A's detector output (plain dicts) and Person B's rewrite
engine (FlaggedPhrase dataclass). This is the ONLY place the two shapes meet.

Person A:  {"category": "gender_coded.masculine_coded", "span": "aggressive",
            "severity": 1-3, "positions": [...], ...}
Person B:  FlaggedPhrase(text, category, severity 0.0-1.0, explanation)
"""
from bias_taxonomy import FlaggedPhrase


def flag_to_phrase(flag: dict) -> FlaggedPhrase:
    return FlaggedPhrase(
        text=flag["span"],
        category=flag["category"],
        severity=round(flag.get("severity", 1) / 3, 2),  # 1-3 -> 0-1
        explanation=flag.get("explanation", ""),
    )
