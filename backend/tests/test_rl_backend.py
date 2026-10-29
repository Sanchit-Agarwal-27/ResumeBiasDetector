"""
test_rl_backend.py
Comprehensive test suite for the Python FastAPI Reinforcement Learning (LinUCB Contextual Bandit) microservice.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.rl_bandit_engine import (
    LinUCBBanditEngine,
    encode_state_vector,
    invert_matrix,
    create_identity_matrix,
    is_action_evidence_supported,
    RL_ACTION_IDS,
)

client = TestClient(app)


def test_matrix_inversion_identity():
    id_mat = create_identity_matrix(4)
    inv = invert_matrix(id_mat)
    for i in range(4):
        for j in range(4):
            expected = 1.0 if i == j else 0.0
            assert abs(inv[i][j] - expected) < 1e-9


def test_state_encoder_dimension_and_intercept():
    state = encode_state_vector(
        category="gender_coded",
        severity="high",
        confidence=0.95,
        context_type="leadership",
        sentence="Aggressive leader spearheading mission-critical systems.",
        section="summary",
    )
    assert len(state) == 8
    assert state[7] == 1.0  # Constant bias intercept
    assert state[0] == 0.2  # gender_coded encoding
    assert state[1] == 1.0  # high severity


def test_bandit_cold_start_selection():
    engine = LinUCBBanditEngine()
    state = encode_state_vector("gender_coded", "high", 0.95, "leadership")
    result = engine.select_action(state, RL_ACTION_IDS)

    assert result["selected_action"] in RL_ACTION_IDS
    assert result["ucb"] > 0.0
    assert result["expected_reward"] != 0.0
    assert result["exploration_bonus"] > 0.0


def test_bandit_online_learning_positive_feedback():
    engine = LinUCBBanditEngine()
    state = encode_state_vector("gap_framing", "medium", 0.88, "gap")
    action = "contextual_framing"

    updated = engine.update_arm(action, state, reward=1.0)
    assert updated is True

    eval_after = engine.evaluate_arm(action, state)
    assert eval_after["expected_reward"] > 0
    assert engine.arms[action].pull_count >= 1


def test_bandit_online_learning_negative_feedback():
    engine = LinUCBBanditEngine()
    state = encode_state_vector("personality_behavioral", "low", 0.75, "general")
    action = "human_review_flag"

    eval_before = engine.evaluate_arm(action, state)
    engine.update_arm(action, state, reward=-1.0)
    eval_after = engine.evaluate_arm(action, state)

    # Negative feedback should decrease expected reward
    assert eval_after["expected_reward"] < eval_before["expected_reward"]



def test_evidence_support_guardrails():
    # Redact personal info should be supported for graduation year, but NOT for active leadership verb
    assert is_action_evidence_supported(
        action_id="redact_personal_info",
        category="age_indicative",
        subcategory="graduation_year",
        matched_text="1998",
    ) is True

    assert is_action_evidence_supported(
        action_id="redact_personal_info",
        category="gender_coded",
        subcategory="agentic",
        matched_text="aggressive",
    ) is False

    # Contextual framing supported for gap
    assert is_action_evidence_supported(
        action_id="contextual_framing",
        category="gap_framing",
        subcategory="employment_gap",
        matched_text="career gap",
    ) is True

    # Competency substitution supported for tech jargon
    assert is_action_evidence_supported(
        action_id="competency_substitution",
        category="personality_behavioral",
        subcategory="culture_fit",
        matched_text="rockstar engineer",
    ) is True


def test_api_health_includes_rl_feature():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "reinforcement_learning_bandit" in data["features_active"]


def test_api_rl_recommend_endpoint():
    payload = {
        "span_id": "test-span-001",
        "category": "gender_coded",
        "subcategory": "leadership_style",
        "matched_text": "aggressive",
        "confidence": 0.94,
        "severity": "high",
        "context_type": "leadership",
        "sentence": "Aggressive driver of quarterly sales revenue.",
        "section": "experience",
    }
    response = client.post("/api/rl/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["span_id"] == "test-span-001"
    assert data["decision_source"] == "rl_fastapi_policy"
    assert data["selected_action"] == "neutral_rephrase"
    assert len(data["all_options"]) == 5
    assert data["linucb_score"] > 0
    assert len(data["state_features"]) == 8


def test_api_rl_feedback_endpoint():
    state = encode_state_vector("gender_coded", "high", 0.94, "leadership")
    payload = {
        "span_id": "test-span-001",
        "action_id": "neutral_rephrase",
        "rating": "helpful",
        "suggested_text": "collaborative and outcome-driven",
        "state_features": state,
    }
    response = client.post("/api/rl/feedback", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["numeric_reward"] == 1.0
    assert data["updated_pull_count"] >= 1


def test_api_rl_policy_state_and_reset():
    state_res = client.get("/api/rl/policy-state")
    assert state_res.status_code == 200
    state_data = state_res.json()
    assert state_data["dimension"] == 8
    assert "neutral_rephrase" in state_data["arms"]

    reset_res = client.post("/api/rl/reset")
    assert reset_res.status_code == 200
    assert "reset" in reset_res.json()["message"]



def test_sequential_env_step_and_rewards():
    from app.services.rl_environment import ResumeOptimizationEnv
    env = ResumeOptimizationEnv(max_steps=5)
    s0 = env.reset(40.0, 50.0, 5)
    assert 0 <= s0 < 27

    s1, r, term, info = env.step(0)  # Action 0: Mitigate gender bias
    assert info["delta_neutrality"] > 0
    assert r != 0.0
    assert term is False


def test_sequential_q_agent_trajectory():
    from app.services.q_learning_agent import QLearningAgent
    agent = QLearningAgent()
    result = agent.run_optimization_trajectory(initial_neutrality=44.0, initial_ats=62.0, initial_flags=6, max_steps=8)
    assert result["total_steps"] >= 1
    assert result["final_neutrality"] >= result["initial_neutrality"]
    assert "trajectory" in result
    assert len(result["trajectory"]) > 0


def test_api_sequential_optimize_endpoint():
    payload = {
        "initial_neutrality": 44.0,
        "initial_ats": 62.0,
        "initial_flags": 6,
        "max_steps": 6,
    }
    response = client.post("/api/rl/sequential-optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "trajectory" in data
    assert data["final_neutrality"] >= 44.0


def test_api_training_curves_endpoint():
    response = client.get("/api/rl/training-curves")
    assert response.status_code == 200
    data = response.json()
    assert "benchmark_comparison" in data
    assert "q_learning_policy" in data["benchmark_comparison"]
