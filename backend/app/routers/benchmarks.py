from fastapi import APIRouter
from typing import Dict, Any
from ..services.benchmark_eval import evaluate_benchmarks

router = APIRouter(prefix="/api/benchmarks", tags=["Benchmarks"])


@router.get("", response_model=Dict[str, Any])
async def get_benchmarks():
    """
    Returns live evaluation benchmark metrics (Accuracy, Precision, Recall, FPR, F1)
    computed across the 30-sample gold evaluation dataset.
    """
    return evaluate_benchmarks()
