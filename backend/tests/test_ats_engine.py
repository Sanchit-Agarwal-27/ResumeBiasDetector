import pytest
from app.services.ats_engine import (
    calculate_ats_match,
    evaluate_ats_section_hygiene,
    compute_semantic_cosine_similarity,
)


def test_section_hygiene_complete():
    sample_resume = """
    Alex Vance
    alex@example.com | (555) 123-4567 | github.com/alex
    
    WORK EXPERIENCE
    Senior Software Engineer (2020-Present)
    • Built distributed services using Go and Kubernetes.
    
    EDUCATION
    Bachelor of Science in Computer Science, University of California
    
    TECHNICAL SKILLS
    Python, Go, Docker, AWS, PostgreSQL
    """
    coverage = evaluate_ats_section_hygiene(sample_resume)
    assert coverage.contact_info is True
    assert coverage.work_experience is True
    assert coverage.education is True
    assert coverage.skills_section is True
    assert coverage.overall_structure_score == 100


def test_semantic_cosine_similarity():
    text_a = "Senior backend engineer with deep experience in Python, FastAPI, and PostgreSQL cloud databases."
    text_b = "Looking for a backend developer skilled in Python, PostgreSQL, and cloud APIs."
    similarity = compute_semantic_cosine_similarity(text_a, text_b)
    assert similarity >= 50


def test_calculate_ats_match_comprehensive():
    resume_text = """
    Jane Doe | jane@example.com | github.com/janedoe
    EXPERIENCE
    Senior Backend Engineer
    • Architected microservices with Python, FastAPI, Docker, and PostgreSQL.
    • Directed cross-functional collaboration and mentored junior engineers.
    
    EDUCATION
    B.S. in Computer Science
    
    SKILLS
    Python, Docker, Kubernetes, AWS, PostgreSQL, Redis, Git
    """
    
    job_desc = """
    We are seeking a Senior Backend Engineer to join our platform team.
    Requirements:
    - 5+ years of experience with Python, Docker, and PostgreSQL.
    - Experience designing microservices and deploying on AWS or Kubernetes.
    - Strong cross-functional collaboration and leadership skills.
    - Preferred: Redis, CI/CD, and Terraform.
    """
    
    result = calculate_ats_match(
        resume_text=resume_text,
        job_description=job_desc,
        target_title="Senior Backend Engineer",
    )
    
    assert result.overall_match_score >= 60
    assert result.hard_skills_score >= 60
    assert result.section_coverage.overall_structure_score == 100
    assert any(k.keyword == "python" and k.foundInResume for k in result.matched_keywords)
    assert any(k.keyword == "docker" and k.foundInResume for k in result.matched_keywords)
    assert result.counterfactual_simulation.baseline_ats_score == result.overall_match_score
    assert result.counterfactual_simulation.debiased_ats_score >= result.counterfactual_simulation.baseline_ats_score
    assert len(result.counterfactual_simulation.recommendations) > 0
