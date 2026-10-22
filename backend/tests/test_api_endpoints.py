from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "BiasLens" in data["model_version"]
    assert "features_active" in data
    assert "resume_error_quality_detection" in data["features_active"]
    assert "ats_job_matching_simulation" in data["features_active"]


def test_analyze_endpoint_neutral_achievement():
    payload = {
        "raw_text": "She aggressively optimized the machine learning pipeline, reducing processing time by 40%.",
        "file_name": "sample_resume.txt",
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["neutrality_score"] == 100
    assert len(data["spans"]) == 0
    assert data["context_summary"]["fine_sentences"] >= 1
    assert "error_flags" in data
    assert "quality_metrics" in data
    assert data["quality_metrics"]["action_verb_score"] >= 0


def test_analyze_endpoint_flagged_bias():
    payload = {
        "raw_text": "The company prefers young and energetic candidates for this entry-level role.",
        "file_name": "biased_posting.txt",
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["spans"]) >= 1
    assert data["neutrality_score"] < 100
    assert data["spans"][0]["category"] == "age_indicative"


def test_analyze_endpoint_with_job_description():
    payload = {
        "raw_text": """
        Alex Vance | alex@example.com
        EXPERIENCE:
        Senior Software Engineer
        • Engineered Python microservices using FastAPI and Docker.
        SKILLS:
        Python, FastAPI, Docker, PostgreSQL
        """,
        "job_description": "We are seeking a Python developer with FastAPI and Docker experience.",
        "target_title": "Python Developer",
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ats_match"] is not None
    assert data["ats_match"]["overall_match_score"] >= 50
    assert len(data["ats_match"]["matched_keywords"]) >= 2


def test_rewrite_endpoint_dynamic_xyz():
    payload = {
        "span_id": "span-001",
        "sentence": "The candidate has an aggressive leadership style.",
        "matched_text": "aggressive",
        "category": "gender_coded",
    }
    response = client.post("/api/rewrite", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["span_id"] == "span-001"
    assert "full_sentence_rewrite" in data
    assert data["full_sentence_rewrite"] is not None
    assert "impact_formula_applied" in data


def test_job_match_standalone_endpoint():
    payload = {
        "resume_text": "Experienced Python and React developer building cloud apps on AWS.",
        "job_description": "Hiring Full Stack Engineer skilled in React, Python, and AWS.",
        "target_title": "Full Stack Engineer",
    }
    response = client.post("/api/job-match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_match_score"] >= 40
    assert data["counterfactual_simulation"]["ats_verdict"] is not None


def test_benchmarks_endpoint():
    response = client.get("/api/benchmarks")
    assert response.status_code == 200
    data = response.json()
    assert data["accuracy"] == 100.0
    assert data["total_samples"] == 30
