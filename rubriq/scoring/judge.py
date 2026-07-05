"""GeminiJudgeScorer — the bring-your-own-key judge tier (free tier per brief).

Hybrid by design: the deterministic local checks run first and stay (a counter
beats an LLM at counting words). Gemini then fills exactly the gaps the local
engine cannot close — factual accuracy against world knowledge, a second opinion
on the small NLI model's faithfulness flags, subjective quality, and a sharper
repair prompt. Any judge failure degrades gracefully to the local report.

The API key is per-request and never stored or logged.
"""

from __future__ import annotations

from ..gemini import GeminiError, call_gemini, call_gemini_json
from ..schemas import (Evidence, EvalReport, EvalRequest, FailureMode, Finding,
                       OverallScore, ParameterScore)
from .base import Scorer
from .local import LocalScorer

DEFAULT_MODEL = "gemini-2.0-flash"


def _clamp(x) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(100.0, round(v, 1)))


def _findings(items, mode: FailureMode) -> list[Finding]:
    out: list[Finding] = []
    for it in items or []:
        if isinstance(it, str):
            out.append(Finding(failure_mode=mode, detail=it.strip()))
            continue
        quote = str(it.get("quote", "")).strip()
        note = str(it.get("note", "")).strip()
        ev = [Evidence(quote=quote)] if quote else []
        out.append(Finding(failure_mode=mode, detail=note or "Flagged by the judge.", evidence=ev))
    return out


