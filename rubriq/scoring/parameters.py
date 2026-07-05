"""Parameter evaluators: metric results -> ParameterScore with verdicts,
strengths, findings, and evidence quotes. Each evaluator names its rubric
source (RESEARCH.md entry). Scores are 0-100; None means "could not judge",
with the reason stated — never a silently invented number.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .. import constraints as con
from ..metrics import (code_static, faithfulness, hallucination_risk, lexical,
                       readability, relevance, structure)
from ..schemas import (Evidence, FailureMode, Finding, ParameterScore,
                       TaskClassification, TaskType)
from ..textutils import snippet, split_sentences, word_count, words


@dataclass
class EvalContext:
    """Shared inputs + lazily cached metric results for one evaluation."""
    prompt: str
    output: str
    task: TaskClassification
    audience: str = ""
    _cache: dict = field(default_factory=dict)

    @property
    def instruction(self) -> str:
        return self.task.instruction or self.prompt

    @property
    def source(self) -> str | None:
        return self.task.source_text

    def get(self, key: str, fn):
        if key not in self._cache:
            self._cache[key] = fn()
        return self._cache[key]


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, round(x, 1)))


def _band(x: float, floor: float, ceil: float) -> float:
    """Linear map [floor..ceil] -> [0..100]."""
    if ceil <= floor:
        return 50.0
    return _clamp(100 * (x - floor) / (ceil - floor))


# ------------------------------------------------------------ evaluators

def instruction_following(ctx: EvalContext) -> ParameterScore:
    results = ctx.get("constraints", lambda: con.run_checks(ctx.instruction, ctx.output))
    src = "IFEval (Zhou et al. 2023)"
    if not results:
        return ParameterScore(
            parameter="instruction_following", display_name="Instruction following",
            score=None, verdict="No verifiable constraints (length, format, required content) detected in the prompt.",
            skipped_reason="nothing checkable was asked", rubric_source=src)
    passed = [r for r in results if r.passed]
    findings = con.to_findings(results)
    strengths = [f"Met: {r.constraint.description} ({r.detail})" for r in passed]
    score = _clamp(100 * len(passed) / len(results))
    verdict = (f"Met {len(passed)} of {len(results)} verifiable constraints extracted from the prompt."
               if findings else f"All {len(results)} verifiable constraints met.")
    return ParameterScore(
        parameter="instruction_following", display_name="Instruction following",
        score=score, verdict=verdict, strengths=strengths, findings=findings,
        rubric_source=src)


def faithfulness_param(ctx: EvalContext) -> ParameterScore:
    src = "SummaC (Laban et al. 2022) / RAGAS (Es et al. 2024)"
    if not ctx.source:
        return ParameterScore(
            parameter="faithfulness", display_name="Faithfulness to source",
            score=None, verdict="No source text found in the prompt to check against.",
            skipped_reason="no source text", rubric_source=src)
    result = ctx.get("faithfulness", lambda: faithfulness.compute(ctx.source, ctx.output))
    if result is None:
        return ParameterScore(
            parameter="faithfulness", display_name="Faithfulness to source",
            score=None, verdict="NLI model unavailable on this machine.",
            skipped_reason="nli model not loaded", rubric_source=src)
    findings: list[Finding] = []
    for s in result.unsupported:
        findings.append(Finding(
            failure_mode=FailureMode.UNFAITHFUL_CONTENT,
            detail=f"This claim has no support in the source (entailment {s.entailment:.2f}).",
            evidence=[Evidence(quote=snippet(s.sentence)),
                      Evidence(quote=s.best_chunk, source="prompt", note="closest source passage")],
            data={"entailment": s.entailment}))
    for s in result.contradicted:
        if all(s.sentence != f.evidence[0].quote for f in findings if f.evidence):
            findings.append(Finding(
                failure_mode=FailureMode.UNFAITHFUL_CONTENT,
                detail=f"The source appears to contradict this claim (contradiction {s.contradiction:.2f}).",
                evidence=[Evidence(quote=snippet(s.sentence))],
                data={"contradiction": s.contradiction}))
    n = len(result.sentences)
    supported = n - len(result.unsupported)
    strengths = [f"{supported} of {n} output claims are entailed by the source."] if supported else []
    return ParameterScore(
        parameter="faithfulness", display_name="Faithfulness to source",
        score=_clamp(result.mean_entailment * 100),
        verdict=(f"{supported}/{n} claims supported by the source; "
                 f"{len(result.unsupported)} unsupported" +
                 (f", {len(result.contradicted)} possibly contradicted." if result.contradicted else ".")),
        strengths=strengths, findings=findings, rubric_source=src)


def answer_relevance(ctx: EvalContext) -> ParameterScore:
    src = "RAGAS answer relevancy (Es et al. 2024) / TruLens RAG triad"
    result = ctx.get("relevance", lambda: relevance.compute(ctx.instruction, ctx.output))
    if result is None:
        return ParameterScore(
            parameter="answer_relevance", display_name="Relevance to the request",
            score=None, verdict="Embedding model unavailable on this machine.",
            skipped_reason="embedding model not loaded", rubric_source=src)
    findings: list[Finding] = []
    if result.worst_paragraph is not None and result.worst_paragraph_sim is not None \
            and result.worst_paragraph_sim < 0.45 and result.overall >= 0.45:
        findings.append(Finding(
            failure_mode=FailureMode.OFF_TOPIC_DRIFT,
            detail=f"One section drifts from the request (similarity {result.worst_paragraph_sim:.2f} vs {result.overall:.2f} overall).",
            evidence=[Evidence(quote=result.worst_paragraph)],
            data={"paragraph_sim": result.worst_paragraph_sim}))
    if result.overall < 0.45:
        findings.append(Finding(
            failure_mode=FailureMode.OFF_TOPIC_DRIFT,
            detail=f"The output as a whole tracks the request weakly (semantic similarity {result.overall:.2f}).",
            evidence=[Evidence(quote=snippet(ctx.instruction), source="prompt", note="the request")],
            data={"overall_sim": result.overall}))
    score = _band(result.overall, 0.35, 0.80)
    strengths = ["Output stays on the topic of the request."] if not findings else []
    return ParameterScore(
        parameter="answer_relevance", display_name="Relevance to the request",
        score=score,
        verdict=f"Semantic similarity between request and output: {result.overall:.2f}.",
        strengths=strengths, findings=findings, rubric_source=src)


def coherence_proxy(ctx: EvalContext) -> ParameterScore:
    src = "Coh-Metrix tradition (Graesser et al. 2004), embedding adaptation"
    result = ctx.get("coherence", lambda: structure.coherence_proxy(ctx.output))
    if result is None:
        return ParameterScore(
            parameter="coherence", display_name="Coherence (proxy)",
            score=None, verdict="Output too short for flow analysis, or embedding model unavailable.",
            skipped_reason="too short or model unavailable", is_proxy=True, rubric_source=src)
    findings: list[Finding] = []
    for a, b, sim in result.flagged_low:
        findings.append(Finding(
            failure_mode=FailureMode.POOR_STRUCTURE,
            detail=f"Abrupt topic jump between adjacent sections (similarity {sim}).",
            evidence=[Evidence(quote=a, note="…followed by…"), Evidence(quote=b)]))
    for a, b, sim in result.flagged_high:
        findings.append(Finding(
            failure_mode=FailureMode.POOR_STRUCTURE,
            detail=f"Near-duplicate adjacent sections (similarity {sim}) — the output repeats itself.",
            evidence=[Evidence(quote=a), Evidence(quote=b)]))
    score = _clamp(100 - 18 * len(result.flagged_low) - 12 * len(result.flagged_high))
    return ParameterScore(
        parameter="coherence", display_name="Coherence (proxy)",
        score=score,
        verdict=("Flow between sections reads consistent." if not findings
                 else f"{len(findings)} flow problems between adjacent sections."),
        strengths=["No abrupt jumps or repeated sections detected."] if not findings else [],
        findings=findings, is_proxy=True, rubric_source=src)


def conciseness(ctx: EvalContext) -> ParameterScore:
    src = "MT-Bench verbosity-bias finding (Zheng et al. 2023), inverted"
    checks = ctx.get("constraints", lambda: con.run_checks(ctx.instruction, ctx.output))
    expected = None
    for r in checks:
        p = r.constraint.params
        if p.get("unit") == "word" and p.get("bound") in ("max", "approx", "exact"):
            expected = p["n"]
    result = structure.conciseness(ctx.instruction, ctx.output, expected)
    findings: list[Finding] = []
    if result.filler_hits:
        findings.append(Finding(
            failure_mode=FailureMode.VERBOSITY,
            detail=f"Filler phrasing adds words without content: {', '.join(repr(h) for h in result.filler_hits[:4])}.",
            evidence=[Evidence(quote=h) for h in result.filler_hits[:3]]))
    if result.ratio is not None and result.ratio > 1.3:
        findings.append(Finding(
            failure_mode=FailureMode.VERBOSITY,
            detail=f"Output is {result.output_words} words against an expected ~{result.expected_max} ({result.ratio}x).",
            data={"ratio": result.ratio}))
    score = _clamp(100 - 8 * len(result.filler_hits) - (25 if result.ratio and result.ratio > 1.3 else 0))
    return ParameterScore(
        parameter="conciseness", display_name="Conciseness",
        score=score,
        verdict=(f"{result.output_words} words, no filler detected." if not findings
                 else f"{result.output_words} words with padding present."),
        strengths=["No filler phrases; length fits the ask."] if not findings else [],
        findings=findings, rubric_source=src)


def readability_audience(ctx: EvalContext) -> ParameterScore:
    src = "Flesch (1948) / Kincaid et al. (1975)"
    stats = readability.compute(ctx.output)
    if stats is None:
        return ParameterScore(
            parameter="readability", display_name="Readability vs. audience",
            score=None, verdict="Output too short for readability statistics.",
            skipped_reason="too short", rubric_source=src)
    (lo, hi), label = readability.audience_band(ctx.audience, ctx.instruction)
    fk = stats.fk_grade
    findings: list[Finding] = []
    if fk < lo or fk > hi:
        direction = "harder" if fk > hi else "simpler"
        findings.append(Finding(
            failure_mode=FailureMode.WRONG_REGISTER,
            detail=(f"Reads at US grade level {fk}, outside the {lo:g}-{hi:g} band for {label} — "
                    f"{direction} than the audience needs."),
            data={"fk_grade": fk, "band": [lo, hi], "audience": label}))
        dist = (lo - fk) if fk < lo else (fk - hi)
        score = _clamp(100 - 12 * dist)
    else:
        score = 100.0
    return ParameterScore(
        parameter="readability", display_name="Readability vs. audience",
        score=score,
        verdict=f"Grade level {fk} (Flesch ease {stats.flesch_reading_ease}); target band {lo:g}-{hi:g} for {label}.",
        strengths=[f"Reading level fits {label}."] if not findings else [],
        findings=findings, rubric_source=src)


def hallucination_signals(ctx: EvalContext) -> ParameterScore:
    src = "FActScore precondition (Min et al. 2023); fabricated-citation literature"
    result = hallucination_risk.compute(ctx.output, word_count(ctx.output))
    findings: list[Finding] = []
    for s in result.signals:
        findings.append(Finding(
            failure_mode=FailureMode.HALLUCINATION_RISK,
            detail=f"{s.why} (signal: {s.kind}).",
            evidence=[Evidence(quote=s.quote)],
            data={"kind": s.kind}))
    score = _clamp(100 - 14 * len(result.signals))
    verdict = ("No fabrication-prone patterns detected. This does NOT verify the facts — see honesty notes."
               if not findings else
               f"{len(result.signals)} unverifiable-claim signals found. These are risk flags, not verdicts of falsehood.")
    return ParameterScore(
        parameter="hallucination_risk", display_name="Hallucination risk signals",
        score=score, verdict=verdict,
        strengths=["Output avoids unattributed statistics, invented-looking citations, and vague authority claims."] if not findings else [],
        findings=findings, rubric_source=src)


def factual_accuracy_placeholder(ctx: EvalContext) -> ParameterScore:
    """The carve-out, rendered as a first-class parameter so the UI shows
    what local scoring cannot do and what judge mode adds."""
    return ParameterScore(
        parameter="factual_accuracy", display_name="Factual accuracy",
        score=None,
        verdict="Verifying claims against world knowledge requires a judge model with external knowledge. "
                "Local mode reports risk signals instead (see Hallucination risk).",
        skipped_reason="requires LLM-judge mode", requires_judge=True,
        rubric_source="FActScore (Min et al. 2023)")


def creative_proxies(ctx: EvalContext) -> ParameterScore:
    src = "MTLD (McCarthy & Jarvis 2010); cliché/rhythm proxies"
    stats = lexical.compute(ctx.output)
    findings: list[Finding] = []
    score = 100.0
    if stats.cliche_hits:
        findings.append(Finding(
            failure_mode=FailureMode.LOW_DIVERSITY,
            detail=f"Stock phrases weaken the writing: {', '.join(repr(c) for c in stats.cliche_hits[:5])}.",
            evidence=[Evidence(quote=c) for c in stats.cliche_hits[:3]]))
        score -= 10 * min(5, len(stats.cliche_hits))
    if stats.mtld is not None and stats.mtld < 50:
        findings.append(Finding(
            failure_mode=FailureMode.LOW_DIVERSITY,
            detail=f"Low lexical diversity (MTLD {stats.mtld}; fluent varied prose typically sits above ~70).",
            data={"mtld": stats.mtld}))
        score -= 20
    if stats.sentence_len_cv is not None and stats.sentence_len_cv < 0.25:
        findings.append(Finding(
            failure_mode=FailureMode.LOW_DIVERSITY,
            detail=f"Flat sentence rhythm (length variation {stats.sentence_len_cv}) — sentences are all the same size.",
            data={"cv": stats.sentence_len_cv}))
        score -= 15
    if stats.repeated_ngrams:
        findings.append(Finding(
            failure_mode=FailureMode.LOW_DIVERSITY,
            detail="Repeated phrasing: " + "; ".join(f'"{g}"' for g in stats.repeated_ngrams[:3]),
            evidence=[Evidence(quote=g) for g in stats.repeated_ngrams[:3]]))
        score -= 10
    strengths = []
    if stats.mtld and stats.mtld >= 70:
        strengths.append(f"Strong lexical variety (MTLD {stats.mtld}).")
    if stats.sentence_len_cv and stats.sentence_len_cv >= 0.4:
        strengths.append("Varied sentence rhythm.")
    if not stats.cliche_hits:
        strengths.append("No stock phrases detected.")
    return ParameterScore(
        parameter="creative_proxies", display_name="Style proxies (diversity, clichés, rhythm)",
        score=_clamp(score),
        verdict="Statistical style proxies only — creativity itself needs a human or judge model.",
        strengths=strengths, findings=findings, is_proxy=True, rubric_source=src)


def code_validity(ctx: EvalContext) -> ParameterScore:
    src = "static ladder; execution reserved per HumanEval (Chen et al. 2021)"
    result = ctx.get("code", lambda: code_static.compute(ctx.instruction, ctx.output))
    findings: list[Finding] = []
    if result.prose_only:
        findings.append(Finding(
            failure_mode=FailureMode.INVALID_CODE,
            detail="The prompt asks for code but the output contains none.",
            evidence=[Evidence(quote=snippet(ctx.instruction), source="prompt")]))
        return ParameterScore(
            parameter="code_validity", display_name="Code validity (static)",
            score=0.0, verdict="No code found in the output.", findings=findings, rubric_source=src)
    score = 100.0
    for b in result.blocks:
        if b.parses is False:
            findings.append(Finding(
                failure_mode=FailureMode.INVALID_CODE,
                detail=f"{b.language} block does not parse: {b.parse_error}.",
                evidence=[Evidence(quote=snippet(b.code, 200))]))
            score -= 40
    for name in result.requested_names_missing:
        # INVALID_CODE (not INCOMPLETE_COVERAGE) so the repair routes to the
        # code builder; the coverage builder expects question parts.
        findings.append(Finding(
            failure_mode=FailureMode.INVALID_CODE,
            detail=f'The prompt asks for "{name}" but it never appears in the code.',
            data={"missing_name": name}))
        score -= 20
    if result.placeholders:
        findings.append(Finding(
            failure_mode=FailureMode.INVALID_CODE,
            detail="Placeholder stubs left in the code: " + "; ".join(result.placeholders[:3]),
            evidence=[Evidence(quote=p) for p in result.placeholders[:3]]))
        score -= 15
    n_ok = sum(1 for b in result.blocks if b.parses)
    strengths = []
    if n_ok:
        strengths.append(f"{n_ok} code block(s) parse cleanly.")
    if not result.placeholders:
        strengths.append("No TODO/placeholder stubs.")
    return ParameterScore(
        parameter="code_validity", display_name="Code validity (static)",
        score=_clamp(score),
        verdict=("Code parses and covers the requested surface (static checks only — not executed)."
                 if not findings else "Static analysis found problems (code was not executed)."),
        strengths=strengths, findings=findings, rubric_source=src)


_STOPWORDS = frozenset(
    "the a an of to in on at for with and or is are was were did do does what who "
    "when where why how which whom whose it its they their this that these those "
    "there here be been has have had will would can could should you your".split())


def _distinctive_words(part: str, other_parts: list[str]) -> set[str]:
    """Content words unique to this question part (5-char prefixes so
    'funded' matches 'funding')."""
    shared = {w[:5] for other in other_parts for w in words(other)}
    return {w[:5] for w in words(part) if w not in _STOPWORDS and len(w) >= 4 and w[:5] not in shared}


def question_coverage(ctx: EvalContext) -> ParameterScore:
    """Multi-part questions: is every part addressed?

    PROXY, honestly bounded: bi-encoders measure topicality, not answerhood,
    so a part is only flagged when its topic is missing — low embedding
    similarity to every output sentence, or its distinctive keywords absent.
    A question that is mentioned but left unanswered can slip through;
    judge mode closes that gap.
    """
    src = "completeness adaptation of IFEval / RAGAS (topical proxy)"
    parts = [s for s in split_sentences(ctx.instruction) if s.strip().endswith("?")]
    if len(parts) < 2:
        return ParameterScore(
            parameter="question_coverage", display_name="Question coverage (proxy)",
            score=None, verdict="Single-part question; coverage check not applicable.",
            skipped_reason="not multi-part", is_proxy=True, rubric_source=src)

    from ..models import get_embedder
    embedder = get_embedder()
    if embedder is None:
        return ParameterScore(
            parameter="question_coverage", display_name="Question coverage (proxy)",
            score=None, verdict="Embedding model unavailable.",
            skipped_reason="embedding model not loaded", is_proxy=True, rubric_source=src)

    out_sents = split_sentences(ctx.output) or [ctx.output]
    qv = embedder.encode(parts, normalize_embeddings=True)
    ov = embedder.encode(out_sents, normalize_embeddings=True)
    low_out_prefixes = {w[:5] for w in words(ctx.output)}

    findings: list[Finding] = []
    hit = 0
    for i, part in enumerate(parts):
        best_sim = float(max(qv[i] @ v for v in ov))
        distinctive = _distinctive_words(part, parts[:i] + parts[i + 1:])
        keywords_present = (not distinctive) or any(d in low_out_prefixes for d in distinctive)
        if best_sim < 0.45 or (best_sim < 0.68 and not keywords_present):
            findings.append(Finding(
                failure_mode=FailureMode.INCOMPLETE_COVERAGE,
                detail=(f"This part of the question appears unaddressed — its key terms never appear in the "
                        f"output (best sentence similarity {best_sim:.2f})."),
                evidence=[Evidence(quote=part, source="prompt")],
                data={"similarity": round(best_sim, 3)}))
        else:
            hit += 1
    return ParameterScore(
        parameter="question_coverage", display_name="Question coverage (proxy)",
        score=_clamp(100 * hit / len(parts)),
        verdict=(f"{hit} of {len(parts)} question parts topically addressed. "
                 "Topical check only — a part mentioned but not truly answered can pass."),
        strengths=[f"All {len(parts)} question parts are addressed in the output."] if not findings else [],
        findings=findings, is_proxy=True, rubric_source=src)


def meaning_preservation(ctx: EvalContext) -> ParameterScore:
    src = "embedding similarity (RAGAS-style), rewriting adaptation"
    if not ctx.source:
        return ParameterScore(
            parameter="meaning_preservation", display_name="Meaning preservation",
            score=None, verdict="Original text not found in the prompt.",
            skipped_reason="no source text", rubric_source=src)
    from ..metrics.relevance import similarity
    sim = similarity(ctx.source, ctx.output)
    if sim is None:
        return ParameterScore(
            parameter="meaning_preservation", display_name="Meaning preservation",
            score=None, verdict="Embedding model unavailable.",
            skipped_reason="embedding model not loaded", rubric_source=src)
    findings: list[Finding] = []
    if sim < 0.6:
        findings.append(Finding(
            failure_mode=FailureMode.UNFAITHFUL_CONTENT,
            detail=f"The rewrite drifts from the original's meaning (similarity {sim:.2f}).",
            data={"similarity": sim}))
    return ParameterScore(
        parameter="meaning_preservation", display_name="Meaning preservation",
        score=_band(sim, 0.45, 0.9),
        verdict=f"Semantic similarity to the original: {sim:.2f}.",
        strengths=[f"Rewrite preserves the original's meaning (similarity {sim:.2f})."] if not findings else [],
        findings=findings, rubric_source=src)


def extraction_grounding(ctx: EvalContext) -> ParameterScore:
    """No-invention check: extracted values must appear in the source."""
    src = "no-invention adaptation of faithfulness (RESEARCH.md 1.2/1.9)"
    if not ctx.source:
        return ParameterScore(
            parameter="extraction_grounding", display_name="Extracted values appear in source",
            score=None, verdict="No source text found to validate extractions against.",
            skipped_reason="no source text", rubric_source=src)
    import json
    import re as _re
    values: list[str] = []
    try:
        fence = _re.search(r"```(?:json)?\s*(.+?)```", ctx.output, flags=_re.S)
        data = json.loads((fence.group(1) if fence else ctx.output).strip())

        def walk(node):
            if isinstance(node, dict):
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)
            elif isinstance(node, str) and 2 <= len(node) <= 80:
                values.append(node)
        walk(data)
    except (json.JSONDecodeError, AttributeError):
        values = [_re.sub(r"^[-*\d.)\s]+", "", ln).strip()
                  for ln in ctx.output.splitlines() if ln.strip()]
        values = [v for v in values if 2 <= len(v) <= 80]
    if not values:
        return ParameterScore(
            parameter="extraction_grounding", display_name="Extracted values appear in source",
            score=None, verdict="Could not isolate extracted values in the output.",
            skipped_reason="no parseable values", rubric_source=src)
    low_src = ctx.source.lower()
    invented = [v for v in values if v.lower() not in low_src]
    findings = [Finding(
        failure_mode=FailureMode.INVENTED_FIELDS,
        detail="Extracted value does not appear in the source text.",
        evidence=[Evidence(quote=v)]) for v in invented[:5]]
    ok = len(values) - len(invented)
    return ParameterScore(
        parameter="extraction_grounding", display_name="Extracted values appear in source",
        score=_clamp(100 * ok / len(values)),
        verdict=f"{ok} of {len(values)} extracted values found verbatim in the source.",
        strengths=[f"All {len(values)} extracted values trace to the source."] if not invented else [],
        findings=findings, rubric_source=src)


def reasoning_structure(ctx: EvalContext) -> ParameterScore:
    src = "CoT structure (Wei et al. 2022); derivation-shape heuristics"
    out = ctx.output
    findings: list[Finding] = []
    has_steps = bool(__import__("re").search(
        r"(?im)^(?:step\s*\d|first|then|next|finally|\d+[.)])[,:\s]", out))
    sents = split_sentences(out)
    has_answer = bool(__import__("re").search(
        r"(?i)\b(?:therefore|so|thus|the answer is|equals?|=\s*\S|in total|final answer)\b", out))
    score = 100.0
    if not has_steps and len(sents) <= 2:
        findings.append(Finding(
            failure_mode=FailureMode.WEAK_REASONING,
            detail="The output gives a conclusion with no visible working — nothing to check the answer against.",
            evidence=[Evidence(quote=snippet(out, 200))]))
        score -= 45
    if not has_answer:
        findings.append(Finding(
            failure_mode=FailureMode.WEAK_REASONING,
            detail="No clearly stated final answer found.",
        ))
        score -= 30
    strengths = []
    if has_steps:
        strengths.append("Shows step-by-step working.")
    if has_answer:
        strengths.append("States a final answer explicitly.")
    return ParameterScore(
        parameter="reasoning_structure", display_name="Reasoning structure",
        score=_clamp(score),
        verdict=("Derivation shows its work and lands on an answer." if not findings
                 else "The derivation's shape has gaps (this checks structure, not mathematical truth)."),
        strengths=strengths, findings=findings, is_proxy=True, rubric_source=src)
