"""
counterfactual_generator.py
----------------------------
Builds counterfactual resume PAIRS: two resumes that are IDENTICAL except
for one demographic-proxy variable (name, university, employment-gap
framing). This isolates whether that single variable alone shifts a
score — the core method behind the fairness audit.

Methodology reference: this mirrors the classic audit-study design used
in bias research (e.g. Bertrand & Mullainathan 2004, "Are Emily and
Greg More Employable Than Lakisha and Jamal?"), adapted here for an
automated scoring pipeline instead of human recruiters.
"""

from dataclasses import dataclass, field
from typing import List, Dict
import itertools

# --- Variable pools -------------------------------------------------
# NOTE: name lists are for BIAS-TESTING purposes only (proxies commonly
# used in audit-study literature), never used to label real people.

NAME_PAIRS = {
    "gender": [("James Miller", "Jessica Miller")],
    "ethnicity_proxy": [("Emily Walsh", "Lakisha Washington")],
}

UNIVERSITY_PAIRS = {
    "prestige": [("MIT", "State College of Technology")],
}

GAP_YEAR_PAIRS = {
    "employment_gap": [
        ("2019 – 2023: Software Engineer, TechCorp",
         "2019 – 2021: Software Engineer, TechCorp\n"
         "2021 – 2023: Career break (caregiving)\n"
         "2023 – Present: Software Engineer, TechCorp"),
    ],
}

BASE_RESUME_TEMPLATE = """\
{name}
{university}, B.S. Computer Science

Experience:
{experience}

Skills: Python, SQL, distributed systems, REST APIs
"""


@dataclass
class ResumePair:
    variable_tested: str      # e.g. "gender", "ethnicity_proxy", "prestige"
    variant_a_label: str      # e.g. "James Miller"
    variant_b_label: str      # e.g. "Jessica Miller"
    resume_a: str
    resume_b: str


def generate_pairs() -> List[ResumePair]:
    """Produce one counterfactual pair per variable, all else held constant."""
    pairs: List[ResumePair] = []

    default_name = "Alex Morgan"
    default_university = "State University"
    default_experience = "2019 – 2023: Software Engineer, TechCorp"

    # Name-based variables (gender, ethnicity proxy)
    for variable, name_list in NAME_PAIRS.items():
        for name_a, name_b in name_list:
            pairs.append(ResumePair(
                variable_tested=variable,
                variant_a_label=name_a,
                variant_b_label=name_b,
                resume_a=BASE_RESUME_TEMPLATE.format(
                    name=name_a, university=default_university,
                    experience=default_experience),
                resume_b=BASE_RESUME_TEMPLATE.format(
                    name=name_b, university=default_university,
                    experience=default_experience),
            ))

    # University prestige
    for variable, uni_list in UNIVERSITY_PAIRS.items():
        for uni_a, uni_b in uni_list:
            pairs.append(ResumePair(
                variable_tested=variable,
                variant_a_label=uni_a,
                variant_b_label=uni_b,
                resume_a=BASE_RESUME_TEMPLATE.format(
                    name=default_name, university=uni_a,
                    experience=default_experience),
                resume_b=BASE_RESUME_TEMPLATE.format(
                    name=default_name, university=uni_b,
                    experience=default_experience),
            ))

    # Employment gap framing
    for variable, gap_list in GAP_YEAR_PAIRS.items():
        for exp_a, exp_b in gap_list:
            pairs.append(ResumePair(
                variable_tested=variable,
                variant_a_label="continuous employment",
                variant_b_label="employment gap",
                resume_a=BASE_RESUME_TEMPLATE.format(
                    name=default_name, university=default_university,
                    experience=exp_a),
                resume_b=BASE_RESUME_TEMPLATE.format(
                    name=default_name, university=default_university,
                    experience=exp_b),
            ))

    return pairs


def scale_pairs(pairs: List[ResumePair], n: int) -> List[ResumePair]:
    """
    Cheap way to get a larger sample size for statistical testing without
    hand-writing dozens of resumes: cycle through the base pairs. Replace
    with real varied resume bodies as the project matures — a bigger,
    more varied pool makes your stats more convincing.
    """
    cycle = itertools.cycle(pairs)
    return [next(cycle) for _ in range(n)]
