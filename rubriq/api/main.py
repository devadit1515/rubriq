"""FastAPI surface. One evaluation endpoint; the engine behind it is chosen
by the Scorer adapter, so judge mode later is a query param, not a rewrite.

Run:  uvicorn rubriq.api.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .. import models
from ..schemas import EvalReport, EvalRequest
from ..scoring import LocalScorer, Scorer

app = FastAPI(
    title="Rubriq",
    version="0.1.0",
    description="Local, research-grounded LLM output quality evaluation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tightened at deployment (Step 2)
    allow_methods=["*"],
    allow_headers=["*"],
)

_SCORERS: dict[str, Scorer] = {"local": LocalScorer()}
# LLMJudgeScorer registers here later: {"judge-byok": ..., "judge-managed": ...}


@app.post("/evaluate", response_model=EvalReport)
def evaluate(request: EvalRequest, engine: str = "local") -> EvalReport:
    scorer = _SCORERS.get(engine)
    if scorer is None:
        raise HTTPException(status_code=400, detail=f"unknown engine '{engine}'; available: {list(_SCORERS)}")
    if not request.prompt.strip() or not request.output.strip():
        raise HTTPException(status_code=422, detail="both prompt and output are required")
    return scorer.evaluate(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engines": list(_SCORERS), "models": models.availability()}


@app.post("/warmup")
def warmup() -> dict:
    """Load both local models so the first evaluation doesn't pay the cost."""
    return models.availability()
