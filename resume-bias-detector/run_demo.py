"""
run_demo.py — integrated demo: Person A's detector -> Person B's rewrite
engine + fairness audit.   python run_demo.py
"""
from pipeline import run_full_pipeline
from counterfactual_generator import generate_pairs, scale_pairs
from mock_scorer import score as neutral_score
from mock_scorer_biased import score as biased_score
from fairness_audit import run_audit, print_report

SAMPLE_RESUME_TEXT = """
James is a rockstar engineer and a digital native who is fearless in
the face of tough deadlines. Recent graduate of an Ivy League school,
looking to bring a fresh perspective and competitive drive to the team.
Graduated 2019, summa cum laude. Aggressive problem solver.
"""


def demo_pipeline():
    print("=== DETECT + REWRITE (Person A -> Person B) ===\n")
    out = run_full_pipeline(SAMPLE_RESUME_TEXT, run_contextual=False)
    for f in out["flags"]:
        print(f'"{f["span"]}"  [{f["category"]}, sev {f["severity"]}, x{f["occurrences"]}]'
              f'  ->  {f["suggested_rewrite"]}')
    print("\n--- Rewritten text ---")
    print(out["rewritten_text"])


def demo_fairness_audit():
    pairs = scale_pairs(generate_pairs(), n=20)
    print("\n--- Audit 1: neutral scorer ---")
    print_report(run_audit(pairs, scorer=neutral_score))
    print("--- Audit 2: intentionally biased scorer ---")
    print_report(run_audit(pairs, scorer=biased_score, threshold=90.0))


if __name__ == "__main__":
    demo_pipeline()
    demo_fairness_audit()
