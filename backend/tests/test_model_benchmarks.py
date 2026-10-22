import json
import os
import pytest
from app.services.context_detector import classify_sentence
from app.services.fairness_auditor import run_counterfactual_audit


@pytest.fixture
def evaluation_samples():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "evaluation_samples.json")
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def counterfactual_pairs():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "counterfactual_pairs.json")
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_30_sample_benchmark_accuracy(evaluation_samples):
    """Verifies that the Context-Aware model classifies all 30 benchmark sentences correctly."""
    assert len(evaluation_samples) == 30
    
    tp, fp, tn, fn = 0, 0, 0, 0
    for sample in evaluation_samples:
        result = classify_sentence(sample["sentence"])
        expected = sample["expectedClassification"]
        got = result.classification
        
        assert got == expected, f"Failed on sample {sample['id']}: expected {expected}, got {got}"
        
        if expected == "Flagged":
            if got == "Flagged":
                tp += 1
            else:
                fn += 1
        else:
            if got == "Flagged":
                fp += 1
            else:
                tn += 1

    precision = tp / (tp + fp)
    recall = tp / (tp + fn)
    accuracy = (tp + tn) / len(evaluation_samples)
    
    assert accuracy == 1.0, f"Expected 100% accuracy, got {accuracy * 100}%"
    assert precision == 1.0, f"Expected 100% precision, got {precision * 100}%"
    assert recall == 1.0, f"Expected 100% recall, got {recall * 100}%"


def test_10_counterfactual_pairs_fairness(counterfactual_pairs):
    """Verifies that demographic swaps maintain fairness parity."""
    assert len(counterfactual_pairs) == 10
    
    for pair in counterfactual_pairs:
        res_a = classify_sentence(pair["sentenceA"]["text"])
        res_b = classify_sentence(pair["sentenceB"]["text"])
        
        assert res_a.classification == pair["sentenceA"]["expected"], f"Failed on pair {pair['id']} Sentence A"
        assert res_b.classification == pair["sentenceB"]["expected"], f"Failed on pair {pair['id']} Sentence B"


def test_eeoc_disparate_impact_compliance():
    """Verifies EEOC 80% rule on neutral technical achievements."""
    audit = run_counterfactual_audit("She aggressively optimized the machine learning pipeline by 40%.", total_flags=0)
    assert audit.disparate_impact_ratio.passes_rule is True
    assert audit.disparate_impact_ratio.value >= 0.80
