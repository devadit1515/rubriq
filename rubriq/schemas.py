"""Data contracts shared by every scorer implementation and the API.

The adapter rule: LocalScorer (v1) and LLMJudgeScorer (later) both consume
EvalRequest and produce EvalReport. Nothing downstream may depend on which
engine ran; honesty flags (is_proxy, requires_judge) live on the schema so
the UI cannot forget them.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    SUMMARIZATION = "summarization"
    QA_GROUNDED = "qa_grounded"          # question answered against source text in the prompt
    QA_OPEN = "qa_open"                  # question with no source text to check against
    CODE_GENERATION = "code_generation"
    CREATIVE_WRITING = "creative_writing"
    EXTRACTION = "extraction"
    REASONING = "reasoning"
    REWRITING = "rewriting"
    GENERAL = "general"


class FailureMode(str, Enum):
    UNFAITHFUL_CONTENT = "unfaithful_content"
    HALLUCINATION_RISK = "hallucination_risk"
    MISSED_CONSTRAINT = "missed_constraint"
    INCOMPLETE_COVERAGE = "incomplete_coverage"
    OFF_TOPIC_DRIFT = "off_topic_drift"
    POOR_STRUCTURE = "poor_structure"
    WRONG_REGISTER = "wrong_register"
    VERBOSITY = "verbosity"
    WEAK_REASONING = "weak_reasoning"
    FORMAT_VIOLATION = "format_violation"
    LOW_DIVERSITY = "low_diversity"
    INVALID_CODE = "invalid_code"
    INVENTED_FIELDS = "invented_fields"
    FACTUAL_ERROR = "factual_error"            # judge mode: confirmed wrong vs world knowledge
    SUBJECTIVE_WEAKNESS = "subjective_weakness"  # judge mode: quality/craft weakness


class ModelFamily(str, Enum):
    CLAUDE = "claude"
    GPT = "gpt"
    GEMINI = "gemini"
    OPEN_WEIGHTS = "open_weights"   # llama, mistral, qwen, ...
    GENERIC = "generic"


class Evidence(BaseModel):
    """A quote from the output (or prompt) backing a finding."""
    quote: str
    source: str = "output"          # "output" | "prompt"
    note: str = ""


class Finding(BaseModel):
    """One diagnosed problem, specific enough to drive a repair prompt."""
    failure_mode: FailureMode
    detail: str                     # human-readable diagnosis naming the problem
    evidence: list[Evidence] = Field(default_factory=list)
    data: dict = Field(default_factory=dict)   # machine-readable specifics (e.g. limit=150, actual=212)


class ParameterScore(BaseModel):
    parameter: str                  # machine key, e.g. "faithfulness"
    display_name: str
    score: float | None             # 0-100; None when the check could not run
    verdict: str                    # one-line summary of how the output did
    strengths: list[str] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    is_proxy: bool = False          # proxy metric (subjective-quality carve-out)
    requires_judge: bool = False    # cannot be judged locally at all; needs LLM-judge mode
    skipped_reason: str = ""        # set when score is None
    rubric_source: str = ""         # citation key into RESEARCH.md, e.g. "SummaC (Laban et al. 2022)"


class TaskClassification(BaseModel):
    task_type: TaskType
    confidence: float               # 0-1
    signals: list[str] = Field(default_factory=list)  # why, shown in UI
    has_source_text: bool = False
    instruction: str = ""           # prompt minus pasted source material
    source_text: str | None = None


class ImprovementPrompt(BaseModel):
    failure_mode: FailureMode
    title: str
    diagnosis: str                  # names the specific problem found, with evidence
    prompt_text: str                # ready to paste
    model_family: ModelFamily
    technique_source: str           # citation key into RESEARCH.md


class OverallScore(BaseModel):
    score: float                    # weighted 0-100 over scoreable parameters
    note: str                       # what the number does and does not include


class EvalOptions(BaseModel):
    """Advanced options; every field has a sensible default (per brief)."""
    weights: dict[str, float] = Field(default_factory=dict)   # parameter key -> weight override
    audience: str = ""              # e.g. "children", "expert clinicians"
    tone: str = ""                  # expected register, free text


class EvalRequest(BaseModel):
    prompt: str
    output: str
    model_name: str = ""            # free text, e.g. "gpt-4o", "claude sonnet"
    options: EvalOptions = Field(default_factory=EvalOptions)


class EvalReport(BaseModel):
    task: TaskClassification
    parameters: list[ParameterScore]
    overall: OverallScore
    improvement_prompts: list[ImprovementPrompt]
    honesty_notes: list[str] = Field(default_factory=list)  # carve-out disclosures for this run
    engine: str = "local"           # which Scorer produced this
