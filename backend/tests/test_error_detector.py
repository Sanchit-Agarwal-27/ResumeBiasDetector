import pytest
from app.services.error_detector import detect_resume_errors
from app.schemas import ResumeErrorType, SeverityLevel


def test_passive_voice_detection():
    sample_text = "Was responsible for managing a team of 5 engineers."
    errors, metrics = detect_resume_errors(sample_text)
    
    passive_errors = [e for e in errors if e.error_type == ResumeErrorType.PASSIVE_VOICE]
    assert len(passive_errors) >= 1
    assert "was responsible for" in passive_errors[0].matched_text.lower()
    assert "Spearheaded" in passive_errors[0].suggestion
    assert metrics.passive_voice_count >= 1


def test_weak_verb_detection():
    sample_text = "Helped with the migration of database systems."
    errors, metrics = detect_resume_errors(sample_text)
    
    weak_verb_errors = [e for e in errors if e.error_type == ResumeErrorType.WEAK_VERB]
    assert len(weak_verb_errors) >= 1
    assert "helped with" in weak_verb_errors[0].matched_text.lower()
    assert metrics.weak_verb_count >= 1


def test_unquantified_impact_detection():
    sample_text = "• Significantly improved database query response times."
    errors, metrics = detect_resume_errors(sample_text)
    
    unquantified = [e for e in errors if e.error_type == ResumeErrorType.UNQUANTIFIED_IMPACT]
    assert len(unquantified) >= 1
    assert "significantly" in unquantified[0].matched_text.lower()


def test_buzzword_cliche_detection():
    sample_text = "Results-driven hard-working team player with a go-getter attitude."
    errors, metrics = detect_resume_errors(sample_text)
    
    buzzwords = [e for e in errors if e.error_type == ResumeErrorType.BUZZWORD_CLICHE]
    assert len(buzzwords) >= 1


def test_strong_bullet_quality_scoring():
    sample_text = """
    • Engineered automated Kubernetes container deployments, reducing MTTR by 45%.
    • Spearheaded migration from legacy monoliths to event-driven Kafka pipelines with 99.99% SLA.
    • Directed 24 distributed platform engineers handling 120M daily transactions.
    """
    errors, metrics = detect_resume_errors(sample_text)
    
    # Should have high action verb and quantification scores
    assert metrics.action_verb_score >= 80
    assert metrics.quantification_score >= 80
    assert metrics.ats_readability_score >= 85
    assert metrics.passive_voice_count == 0
    assert metrics.weak_verb_count == 0


def test_profanity_detection():
    sample_text = "Built a badass microservice to replace that shitty legacy backend."
    errors, metrics = detect_resume_errors(sample_text)
    
    profanities = [e for e in errors if e.error_type == ResumeErrorType.PROFANITY]
    assert len(profanities) >= 2
    matched_words = [p.matched_text.lower() for p in profanities]
    assert any("badass" in w for w in matched_words)
    assert any("shitty" in w for w in matched_words)
    assert metrics.profanity_count >= 2
    # ATS readability should drop heavily
    assert metrics.ats_readability_score < 70


def test_slang_detection():
    sample_text = "I was gonna build lots of cool stuff for the team, lol."
    errors, metrics = detect_resume_errors(sample_text)
    
    slang = [e for e in errors if e.error_type == ResumeErrorType.SLANG]
    assert len(slang) >= 2
    matched = [s.matched_text.lower() for s in slang]
    assert any("gonna" in m for m in matched)


def test_first_person_pronoun_detection():
    sample_text = "I built the cloud infrastructure and led my team to victory."
    errors, metrics = detect_resume_errors(sample_text)
    
    first_person = [e for e in errors if e.error_type == ResumeErrorType.FIRST_PERSON]
    assert len(first_person) >= 1
    assert any("I built" in f.matched_text or "I" == f.matched_text for f in first_person)
    assert metrics.first_person_count >= 1


def test_common_typos_detection():
    sample_text = "Engineering Manger with 8 years of experiance in scalable systems."
    errors, metrics = detect_resume_errors(sample_text)
    
    typos = [e for e in errors if e.error_type == ResumeErrorType.SPELLING]
    assert len(typos) >= 2
    typo_words = [t.matched_text.lower() for t in typos]
    assert "manger" in typo_words
    assert "experiance" in typo_words
    assert metrics.spelling_error_count >= 2


def test_personal_info_and_cliche_detection():
    sample_text = """
    Marital Status: Single | Date of Birth: 05/12/1990
    References available upon request.
    """
    errors, metrics = detect_resume_errors(sample_text)
    
    personal_info = [e for e in errors if e.error_type == ResumeErrorType.PERSONAL_INFO]
    cliches = [e for e in errors if e.error_type == ResumeErrorType.CLICHE]
    
    assert len(personal_info) >= 2
    assert len(cliches) >= 1
    assert "remove" in cliches[0].suggestion.lower()
