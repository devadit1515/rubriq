"""The Scorer adapter interface (required by brief).

LocalScorer implements it today with deterministic/statistical methods.
LLMJudgeScorer will implement the same contract later, in two configurations:
BYO-key (free tier) and our-key (paid tier). Nothing downstream — API,
frontend, tests — may import anything but this interface and the schemas.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..schemas import EvalReport, EvalRequest


class Scorer(ABC):
    """Turns an EvalRequest into an EvalReport. Implementations must set
    EvalReport.engine and fill honesty_notes with whatever the engine
    cannot judge."""

    name: str = "abstract"

    @abstractmethod
    def evaluate(self, request: EvalRequest) -> EvalReport:
        ...
