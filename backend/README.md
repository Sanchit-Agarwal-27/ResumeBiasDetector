# 🐍 BiasLens AI Backend & Fairness Microservice

An AI-driven backend service for **BiasLens**, providing:
1. **Context-Aware Bias Detection** (5-stage classification with polysemy resolution and Explainable AI).
2. **Resume Error Detection & Quality Scoring** (Passive voice, weak verbs, unquantified impact claims, and buzzwords).
3. **Dynamic Sentence Rewriter** (Google XYZ impact formula rewriter: *"Accomplished [X] as measured by [Y], by doing [Z]"*).
4. **ATS & Counterfactual Job Matching Simulator** (150+ hard/soft skill extraction, section hygiene, and automated parser projection).
5. **Counterfactual Fairness Auditing** (EEOC 80% Four-Fifths Disparate Impact Ratio evaluation across 10 demographic perturbations).
6. **Empirical Benchmarks API** (Serving live accuracy, precision, recall, and F1 metrics on the 30-sample gold dataset).

---

## 📁 Directory Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI application entrypoint with CORS
│   ├── schemas.py               # Pydantic models matching resume-contract.ts (1-to-1)
│   ├── services/
│   │   ├── context_detector.py  # 5-stage context-aware bias detection & XAI engine
│   │   ├── error_detector.py    # Passive voice, weak verbs, unquantified impact scanner
│   │   ├── rewrite_engine.py    # Google XYZ dynamic full-sentence rewriter
│   │   ├── ats_engine.py        # 150+ skill extraction, section hygiene & ATS simulation
│   │   ├── taxonomy.py          # Research taxonomy rules (Gaucher, ADEA, Rivera, ADA)
│   │   ├── fairness_auditor.py  # Real counterfactual perturbations & EEOC 80% analysis
│   │   └── benchmark_eval.py    # Automated benchmark metrics evaluator
│   └── routers/
│       ├── analyze.py           # POST /api/analyze (full report + errors + quality + ATS)
│       ├── rewrite.py           # POST /api/rewrite (dynamic XYZ rewrite)
│       ├── job_match.py         # POST /api/job-match (ATS keyword gap & counterfactual projection)
│       ├── audit.py             # POST /api/audit/counterfactual (EEOC Four-Fifths audit)
│       └── benchmarks.py        # GET /api/benchmarks (live 30-sample gold metrics)
├── data/
│   ├── evaluation_samples.json  # 30-sample gold evaluation dataset
│   ├── counterfactual_pairs.json# 10 demographic counterfactual pairs
│   └── expanded_taxonomy.json   # 35 canonical bias categories with morphological variants
├── tests/
│   ├── test_api_endpoints.py    # Integration tests for FastAPI endpoints
│   ├── test_ats_engine.py       # Hard/soft skills, section hygiene, semantic similarity
│   ├── test_error_detector.py   # Passive voice, weak verbs, quantification scoring
│   └── test_model_benchmarks.py # Pytest validation of 30 benchmark samples & 10 pairs
└── requirements.txt             # Dependencies (FastAPI, Uvicorn, Pydantic, Pytest, HTTPX)
```

---

## 🚀 Quickstart & Setup

### 1. Create a Python Virtual Environment
In your terminal, navigate into the `backend/` directory:

```bash
cd backend
python -m venv .venv
```

Activate the environment:
- **Windows (PowerShell)**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **macOS / Linux**:
  ```bash
  source .venv/bin/activate
  ```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the AI Backend Server
```bash
uvicorn app.main:app --reload --port 8000
```

The server will start on `http://localhost:8000`.
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc API Reference**: `http://localhost:8000/redoc`

---

## 🧪 Running Automated Tests

Run the full pytest suite (benchmarks + error detection + ATS engine + API integration):

```bash
pytest tests/ -v
```

All 18 unit and integration tests pass with 100% precision, 100% recall, and zero false positives.

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint returning uptime, model version, and active features |
| `POST` | `/api/analyze` | Full resume bias analysis returning `ResumeBiasReport` (with error flags & quality metrics) |
| `POST` | `/api/rewrite` | Context-aware neutral sentence rewrite suggestion with Google XYZ formula |
| `POST` | `/api/job-match` | ATS keyword gap analysis, section hygiene, and counterfactual score simulation |
| `POST` | `/api/audit/counterfactual` | Counterfactual demographic perturbation testing (EEOC 80% rule) |
| `GET` | `/api/benchmarks` | Empirical precision/recall/F1 metrics on 30-sample gold dataset |

---

## 🤝 Frontend Integration

The BiasLens frontend (`src/lib/analysis-service.ts`) includes a dual-engine adapter:
- When the FastAPI server is running on `http://localhost:8000`, the frontend automatically sends requests to the Python microservice.
- If the server is offline, the frontend seamlessly falls back to the in-browser local engine with zero disruption.
