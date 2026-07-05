"""FastAPI surface. One evaluation endpoint; the engine behind it is chosen
by the Scorer adapter, so judge mode later is a query param, not a rewrite.

Run:  uvicorn rubriq.api.main:app --reload
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    # Reports without loading: a health probe must never block on model I/O.
    return {"status": "ok", "engines": list(_SCORERS), "models": models.loaded()}


@app.on_event("startup")
def _warm_models_in_background() -> None:
    threading.Thread(target=models.availability, daemon=True).start()


@app.post("/warmup")
def warmup() -> dict:
    """Load both local models so the first evaluation doesn't pay the cost."""
    return models.availability()


# Serve the built frontend when web/dist is present (a single-container deploy or
# a local `npm run build`). The primary frontend now lives on Vercel and reaches
# this engine via rewrites, so in the API-only deploy dist is simply absent and no
# static mount is added. Mounted last so API routes win. RUBRIQ_WEB_DIR overrides.
_candidates = [
    Path(os.environ["RUBRIQ_WEB_DIR"]) if os.environ.get("RUBRIQ_WEB_DIR") else None,
    Path(__file__).resolve().parents[2] / "web" / "dist",
    Path.cwd() / "web" / "dist",
]
for _web_dir in filter(None, _candidates):
    if _web_dir.is_dir():
        app.mount("/", StaticFiles(directory=_web_dir, html=True), name="web")
        break
