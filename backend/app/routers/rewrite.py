from fastapi import APIRouter
from ..schemas import RewriteRequest, RewriteSuggestion
from ..services.rewrite_engine import generate_sentence_rewrite

router = APIRouter(prefix="/api", tags=["Rewrite"])


@router.post("/rewrite", response_model=RewriteSuggestion)
async def generate_rewrite(request: RewriteRequest):
    """
    Focused sentence rewrite suggestion endpoint.
    Proposes an objective neutral replacement grounded in academic literature,
    along with a Google XYZ full-sentence rewrite.
    """
    return generate_sentence_rewrite(
        span_id=request.span_id,
        original_sentence=request.sentence,
        matched_text=request.matched_text,
        category=request.category,
    )
