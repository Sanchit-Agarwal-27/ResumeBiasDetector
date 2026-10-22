from fastapi import APIRouter
from ..schemas import (
    AnalyzeRequest,
    ResumeBiasReport,
    ReportSummary,
    BiasCategory,
    SeverityLevel,
)
from ..services.context_detector import analyze_document_text
from ..services.error_detector import detect_resume_errors
from ..services.fairness_auditor import run_counterfactual_audit
from ..services.benchmark_eval import evaluate_benchmarks
from ..services.ats_engine import calculate_ats_match
from ..services.rewrite_engine import generate_sentence_rewrite

router = APIRouter(prefix="/api", tags=["Analysis"])

SEVERITY_WEIGHTS = {
    SeverityLevel.LOW: 3,
    SeverityLevel.MEDIUM: 7,
    SeverityLevel.HIGH: 12,
}


@router.post("/analyze", response_model=ResumeBiasReport)
async def analyze_resume(request: AnalyzeRequest):
    """
    Full AI analysis endpoint. Takes raw resume text, parses sentences,
    detects bias spans with context exoneration, computes the neutrality score,
    runs resume writing quality & error detection, executes counterfactual fairness
    auditing, and optionally generates ATS job matching metrics.
    """
    spans, raw_suggestions, sentences, context_summary = analyze_document_text(
        request.raw_text, request.file_name
    )

    # Enrich suggestions with Google XYZ full-sentence rewrites
    suggestions = {}
    for span_id, sug in raw_suggestions.items():
        span = next((s for s in spans if s.id == span_id), None)
        sent_text = span.sentence if span and span.sentence else sug.original_text
        cat = span.category if span else BiasCategory.GENDER_CODED
        enriched = generate_sentence_rewrite(
            span_id=span_id,
            original_sentence=sent_text,
            matched_text=sug.original_text,
            category=cat,
        )
        suggestions[span_id] = enriched

    # Detect resume writing errors and compute quality scores
    error_flags, quality_metrics = detect_resume_errors(request.raw_text)

    # Compute breakdown counts
    by_category = {cat.value: 0 for cat in BiasCategory}
    by_severity = {sev.value: 0 for sev in SeverityLevel}

    for span in spans:
        by_category[span.category.value] = by_category.get(span.category.value, 0) + 1
        by_severity[span.severity.value] = by_severity.get(span.severity.value, 0) + 1

    # Neutrality score calculation: 100 - sum(weights)
    penalty = sum(SEVERITY_WEIGHTS.get(span.severity, 5) for span in spans)
    neutrality_score = max(0, 100 - penalty)

    summary = ReportSummary(
        total_flags=len(spans),
        by_category=by_category,
        by_severity=by_severity,
    )

    fairness_audit = run_counterfactual_audit(request.raw_text, len(spans))
    benchmarks_data = evaluate_benchmarks()

    ats_match = None
    if request.job_description and request.job_description.strip():
        ats_match = calculate_ats_match(
            resume_text=request.raw_text,
            job_description=request.job_description,
            target_title=request.target_title or "Target Role",
        )

    return ResumeBiasReport(
        document_id=f"doc_{abs(hash(request.raw_text)) % 1000000:06d}",
        file_name=request.file_name,
        raw_text=request.raw_text,
        neutrality_score=neutrality_score,
        summary=summary,
        spans=spans,
        suggestions=suggestions,
        fairness_audit=fairness_audit,
        evaluation_benchmarks=benchmarks_data.get("benchmarks", []),
        classified_sentences=sentences,
        context_summary=context_summary,
        error_flags=error_flags,
        quality_metrics=quality_metrics,
        ats_match=ats_match,
    )
