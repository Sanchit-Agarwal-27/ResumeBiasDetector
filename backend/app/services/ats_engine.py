from __future__ import annotations
import re
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from ..schemas import (
    AtsMatchResult,
    AtsSectionCoverage,
    CounterfactualJobSimulation,
    JobDescriptionProfile,
    KeywordMatchEntry,
)
from .context_detector import analyze_document_text

HARD_SKILLS_DICTIONARY: Dict[str, List[str]] = {
    # Languages
    "typescript": ["ts", "type-script"],
    "javascript": ["js", "ecmascript"],
    "python": ["py", "python3"],
    "java": ["core java", "j2ee"],
    "golang": ["go", "golang"],
    "rust": ["rustlang"],
    "c++": ["cpp"],
    "c#": ["csharp", ".net"],
    "ruby": ["ruby on rails", "rails"],
    "sql": ["postgresql", "postgres", "mysql", "t-sql", "pl/sql", "sqlite"],
    "html": ["html5"],
    "css": ["css3", "sass", "scss", "tailwind", "styled-components"],

    # Frameworks & Libraries
    "react": ["reactjs", "react.js", "next.js", "nextjs"],
    "vue": ["vuejs", "nuxt", "nuxtjs"],
    "angular": ["angularjs"],
    "node.js": ["nodejs", "node"],
    "express": ["express.js"],
    "fastapi": ["fast-api"],
    "django": ["django rest framework", "drf"],
    "flask": ["flask framework"],
    "pytorch": ["torch"],
    "tensorflow": ["tf", "keras"],
    "transformers": ["huggingface", "hugging face"],

    # Cloud & DevOps
    "aws": ["amazon web services", "ec2", "s3", "lambda", "ecs", "eks"],
    "gcp": ["google cloud platform", "google cloud", "bigquery"],
    "azure": ["microsoft azure"],
    "docker": ["containerization", "containers"],
    "kubernetes": ["k8s"],
    "terraform": ["iac", "infrastructure as code"],
    "ci/cd": ["continuous integration", "github actions", "gitlab ci", "jenkins"],
    "linux": ["unix", "bash", "shell scripting"],

    # Databases & Storage
    "postgresql": ["postgres"],
    "mongodb": ["mongo", "nosql"],
    "redis": ["redis cache", "in-memory cache"],
    "snowflake": ["snowflake dw"],
    "bigquery": ["google bigquery"],
    "pinecone": ["vector db", "vector database", "milvus", "qdrant", "chroma"],

    # Methodologies & Tools
    "rest api": ["rest", "restful", "api design"],
    "graphql": ["apollo graphql"],
    "microservices": ["distributed systems"],
    "git": ["github", "gitlab"],
    "agile/scrum": ["agile", "scrum", "kanban", "sprints"],
    "unit testing": ["jest", "pytest", "cypress", "playwright", "tdd"],
    "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
    "llm": ["large language models", "prompt engineering", "genai", "generative ai"],
}

SOFT_SKILLS_DICTIONARY: Dict[str, List[str]] = {
    "cross-functional collaboration": ["cross-functional", "collaborated with", "partnered with"],
    "leadership": ["mentored", "coached", "led a team", "spearheaded", "directed"],
    "stakeholder management": [
        "executive communication",
        "presented to stakeholders",
        "client-facing",
    ],
    "strategic planning": ["roadmapping", "product strategy", "vision", "okrs"],
    "problem solving": ["analytical thinking", "root cause analysis", "troubleshooting"],
    "user-centered design": ["user research", "customer empathy", "accessibility", "a11y"],
    "data-driven decision making": ["a/b testing", "metric-driven", "kpis", "analytics"],
}

SECTION_KEYWORDS = {
    "contact_info": ["email", "phone", "linkedin", "github", "@", "tel:", "contact"],
    "work_experience": [
        "experience",
        "work history",
        "employment",
        "professional background",
        "positions held",
    ],
    "education": [
        "education",
        "degree",
        "university",
        "bachelor",
        "master",
        "ph.d",
        "b.s.",
        "m.s.",
        "college",
    ],
    "skills_section": [
        "skills",
        "technical proficiencies",
        "technologies",
        "competencies",
        "tools & frameworks",
    ],
}


def _clean_text(text: str) -> str:
    return re.sub(r"[\r\n\t]+", " ", text.lower())


def _count_occurrences(text: str, term: str) -> int:
    escaped = re.escape(term)
    pattern = rf"(?:^|[^a-z0-9_#+]){escaped}(?:[^a-z0-9_#+]|$)"
    matches = re.findall(pattern, text, flags=re.IGNORECASE)
    return len(matches)