class GeminiJudgeScorer(Scorer):
    name = "judge-gemini"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL, local: LocalScorer | None = None):
        self.api_key = api_key
        self.model = (model or DEFAULT_MODEL).strip()
        self.local = local or LocalScorer()

    def evaluate(self, request: EvalRequest) -> EvalReport:
        report = self.local.evaluate(request)  # full local pass first
        try:
            analysis = self._analyze(request, report)
            repair_text = self._repair(request, report, analysis)
        except GeminiError as e:
            report.honesty_notes.insert(0, f"Judge mode unavailable ({e}) — showing the local analysis only.")
            return report

        self._merge(report, analysis, repair_text)
        report.engine = "judge-gemini"
        report.honesty_notes = self._judge_notes(request, report)
        return report

    # --------------------------------------------------------------- Gemini calls

    def _analyze(self, request: EvalRequest, report: EvalReport) -> dict:
        source = report.task.source_text
        local_flags = "; ".join(
            f.detail for p in report.parameters for f in p.findings
        )[:1500]
        system = (
            "You are a rigorous, fair evaluation judge for LLM outputs. You verify claims "
            "against real-world knowledge and assess quality precisely. Return ONLY a JSON "
            "object matching the requested schema. Every quote must be copied verbatim from "
            "THE OUTPUT. Be specific and honest; do not invent problems, and do not soften real ones."
        )
        schema = (
            '{\n'
            '  "factual_accuracy": {"score": <0-100 int>, "verdict": "<one sentence>", '
            '"issues": [{"quote": "<verbatim from output>", "note": "<why wrong or unverifiable>"}]},\n'
            '  "faithfulness": {"score": <0-100 int>, "verdict": "<one sentence>", '
            '"unsupported": [{"quote": "<verbatim from output>", "note": "<why the source does not support it>"}]} '
            "or null if there is no source text,\n"
            '  "subjective_quality": {"score": <0-100 int>, "verdict": "<one sentence>", '
            '"strengths": ["<short>"], "weaknesses": ["<short>"]}\n'
            '}'
        )
        parts = [
            f"TASK TYPE: {report.task.task_type.value}",
            f"THE INSTRUCTION GIVEN TO THE MODEL:\n{report.task.instruction}",
        ]
        if source:
            parts.append(f"THE SOURCE TEXT THE MODEL WAS GIVEN:\n{source}")
        else:
            parts.append("THE SOURCE TEXT: (none — set faithfulness to null)")
        parts.append(f"THE OUTPUT TO JUDGE:\n{request.output}")
        if local_flags:
            parts.append(f"Automated local checks flagged: {local_flags}\n(Confirm, correct, or overturn these.)")
        parts.append("Return JSON exactly in this shape:\n" + schema)
        return call_gemini_json(self.api_key, self.model, system, "\n\n".join(parts))

    def _repair(self, request: EvalRequest, report: EvalReport, analysis: dict) -> str:
        base_prompt = report.improvement_prompts[0] if report.improvement_prompts else None
        family = base_prompt.model_family.value if base_prompt else "generic"
        problems: list[str] = [f.detail for p in report.parameters for f in p.findings]
        fa = analysis.get("factual_accuracy") or {}
        for it in fa.get("issues", []) or []:
            if isinstance(it, dict) and it.get("note"):
                problems.append(f"Factual: {it['note']}")
        problem_list = "\n".join(f"- {p}" for p in problems[:12]) or "- (no specific failures found)"
        system = (
            "You are a prompt engineer. Write ONE improved, ready-to-paste prompt that the user "
            "can send to the model to get a corrected answer. It must restate the task, then "
            "explicitly forbid each diagnosed failure, and end with a short verification checklist. "
            "Adapt the phrasing to the target model family's known prompting style. Output ONLY the "
            "prompt text — no preamble, no explanation, no code fences."
        )
        user = (
            f"TARGET MODEL FAMILY: {family}\n\n"
            f"THE ORIGINAL INSTRUCTION:\n{report.task.instruction}\n\n"
            f"DIAGNOSED FAILURES TO FIX (do not let any recur):\n{problem_list}\n\n"
            "Write the single corrected prompt now."
        )
        return call_gemini(self.api_key, self.model, system, user).strip()

    # --------------------------------------------------------------- merge results

    def _merge(self, report: EvalReport, analysis: dict, repair_text: str) -> None:
        by_key = {p.parameter: p for p in report.parameters}

        fa = analysis.get("factual_accuracy")
        if isinstance(fa, dict) and "factual_accuracy" in by_key:
            p = by_key["factual_accuracy"]
            p.score = _clamp(fa.get("score"))
            p.verdict = str(fa.get("verdict") or "Assessed against world knowledge by the judge.")
            p.findings = _findings(fa.get("issues"), FailureMode.FACTUAL_ERROR)
            p.requires_judge = False
            p.skipped_reason = ""
            p.strengths = ["No factual errors found by the judge."] if not p.findings else []
            p.rubric_source = f"Gemini judge ({self.model}, your key)"

        faith = analysis.get("faithfulness")
        if isinstance(faith, dict) and "faithfulness" in by_key:
            p = by_key["faithfulness"]
            p.score = _clamp(faith.get("score"))
            p.verdict = str(faith.get("verdict") or "Re-verified against the source by the judge.")
            p.findings = _findings(faith.get("unsupported"), FailureMode.UNFAITHFUL_CONTENT)
            p.strengths = ["Every claim traces to the source (judge-verified)."] if not p.findings else []
            p.rubric_source = f"{p.rubric_source} · re-verified by Gemini judge"

        sq = analysis.get("subjective_quality")
        if isinstance(sq, dict):
            weaknesses = [w for w in (sq.get("weaknesses") or []) if str(w).strip()]
            strengths = [s for s in (sq.get("strengths") or []) if str(s).strip()]
            report.parameters.append(ParameterScore(
                parameter="subjective_quality",
                display_name="Subjective quality (judge)",
                score=_clamp(sq.get("score")),
                verdict=str(sq.get("verdict") or "Overall quality assessed by the judge."),
                strengths=[str(s) for s in strengths[:4]],
                findings=_findings(weaknesses[:4], FailureMode.SUBJECTIVE_WEAKNESS),
                rubric_source=f"Gemini judge ({self.model}, your key)",
            ))

        if repair_text and report.improvement_prompts:
            ip = report.improvement_prompts[0]
            ip.prompt_text = repair_text
            ip.technique_source = f"{ip.technique_source} · rewritten by Gemini judge ({self.model})"

        # Recompute the overall over everything now scoreable (equal weight, transparent).
        scoreable = [p for p in report.parameters if p.score is not None]
        if scoreable:
            overall = sum(p.score for p in scoreable) / len(scoreable)
            report.overall = OverallScore(
                score=round(overall, 1),
                note=f"Judge mode: averaged over {len(scoreable)} parameters, "
                     "including Gemini's factual-accuracy and quality judgments.",
            )

    def _judge_notes(self, request: EvalRequest, report: EvalReport) -> list[str]:
        notes = [
            f"Judge mode used Gemini ({self.model}) with your API key. Your prompt and output "
            "were sent to Google to score factual accuracy and quality — for this evaluation they "
            "did not stay on your device.",
        ]
        if any(p.is_proxy for p in report.parameters):
            notes.append("Parameters marked 'proxy' are still local statistical stand-ins, not the judged quality.")
        if report.task.task_type.value == "code_generation":
            notes.append("Code is analyzed statically, never executed; parsing cleanly does not mean it runs correctly.")
        return notes
