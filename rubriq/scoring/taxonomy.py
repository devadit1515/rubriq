"""Task type -> parameter set with default weights (RESEARCH.md Part 3).

Weights are relative within a task and user-overridable via
EvalOptions.weights (advanced section). Parameters that return score=None
drop out of the weighted overall automatically.
"""

from __future__ import annotations

from typing import Callable

from . import parameters as p
from .parameters import EvalContext
from ..schemas import ParameterScore, TaskType

Evaluator = Callable[[EvalContext], ParameterScore]

# (evaluator, default weight)
TAXONOMY: dict[TaskType, list[tuple[Evaluator, float]]] = {
    TaskType.SUMMARIZATION: [
        (p.faithfulness_param, 3.0),
        (p.answer_relevance, 2.0),
        (p.instruction_following, 2.0),
        (p.conciseness, 1.5),
        (p.coherence_proxy, 1.0),
        (p.readability_audience, 1.0),
    ],
    TaskType.QA_GROUNDED: [
        (p.faithfulness_param, 3.0),
        (p.answer_relevance, 2.5),
        (p.question_coverage, 2.0),
        (p.instruction_following, 1.5),
        (p.conciseness, 1.0),
    ],
    TaskType.QA_OPEN: [
        (p.hallucination_signals, 2.5),
        (p.factual_accuracy_placeholder, 0.0),
        (p.answer_relevance, 2.5),
        (p.question_coverage, 2.0),
        (p.instruction_following, 1.5),
        (p.coherence_proxy, 1.0),
        (p.readability_audience, 1.0),
    ],
    TaskType.CODE_GENERATION: [
        (p.code_validity, 3.0),
        (p.instruction_following, 2.0),
        (p.answer_relevance, 1.0),
        (p.conciseness, 0.5),
    ],
    TaskType.CREATIVE_WRITING: [
        (p.creative_proxies, 2.5),
        (p.instruction_following, 2.5),
        (p.coherence_proxy, 1.0),
        (p.readability_audience, 1.0),
    ],
    TaskType.EXTRACTION: [
        (p.extraction_grounding, 3.0),
        (p.instruction_following, 3.0),
        (p.answer_relevance, 1.0),
    ],
    TaskType.REASONING: [
        (p.reasoning_structure, 2.5),
        (p.answer_relevance, 1.5),
        (p.instruction_following, 2.0),
        (p.hallucination_signals, 1.0),
        (p.conciseness, 0.5),
    ],
    TaskType.REWRITING: [
        (p.meaning_preservation, 3.0),
        (p.instruction_following, 2.5),
        (p.readability_audience, 1.5),
        (p.creative_proxies, 1.0),
    ],
    TaskType.GENERAL: [
        (p.instruction_following, 2.5),
        (p.answer_relevance, 2.0),
        (p.hallucination_signals, 1.5),
        (p.coherence_proxy, 1.0),
        (p.readability_audience, 1.0),
        (p.conciseness, 1.0),
    ],
}