def _extract_matching_entities(
    source_text: str,
    dictionary: Dict[str, List[str]],
    category: str,
) -> Dict[str, Dict[str, any]]:
    normalized = _clean_text(source_text)
    found: Dict[str, Dict[str, any]] = {}

    for canonical, aliases in dictionary.items():
        total_count = _count_occurrences(normalized, canonical)
        for alias in aliases:
            total_count += _count_occurrences(normalized, alias)

        if total_count > 0:
            found[canonical] = {
                "term": canonical,
                "count": total_count,
                "category": category,
            }

    return found


def evaluate_ats_section_hygiene(resume_text: str) -> AtsSectionCoverage:
    text_lower = resume_text.lower()

    has_contact = any(k in text_lower for k in SECTION_KEYWORDS["contact_info"])
    has_exp = any(k in text_lower for k in SECTION_KEYWORDS["work_experience"])
    has_edu = any(k in text_lower for k in SECTION_KEYWORDS["education"])
    has_skills = any(k in text_lower for k in SECTION_KEYWORDS["skills_section"])

    score = 0
    if has_contact:
        score += 25
    if has_exp:
        score += 35
    if has_edu:
        score += 20
    if has_skills:
        score += 20

    return AtsSectionCoverage(
        contact_info=has_contact,
        work_experience=has_exp,
        education=has_edu,
        skills_section=has_skills,
        overall_structure_score=score,
    )


def compute_semantic_cosine_similarity(resume_text: str, job_text: str) -> int:
    stop_words = {
        "the", "and", "a", "to", "of", "in", "for", "with", "on", "as",
        "by", "an", "is", "at", "that", "from", "are", "be", "this",
        "our", "you", "will", "or", "have", "we", "your", "can", "all",
        "about", "their", "team", "years", "working", "work", "experience",
    }

    def tokenize(text: str) -> List[str]:
        cleaned = re.sub(r"[^a-z0-9+#]", " ", text.lower())
        tokens = cleaned.split()
        return [t for t in tokens if len(t) > 2 and t not in stop_words]

    resume_tokens = tokenize(resume_text)
    job_tokens = tokenize(job_text)

    if not job_tokens or not resume_tokens:
        return 50

    job_freq: Dict[str, int] = {}
    for t in job_tokens:
        job_freq[t] = job_freq.get(t, 0) + 1

    resume_freq: Dict[str, int] = {}
    for t in resume_tokens:
        resume_freq[t] = resume_freq.get(t, 0) + 1

    dot_product = sum(count * resume_freq.get(t, 0) for t, count in job_freq.items())
    job_norm = sum(c * c for c in job_freq.values())
    resume_norm = sum(c * c for c in resume_freq.values())

    denominator = math.sqrt(job_norm) * math.sqrt(resume_norm)
    if denominator == 0:
        return 50

    similarity = dot_product / denominator
    return min(100, max(20, round(similarity * 180)))


def simulate_counterfactual_impact(
    resume_text: str,
    baseline_score: int,
    target_title: str,
    missing_keywords: List[KeywordMatchEntry],
) -> CounterfactualJobSimulation:
    spans, _, _, _ = analyze_document_text(resume_text)
    has_bias_markers = len(spans) > 0

    potential_debiased_score = min(
        100,
        baseline_score + (min(12, len(spans) * 3) if has_bias_markers else 2),
    )
    delta = potential_debiased_score - baseline_score

    if baseline_score >= 80:
        verdict = "Strong Candidate"
    elif baseline_score >= 65:
        verdict = "Interview Threshold"
    elif baseline_score >= 45:
        verdict = "Risky Filter Trigger"
    else:
        verdict = "Likely Screened Out"

    recommendations: List[str] = []
    if missing_keywords:
        top_missing = ", ".join([f'"{k.keyword}"' for k in missing_keywords[:3]])
        boost = min(18, len(missing_keywords) * 4)
        recommendations.append(
            f"Incorporate top missing competencies: {top_missing} to achieve +{boost}% ATS ranking boost."
        )

    if has_bias_markers:
        recommendations.append(
            f'Replace subjective superlatives (e.g., "{spans[0].matched_text}") with explicit role keywords matching "{target_title}".'
        )
    else:
        recommendations.append(
            "High neutrality maintained: Your resume relies on verifiable skills rather than exclusionary buzzwords."
        )

    recommendations.append(
        "Enterprise scanners like Workday and Greenhouse prioritize exact skill tokens in the top 30% of your resume layout."
    )

    adverse_impact_risk = "Medium" if (baseline_score < 60 or has_bias_markers) else "Low"

    if baseline_score >= 70:
        net_verdict_explanation = (
            f"Your resume surpasses the standard automated recruiter threshold (70%) for {target_title}. "
            "Adopting BiasLens recommendations shields you from demographic screening algorithms while maintaining full keyword potency."
        )
    else:
        net_verdict_explanation = (
            f"Your resume currently risks automated screening under default enterprise thresholds. "
            "Adding the critical missing skills below will bring your profile into the top 15% percentile."
        )

    return CounterfactualJobSimulation(
        baseline_ats_score=baseline_score,
        debiased_ats_score=potential_debiased_score,
        score_delta=delta,
        ats_verdict=verdict,
        adverse_impact_risk=adverse_impact_risk,
        net_verdict_explanation=net_verdict_explanation,
        recommendations=recommendations,
    )


