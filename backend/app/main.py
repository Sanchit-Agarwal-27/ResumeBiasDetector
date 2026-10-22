import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import HealthResponse
from .routers import analyze, rewrite, audit, benchmarks, job_match

START_TIME = time.time()

app = FastAPI(
    title="BiasLens AI Engine & Fairness API",
    description="Context-Aware Resume Bias Detection, Error Detection & Correction, ATS Job Matching, and Explainable AI (XAI) Microservice.",
    version="2.5.0",
)

# Configure CORS so the frontend running on Vite (localhost:8080 or localhost:5173) can communicate seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(analyze.router)
app.include_router(rewrite.router)
app.include_router(audit.router)
app.include_router(benchmarks.router)
app.include_router(job_match.router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint used by the frontend to verify live AI server availability."""
    return HealthResponse(
        status="healthy",
        model_version="BiasLens Context-Aware Transformer v2.5",
        engine="Python FastAPI + XAI Engine",
        uptime_seconds=round(time.time() - START_TIME, 2),
        features_active=[
            "context_aware_bias_detection",
            "resume_error_quality_detection",
            "dynamic_xyz_rewriter",
            "ats_job_matching_simulation",
            "counterfactual_fairness_audit",
            "gold_benchmark_evaluation",
        ],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
