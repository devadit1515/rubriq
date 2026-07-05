"""LocalScorer: the v1 engine. Deterministic + statistical, no API calls."""

from __future__ import annotations

from ..classify import classify
from ..prompts.generator import generate_improvement_prompts
from ..schemas import EvalReport, EvalRequest, OverallScore, TaskType
from .base import Scorer
from .parameters import EvalContext
from .taxonomy import TAXONOMY

_CARVEOUT_NOTES = {
    "open_world": ("Factual accuracy against world knowledge is not verifiable locally; "
                   "Rubriq reports fabrication-risk signals instead. LLM-judge mode adds verification."),
    "proxy": ("Parameters marked 'proxy' measure statistical stand-ins (diversity, rhythm, flow), "
              "not the subjective quality itself."),
    "static_code": "Code is analyzed statically, never executed; parsing cleanly does not mean it runs correctly.",
}


class LocalScorer(Scorer):
    name = "local"

    def evaluate(self, request: EvalRequest) -> EvalReport:
        task = classify(request.prompt, request.output)
        ctx = EvalContext(
            prompt=request.prompt,
            output=request.output,
            task=task,
            audience=request.options.audience,
        )

        specs = TAXONOMY[task.task_type]
        params = []
        weights: dict[str, float] = {}
        for evaluator, default_w in specs:
            score = evaluator(ctx)
            params.append(score)
            weights[score.parameter] = request.options.weights.get(score.parameter, default_w)

        scored = [ps for ps in params if ps.score is not None and weights.get(ps.parameter, 0) > 0]
        if scored:
            total_w = sum(weights[ps.parameter] for ps in scored)
            overall_val = sum(ps.score * weights[ps.parameter] for ps in scored) / total_w
        else:
            overall_val = 0.0
        skipped = [ps.display_name for ps in params if ps.score is None]
        note = (f"Weighted over {len(scored)} locally scoreable parameters"
                + (f"; not included: {', '.join(skipped)}" if skipped else "") + ".")

        honesty: list[str] = []
        if task.task_type in (TaskType.QA_OPEN, TaskType.GENERAL, TaskType.REASONING) or not task.has_source_text:
            honesty.append(_CARVEOUT_NOTES["open_world"])
        if any(ps.is_proxy for ps in params):
            honesty.append(_CARVEOUT_NOTES["proxy"])
        if task.task_type == TaskType.CODE_GENERATION:
            honesty.append(_CARVEOUT_NOTES["static_code"])

        prompts = generate_improvement_prompts(
            model_name=request.model_name,
            task=task,
            parameters=params,
        )

        return EvalReport(
            task=task,
            parameters=params,
            overall=OverallScore(score=round(overall_val, 1), note=note),
            improvement_prompts=prompts,
            honesty_notes=honesty,
            engine=self.name,
        )