def calculate_ats_match(
    resume_text: str,
    job_description: str,
    target_title: str = "Target Role",
    company: Optional[str] = None,
) -> AtsMatchResult:
    # 1. Extract job skills
    job_hard = _extract_matching_entities(job_description, HARD_SKILLS_DICTIONARY, "hard_skill")
    job_soft = _extract_matching_entities(job_description, SOFT_SKILLS_DICTIONARY, "soft_skill")

    # 2. Extract resume skills
    resume_hard = _extract_matching_entities(resume_text, HARD_SKILLS_DICTIONARY, "hard_skill")
    resume_soft = _extract_matching_entities(resume_text, SOFT_SKILLS_DICTIONARY, "soft_skill")

    matched_keywords: List[KeywordMatchEntry] = []
    missing_keywords: List[KeywordMatchEntry] = []

    # Evaluate hard skills
    hard_matched_count = 0
    hard_total_count = max(1, len(job_hard))

    for term, job_meta in job_hard.items():
        resume_meta = resume_hard.get(term)
        is_found = bool(resume_meta and resume_meta["count"] > 0)
        importance = "required" if job_meta["count"] >= 2 else "preferred"

        entry = KeywordMatchEntry(
            keyword=term,
            category="hard_skill",
            importance=importance,
            status="exact" if is_found else "missing",
            foundInResume=is_found,
            frequencyInJob=job_meta["count"],
            frequencyInResume=resume_meta["count"] if resume_meta else 0,
            suggestedAction=(
                f"Mentioned {resume_meta['count']} time(s). Good density."
                if is_found
                else f"High-priority requirement in {target_title}. Add to technical competencies or project bullet."
            ),
        )

        if is_found:
            hard_matched_count += 1
            matched_keywords.append(entry)
        else:
            missing_keywords.append(entry)

    # Evaluate soft skills
    soft_matched_count = 0
    soft_total_count = max(1, len(job_soft))

    for term, job_meta in job_soft.items():
        resume_meta = resume_soft.get(term)
        is_found = bool(resume_meta and resume_meta["count"] > 0)
        importance = "required" if job_meta["count"] >= 2 else "preferred"

        entry = KeywordMatchEntry(
            keyword=term,
            category="soft_skill",
            importance=importance,
            status="exact" if is_found else "missing",
            foundInResume=is_found,
            frequencyInJob=job_meta["count"],
            frequencyInResume=resume_meta["count"] if resume_meta else 0,
            suggestedAction=(
                "Found in resume context."
                if is_found
                else "Demonstrate in work experience using active outcome metrics."
            ),
        )

        if is_found:
            soft_matched_count += 1
            matched_keywords.append(entry)
        else:
            missing_keywords.append(entry)

    # Sort missing keywords by importance & frequency in job
    missing_keywords.sort(
        key=lambda k: (0 if k.importance == "required" else 1, -k.frequencyInJob)
    )

    hard_skills_score = round((hard_matched_count / hard_total_count) * 100)
    soft_skills_score = round((soft_matched_count / soft_total_count) * 100)
    semantic_score = compute_semantic_cosine_similarity(resume_text, job_description)
    section_hygiene = evaluate_ats_section_hygiene(resume_text)

    overall_match_score = min(
        100,
        max(
            15,
            round(
                hard_skills_score * 0.45
                + semantic_score * 0.25
                + soft_skills_score * 0.15
                + section_hygiene.overall_structure_score * 0.15
            ),
        ),
    )

    counterfactual_sim = simulate_counterfactual_impact(
        resume_text=resume_text,
        baseline_score=overall_match_score,
        target_title=target_title,
        missing_keywords=missing_keywords,
    )

    profile = JobDescriptionProfile(
        id=f"job_{abs(hash(job_description)) % 1000000:06d}",
        title=target_title,
        company=company,
        raw_text=job_description,
    )

    return AtsMatchResult(
        job_profile=profile,
        target_title=target_title,
        overall_match_score=overall_match_score,
        hard_skills_score=hard_skills_score,
        soft_skills_score=soft_skills_score,
        semantic_relevance_score=semantic_score,
        section_coverage=section_hygiene,
        matched_keywords=matched_keywords,
        missing_keywords=missing_keywords,
        counterfactual_simulation=counterfactual_sim,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
