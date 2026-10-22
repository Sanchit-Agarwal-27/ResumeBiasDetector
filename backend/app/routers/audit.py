from fastapi import APIRouter
from ..schemas import CounterfactualAuditRequest, FairnessAudit
from ..services.fairness_auditor import run_counterfactual_audit
from ..services.context_detector import analyze_document_text

router = APIRouter(prefix="/api/audit", tags=["Fairness Audit"])


@router.post("/counterfactual", response_model=FairnessAudit)
async def audit_counterfactual(request: CounterfactualAuditRequest):
    """
    Simulates demographic counterfactual swaps (gender, graduation years, pedigree)
    and verifies whether prediction variance adheres to the EEOC 80% (Four-Fifths) rule.
    """
    spans, _, _, _ = analyze_document_text(request.raw_text)
    return run_counterfactual_audit(request.raw_text, len(spans))
