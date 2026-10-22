import json
import os
from typing import List, Dict, Any
from ..schemas import BiasCategory, SeverityLevel

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "expanded_taxonomy.json")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    EXPANDED_TAXONOMY: List[Dict[str, Any]] = json.load(f)

CATEGORY_MAP = {
    "age_related": BiasCategory.AGE_INDICATIVE,
    "age_indicative": BiasCategory.AGE_INDICATIVE,
    "gender_related": BiasCategory.GENDER_CODED,
    "gender_coded": BiasCategory.GENDER_CODED,
    "prestige_proxy": BiasCategory.PRESTIGE_PROXY,
    "career_gap": BiasCategory.GAP_FRAMING,
    "gap_framing": BiasCategory.GAP_FRAMING,
    "disability_health": BiasCategory.DISABILITY_CODED,
    "disability_coded": BiasCategory.DISABILITY_CODED,
    "personality_behavioral": BiasCategory.PERSONALITY_BEHAVIORAL,
}

SEVERITY_MAP = {
    "low": SeverityLevel.LOW,
    "medium": SeverityLevel.MEDIUM,
    "high": SeverityLevel.HIGH,
}

# Compile flat list of rules for fast lookup
BIAS_TAXONOMY_RULES: List[Dict[str, Any]] = []

for entry in EXPANDED_TAXONOMY:
    cat = CATEGORY_MAP.get(entry["category"], BiasCategory.PERSONALITY_BEHAVIORAL)
    sev = SEVERITY_MAP.get(entry.get("defaultSeverity", "medium"), SeverityLevel.MEDIUM)
    
    # Add canonical rule
    BIAS_TAXONOMY_RULES.append({
        "id": entry["id"],
        "term": entry["canonical"],
        "category": cat,
        "subcategory": entry.get("subcategory"),
        "severity": sev,
        "confidence": entry.get("confidence", 0.90),
        "replacement": entry.get("replacement", "objective phrasing"),
        "explanation": entry.get("explanation", ""),
        "rationale": entry.get("rationale", entry.get("explanation", "")),
        "research_citation": entry.get("researchCitation"),
    })
    
    # Add variant rules
    for var in entry.get("variants", []):
        form = var["form"]
        if form.lower() != entry["canonical"].lower():
            BIAS_TAXONOMY_RULES.append({
                "id": f"{entry['id']}_{var.get('type', 'var')}",
                "term": form,
                "category": cat,
                "subcategory": entry.get("subcategory"),
                "severity": sev,
                "confidence": entry.get("confidence", 0.88),
                "replacement": entry.get("replacement", "objective phrasing"),
                "explanation": entry.get("explanation", ""),
                "rationale": entry.get("rationale", entry.get("explanation", "")),
                "research_citation": entry.get("researchCitation"),
            })
