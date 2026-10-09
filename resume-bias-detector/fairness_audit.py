"""
fairness_audit.py
------------------
Core fairness-audit statistics. Takes counterfactual resume pairs, runs
them through a scoring function, and reports whether the tested variable
(name, university, employment gap) causes a statistically meaningful
score difference.

Two metrics, both standard in hiring-fairness literature:

1. Mean score gap + paired t-test
   - Is variant B scored differently from variant A, on average, more
     than you'd expect from noise?

2. Disparate impact ratio (the "80% rule")
   - Common legal/HR benchmark: if the selection rate (score >= threshold)
     for one group is less than 80% of the other group's selection rate,
     that's flagged as a potential adverse impact.
"""

from dataclasses import dataclass
from typing import Callable, List, Dict
from collections import defaultdict

from scipy import stats

from counterfactual_generator import ResumePair

SHORTLIST_THRESHOLD = 70.0  # score >= this counts as "shortlisted"


@dataclass
class AuditResult:
    variable_tested: str
    mean_score_a: float
    mean_score_b: float
    mean_gap: float
    p_value: float
    disparate_impact_ratio: float
    n_pairs: int
    flagged: bool
    flag_reason: str


def _selection_rate(scores: List[float], threshold: float) -> float:
    if not scores:
        return 0.0
    return sum(1 for s in scores if s >= threshold) / len(scores)


def run_audit(
    pairs: List[ResumePair],
    scorer: Callable[[str], float],
    threshold: float = SHORTLIST_THRESHOLD,
) -> List[AuditResult]:
    """
    Groups pairs by variable_tested, scores every resume, and computes
    fairness statistics per variable.
    """
    grouped: Dict[str, List[ResumePair]] = defaultdict(list)
    for pair in pairs:
        grouped[pair.variable_tested].append(pair)

    results: List[AuditResult] = []

    for variable, group_pairs in grouped.items():
        scores_a = [scorer(p.resume_a) for p in group_pairs]
        scores_b = [scorer(p.resume_b) for p in group_pairs]

        mean_a = sum(scores_a) / len(scores_a)
        mean_b = sum(scores_b) / len(scores_b)
        gap = mean_a - mean_b

        # Paired t-test needs >1 sample to compute a meaningful p-value.
        if len(scores_a) > 1 and len(set(scores_a) | set(scores_b)) > 1:
            _, p_value = stats.ttest_rel(scores_a, scores_b)
        else:
            p_value = float("nan")

        rate_a = _selection_rate(scores_a, threshold)
        rate_b = _selection_rate(scores_b, threshold)
        # Disparate impact ratio: lower selection rate over higher one.
        if max(rate_a, rate_b) == 0:
            di_ratio = 1.0
        else:
            di_ratio = min(rate_a, rate_b) / max(rate_a, rate_b)

        flagged = di_ratio < 0.8
        reason = (
            f"Disparate impact ratio {di_ratio:.2f} is below the 0.80 "
            f"threshold (the '80% rule')."
            if flagged else
            "No disparate impact detected at the 80% rule threshold."
        )

        results.append(AuditResult(
            variable_tested=variable,
            mean_score_a=round(mean_a, 2),
            mean_score_b=round(mean_b, 2),
            mean_gap=round(gap, 2),
            p_value=round(p_value, 4) if p_value == p_value else float("nan"),
            disparate_impact_ratio=round(di_ratio, 3),
            n_pairs=len(group_pairs),
            flagged=flagged,
            flag_reason=reason,
        ))

    return results


def print_report(results: List[AuditResult]) -> None:
    print("\n=== FAIRNESS AUDIT REPORT ===\n")
    for r in results:
        status = "⚠ FLAGGED" if r.flagged else "OK"
        print(f"[{status}] Variable: {r.variable_tested}  (n={r.n_pairs} pairs)")
        print(f"  Mean score A: {r.mean_score_a}   Mean score B: {r.mean_score_b}")
        print(f"  Mean gap: {r.mean_gap}   p-value: {r.p_value}")
        print(f"  Disparate impact ratio: {r.disparate_impact_ratio}")
        print(f"  {r.flag_reason}\n")
