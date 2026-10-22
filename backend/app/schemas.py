from __future__ import annotations
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class BiasCategory(str, Enum):
    GENDER_CODED = "gender_coded"
    AGE_INDICATIVE = "age_indicative"
    PRESTIGE_PROXY = "prestige_proxy"
    GAP_FRAMING = "gap_framing"
    DISABILITY_CODED = "disability_coded"
    PERSONALITY_BEHAVIORAL = "personality_behavioral"


class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ResumeErrorType(str, Enum):
    PASSIVE_VOICE = "passive_voice"
    WEAK_VERB = "weak_verb"
    UNQUANTIFIED_IMPACT = "unquantified_impact"
    BUZZWORD_CLICHE = "buzzword_cliche"
    PUNCTUATION_INCONSISTENCY = "punctuation_inconsistency"
    PROFANITY = "profanity"
    SLANG = "slang"
    FIRST_PERSON = "first_person"
    SPELLING = "spelling"
    PERSONAL_INFO = "personal_info"
    CLICHE = "cliche"


class ResumeErrorFlag(BaseModel):
    id: str
    error_type: ResumeErrorType
    sentence: str
    start: int
    end: int
    matched_text: str
    suggestion: str
    explanation: str
    severity: SeverityLevel = SeverityLevel.MEDIUM


class QualityMetrics(BaseModel):
    action_verb_score: int = Field(ge=0, le=100)
    quantification_score: int = Field(ge=0, le=100)
    passive_voice_count: int = 0
    weak_verb_count: int = 0
    unquantified_bullet_count: int = 0
    total_bullet_count: int = 0
    ats_readability_score: int = Field(ge=0, le=100)
    profanity_count: int = 0
    slang_count: int = 0
    first_person_count: int = 0
    spelling_error_count: int = 0


class BiasSpan(BaseModel):
    id: str
    start: int
    end: int
    matched_text: str
    category: BiasCategory
    subcategory: Optional[str] = None
    severity: SeverityLevel
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    research_citation: Optional[str] = None
    classification: Optional[str] = None  # "Fine" | "Flagged"
    sentence: Optional[str] = None
    sentence_start: Optional[int] = None
    sentence_end: Optional[int] = None
    context_type: Optional[str] = None
    is_candidate_only: Optional[bool] = False


class ClassifiedSentence(BaseModel):
    sentence: str
    keyword_match: List[str] = []
    classification: str  # "Fine" | "Flagged"
    confidence: float
    explanation: str
    contextType: str
    start: Optional[int] = None
    end: Optional[int] = None


class ContextSummary(BaseModel):
    total_sentences: int
    flagged_sentences: int
    fine_sentences: int
    candidate_keywords_detected: int
    exonerated_keywords: int


class RewriteSuggestion(BaseModel):
    span_id: str
    original_text: str
    suggested_text: str
    rationale: str
    full_sentence_rewrite: Optional[str] = None
    impact_formula_applied: Optional[str] = None


class FairnessMetric(BaseModel):
    metric_name: str
    value: float
    threshold: float
    passes_rule: bool
    notes: str


class FairnessAudit(BaseModel):
    disparate_impact_ratio: FairnessMetric
    demographic_parity: FairnessMetric
    counterfactual_permutations_tested: int
    tested_variations: Optional[List[Dict[str, str]]] = None


class EvaluationBenchmark(BaseModel):
    model_name: str
    precision: float
    recall: float
    f1_score: float


class ReportSummary(BaseModel):
    total_flags: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]


# --- ATS & Job Matching Schemas ---
class KeywordMatchEntry(BaseModel):
    keyword: str
    category: str  # "hard_skill" | "soft_skill" | "certification" | "tool_framework"
    importance: str  # "required" | "preferred" | "domain_context"
    status: str  # "exact" | "synonym" | "missing"
    foundInResume: bool
    frequencyInJob: int = 1
    frequencyInResume: int = 0
    suggestedAction: Optional[str] = None


class AtsSectionCoverage(BaseModel):
    contact_info: bool = True
    work_experience: bool = True
    education: bool = True
    skills_section: bool = True
    overall_structure_score: int = Field(ge=0, le=100)


class CounterfactualJobSimulation(BaseModel):
    baseline_ats_score: int
    debiased_ats_score: int
    score_delta: int
    ats_verdict: str
    adverse_impact_risk: str
    net_verdict_explanation: str
    recommendations: List[str] = []


class JobDescriptionProfile(BaseModel):
    id: str = "job_profile_01"
    title: str
    company: Optional[str] = None
    raw_text: str
    target_seniority: Optional[str] = None


class AtsMatchResult(BaseModel):
    job_profile: Optional[JobDescriptionProfile] = None
    target_title: Optional[str] = None
    overall_match_score: int = Field(ge=0, le=100)
    hard_skills_score: int = Field(ge=0, le=100)
    soft_skills_score: int = Field(ge=0, le=100)
    semantic_relevance_score: int = Field(ge=0, le=100)
    section_coverage: AtsSectionCoverage
    matched_keywords: List[KeywordMatchEntry] = []
    missing_keywords: List[KeywordMatchEntry] = []
    counterfactual_simulation: CounterfactualJobSimulation
    analyzed_at: str


class ResumeBiasReport(BaseModel):
    document_id: str
    file_name: str
    raw_text: str
    neutrality_score: int = Field(ge=0, le=100)
    summary: ReportSummary
    spans: List[BiasSpan]
    suggestions: Dict[str, RewriteSuggestion]
    fairness_audit: Optional[FairnessAudit] = None
    evaluation_benchmarks: Optional[List[EvaluationBenchmark]] = None
    classified_sentences: Optional[List[ClassifiedSentence]] = None
    context_summary: Optional[ContextSummary] = None
    error_flags: Optional[List[ResumeErrorFlag]] = None
    quality_metrics: Optional[QualityMetrics] = None
    ats_match: Optional[AtsMatchResult] = None


class AnalyzeRequest(BaseModel):
    raw_text: str
    file_name: str = "uploaded_resume.txt"
    job_description: Optional[str] = None
    target_title: Optional[str] = None


class RewriteRequest(BaseModel):
    span_id: str
    sentence: str
    matched_text: str
    category: BiasCategory


class JobMatchRequest(BaseModel):
    resume_text: str
    job_description: str
    target_title: Optional[str] = "Target Role"


class CounterfactualAuditRequest(BaseModel):
    raw_text: str


class HealthResponse(BaseModel):
    status: str
    model_version: str
    engine: str
    uptime_seconds: float
    features_active: List[str] = []
