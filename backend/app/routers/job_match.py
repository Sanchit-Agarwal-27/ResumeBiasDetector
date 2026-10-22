from fastapi import APIRouter
from ..schemas import JobMatchRequest, AtsMatchResult
from ..services.ats_engine import calculate_ats_match

router = APIRouter(prefix="/api", tags=["Job Matching"])


@router.post("/job-match", response_model=AtsMatchResult)
async def match_resume_to_job(request: JobMatchRequest):
    """
    ATS keyword parsing and counterfactual matching simulation endpoint.
    Extracts hard/soft skill entities, computes TF-IDF semantic relevance,
    grades section hygiene, and projects score improvements upon debiasing.
    """
    return calculate_ats_match(
        resume_text=request.resume_text,
        job_description=request.job_description,
        target_title=request.target_title or "Target Role",
    )
