"""Improvement-prompt generation — the flagship.

Contract (RESEARCH.md Part 4, enforced by tests):
(a) the diagnosis names the specific failure with the evidence that triggered it,
(b) prompt_text is a complete, ready-to-paste replacement prompt,
(c) the fix uses the named model family's documented mechanism.
"Be more specific" is a bug, not a template.

Builders receive the user's original instruction and rebuild it with the
repair applied, so the user pastes one block, not advice.
"""

from __future__ import annotations

from ..schemas import (Evidence, FailureMode, ImprovementPrompt, ModelFamily,
                       ParameterScore, TaskClassification, TaskType)
from ..textutils import snippet
from .model_profiles import Profile, get_profile

_SEVERITY = [
    FailureMode.UNFAITHFUL_CONTENT,
    FailureMode.INVALID_CODE,
    FailureMode.INVENTED_FIELDS,
    FailureMode.MISSED_CONSTRAINT,
    FailureMode.FORMAT_VIOLATION,
    FailureMode.INCOMPLETE_COVERAGE,
    FailureMode.HALLUCINATION_RISK,
    FailureMode.OFF_TOPIC_DRIFT,
    FailureMode.WEAK_REASONING,
    FailureMode.VERBOSITY,
    FailureMode.WRONG_REGISTER,
    FailureMode.POOR_STRUCTURE,
    FailureMode.LOW_DIVERSITY,
]

MAX_PROMPTS = 5


def _quotes(findings, limit=3) -> list[str]:
    out = []
    for f in findings:
        for e in f.evidence:
            if e.source == "output" and e.quote:
                out.append(e.quote)
                break
        if len(out) >= limit:
            break
    return out


def _source_block(profile: Profile, task: TaskClassification) -> str:
    if not task.has_source_text:
        return ""
    return profile.wrap_source() + "\n\n"


def _rules_block(profile: Profile, rules: list[str]) -> str:
    """Render hard rules in the family's preferred structure."""
    if profile.family == ModelFamily.CLAUDE:
        inner = "\n".join(f"- {r}" for r in rules)
        return f"<rules>\n{inner}\n</rules>"
    if profile.family == ModelFamily.GPT:
        inner = "\n".join(f"{i+1}. {r}" for i, r in enumerate(rules))
        return f"### Requirements\n{inner}"
    inner = "\n".join(f"- {r}" for r in rules)
    return f"Rules:\n{inner}"


def _tail_emphasis(profile: Profile, critical: str) -> str:
    """GPT/open-weights/generic get the critical constraint repeated last
    (lost-in-the-middle, RESEARCH.md 2.7). Claude/Gemini get their own levers
    elsewhere, so no noisy repetition."""
    if profile.family in (ModelFamily.OPEN_WEIGHTS, ModelFamily.GPT, ModelFamily.GENERIC):
        return f"\n\nIMPORTANT — before finishing, verify: {critical}"
    return ""


# --------------------------------------------------------------- builders

def _build_unfaithful(findings, task, profile: Profile) -> ImprovementPrompt:
    bad = _quotes(findings)
    bad_list = "\n".join(f'- "{q}"' for q in bad) if bad else "- (see report)"
    grounding_rules = [
        "Use ONLY information stated in the source text. If the source does not say it, do not write it.",
        "If something the task needs is missing from the source, write \"the source does not specify\" rather than filling the gap.",
    ]
    if profile.family == ModelFamily.CLAUDE:
        pre = ("First, copy the exact sentences from the source that support your answer into <quotes> tags. "
               "Then write the final answer in <answer> tags using only what you quoted.\n\n")
    elif profile.family == ModelFamily.GEMINI:
        pre = "Base every sentence of your answer on the text above. Quote or closely paraphrase the source.\n\n"
    else:
        pre = "Answer using only the provided text. Quote the source where possible.\n\n"
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"{pre}"
        f"{_rules_block(profile, grounding_rules)}\n\n"
        f"A previous attempt invented content the source does not support, including:\n{bad_list}\n"
        f"Do not repeat these claims unless the source states them."
        f"{_tail_emphasis(profile, 'every claim traces to a sentence in the source text')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.UNFAITHFUL_CONTENT,
        title="Pin the output to the source",
        diagnosis=(f"The output makes claims the source text does not support"
                   + (f', e.g. "{bad[0]}"' if bad else "") + ". "
                   f"Repair: {profile.grounding_mechanism}"),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_constraints(findings, task, profile: Profile) -> ImprovementPrompt:
    missed = []
    for f in findings:
        kind = f.data.get("kind", "")
        actual = f.data.get("actual", "")
        missed.append((f.detail, kind, actual))
    rules = []
    for f in findings:
        prompt_ev = next((e.quote for e in f.evidence if e.source == "prompt"), None)
        rules.append(f.detail.split(" — ")[0].removeprefix("Prompt asked for ").strip().capitalize()
                     + (f" (your prompt said: \"{prompt_ev}\")" if prompt_ev else ""))
    if profile.family == ModelFamily.GEMINI:
        example = ("\n\nHere is an example of a response with the right shape (replace the content, keep the form):\n"
                   "[write one short example that satisfies every rule above]")
    else:
        example = ""
    critical = rules[0] if rules else "all stated constraints are met"
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}"
        f"{example}"
        f"\n\nAfter drafting, count and check each requirement above before giving your final answer."
        f"{_tail_emphasis(profile, critical)}"
    )
    first = findings[0]
    return ImprovementPrompt(
        failure_mode=first.failure_mode,
        title="Make the constraints unmissable",
        diagnosis=(f"The output missed {len(findings)} verifiable constraint(s): "
                   + "; ".join(f.detail for f in findings[:3]) + " "
                   f"Repair: {profile.format_mechanism}"),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_coverage(findings, task, profile: Profile) -> ImprovementPrompt | None:
    parts = []
    for f in findings:
        q = next((e.quote for e in f.evidence if e.source == "prompt"), None)
        if q:
            parts.append(q)
    if not parts:
        return None   # nothing quotable to enumerate; no honest repair possible
    part_list = "\n".join(f"{i+1}. {p}" for i, p in enumerate(parts))
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"Answer every numbered part separately, under its own heading:\n{part_list}\n\n"
        f"If you cannot answer a part, say so under that heading rather than skipping it."
        f"{_tail_emphasis(profile, f'all {len(parts)} parts have their own answer')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.INCOMPLETE_COVERAGE,
        title="Force full coverage of the question",
        diagnosis=(f"{len(parts)} part(s) of the request went unanswered, e.g. \"{parts[0] if parts else ''}\". "
                   "Repair: enumerate the parts and demand one answer per part — models skip sub-questions "
                   "buried in prose but not numbered lists."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_hallucination(findings, task, profile: Profile) -> ImprovementPrompt:
    flagged = _quotes(findings)
    fl = "\n".join(f'- "{q}"' for q in flagged) if flagged else ""
    rules = [
        "For every statistic, name its source inline, or present it as an estimate in words (\"roughly\", \"on the order of\").",
        "Do not cite papers, cases, or URLs unless you are certain they exist; prefer \"research on X suggests\" with no fake citation.",
        "Mark claims you are unsure about explicitly (\"I may be wrong about the exact figure\").",
    ]
    body = (
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}\n\n"
        + (f"A previous attempt stated the following as fact; each is unverifiable as written:\n{fl}\n"
           f"Restate these with sources or with honest uncertainty, or drop them.\n" if fl else "")
        + "\nEnd your answer with a one-line note: which claims above should I double-check independently?"
        f"{_tail_emphasis(profile, 'no statistic or citation appears without a named source or an uncertainty marker')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.HALLUCINATION_RISK,
        title="Demand attribution or honest uncertainty",
        diagnosis=(f"The output states unverifiable specifics as fact"
                   + (f', e.g. "{flagged[0]}"' if flagged else "") + ". "
                   "No local check can verify these; the repair makes the model attribute or hedge them, "
                   "and hands you a verification checklist."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_reasoning(findings, task, profile: Profile) -> ImprovementPrompt:
    if profile.family == ModelFamily.CLAUDE:
        think = ("Work through the problem step by step inside <thinking> tags first. "
                 "Then give the final answer in <answer> tags.")
    else:
        think = ("Solve this step by step. Show each step of your working on its own line, "
                 "then state the final answer on a last line beginning \"Answer:\".")
    body = (
        f"{task.instruction.strip()}\n\n"
        f"{think}\n\n"
        f"After stating the answer, re-derive it a second way if possible and confirm both routes agree; "
        f"if they disagree, say which one you trust and why."
        f"{_tail_emphasis(profile, 'working shown, final answer explicitly labeled')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.WEAK_REASONING,
        title="Make the model show its working",
        diagnosis=("The output gives a conclusion without checkable working. "
                   "Repair: request the reasoning *before* the answer (chain-of-thought), plus a second "
                   "independent derivation — the manual form of self-consistency."),
        prompt_text=body,
        model_family=profile.family,
        technique_source="Wei et al. 2022 (CoT); Wang et al. 2023 (self-consistency); " + profile.source,
    )


def _build_verbosity(findings, task, profile: Profile) -> ImprovementPrompt:
    fillers = _quotes(findings)
    limit_hint = next((f.data.get("ratio") for f in findings if "ratio" in f.data), None)
    rules = [
        "Open with the answer itself — no preamble, no restating the question.",
        "Cut framing phrases (e.g. " + ", ".join(f'"{f}"' for f in fillers[:3]) + ")." if fillers
        else "Cut framing phrases and meta-commentary.",
        "One idea per sentence; delete any sentence that repeats an earlier one.",
    ]
    if profile.family == ModelFamily.CLAUDE:
        opener = "\nBegin your response directly with the substance (no introduction)."
    else:
        opener = ""
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}{opener}"
        f"{_tail_emphasis(profile, 'the response starts with substance and contains no filler phrases')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.VERBOSITY,
        title="Strip the padding",
        diagnosis=("The output pads its length" + (f" ({limit_hint}x the asked-for size)" if limit_hint else "")
                   + (f' with filler like "{fillers[0]}"' if fillers else "") + ". "
                   "Repair: answer-first structure plus an explicit ban on the exact filler found."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_register(findings, task, profile: Profile) -> ImprovementPrompt:
    data = findings[0].data
    fk, band = data.get("fk_grade"), data.get("band", [6, 14])
    audience = data.get("audience", "the intended audience")
    too_hard = fk is not None and fk > band[1]
    style = ("short sentences, everyday words, one idea at a time"
             if too_hard else "precise terminology and compact, information-dense prose")
    role = f"You are writing for {audience}."
    body = (
        f"{role}\n\n"
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"Write in a register that fits that audience: {style}. "
        f"Read your draft as that reader before finalizing; rewrite any sentence they would stumble on."
        f"{_tail_emphasis(profile, f'the text reads naturally for {audience}')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.WRONG_REGISTER,
        title="Match the audience's reading level",
        diagnosis=(f"The output reads at US grade level {fk}, outside the {band[0]:g}-{band[1]:g} band for {audience} — "
                   f"{'harder' if too_hard else 'simpler'} than it should. "
                   "Repair: an explicit audience role. Role prompting reliably shifts register (it does not fix facts)."),
        prompt_text=body,
        model_family=profile.family,
        technique_source="role prompting for register (RESEARCH.md 2.8); " + profile.source,
    )


def _build_structure(findings, task, profile: Profile) -> ImprovementPrompt:
    repeats = any("repeat" in f.detail.lower() or "duplicate" in f.detail.lower() for f in findings)
    rules = [
        "Before writing, produce a 3-6 point outline; then write one section per point.",
        "Each section must add new information — no restating earlier sections." if repeats
        else "Order sections so each follows from the previous one.",
    ]
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}"
        f"{_tail_emphasis(profile, 'sections follow the outline and none repeats another')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.POOR_STRUCTURE,
        title="Impose an outline",
        diagnosis=("Adjacent sections " + ("repeat each other" if repeats else "jump between topics without connection")
                   + " (flagged by flow analysis). Repair: outline-first generation pins the structure before prose exists."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_drift(findings, task, profile: Profile) -> ImprovementPrompt:
    drifting = _quotes(findings, 1)
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"Stay strictly on this request. Do not add background, related topics, or general advice unless asked."
        + (f"\n\nA previous attempt drifted into: \"{drifting[0]}\" — leave this out unless the request explicitly needs it."
           if drifting else "")
        + f"{_tail_emphasis(profile, 'every paragraph directly serves the request')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.OFF_TOPIC_DRIFT,
        title="Fence the scope",
        diagnosis=(f"Part of the output drifts off the request"
                   + (f' ("{drifting[0]}")' if drifting else "") +
                   ". Repair: an explicit scope fence naming the drift to exclude."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_code(findings, task, profile: Profile) -> ImprovementPrompt:
    problems = [f.detail for f in findings]
    plist = "\n".join(f"- {p}" for p in problems[:4])
    rules = [
        "Return complete, runnable code — no TODOs, placeholders, or elided sections.",
        "If the code needs assumptions (versions, inputs), state them in a comment at the top.",
        "After the code, list 2-3 quick test cases I can run to verify it.",
    ]
    body = (
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}\n\n"
        f"A previous attempt had these problems — fix each:\n{plist}"
        f"{_tail_emphasis(profile, 'the code parses, is complete, and includes the requested names')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.INVALID_CODE,
        title="Demand complete, verifiable code",
        diagnosis=("Static analysis found concrete defects: " + "; ".join(problems[:2]) + " "
                   "Repair: completeness rules plus self-supplied test cases give you an immediate way to check the redo."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_invented(findings, task, profile: Profile) -> ImprovementPrompt:
    invented = _quotes(findings)
    il = "\n".join(f'- "{q}"' for q in invented) if invented else ""
    rules = [
        "Copy every extracted value verbatim from the source text — no paraphrasing, no normalizing.",
        "If a requested field is not in the text, output null for it. Never fill gaps from general knowledge.",
    ]
    body = (
        f"{_source_block(profile, task)}"
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}\n\n"
        + (f"A previous attempt output values that are not in the source:\n{il}\n" if il else "")
        + f"{_tail_emphasis(profile, 'every value string-matches the source text or is null')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.INVENTED_FIELDS,
        title="Verbatim-only extraction",
        diagnosis=("Extracted values don't appear in the source text"
                   + (f', e.g. "{invented[0]}"' if invented else "") +
                   ". Repair: verbatim-copy rule plus explicit null for missing fields — the two rules that stop "
                   "extraction models from 'helpfully' completing data."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


def _build_diversity(findings, task, profile: Profile) -> ImprovementPrompt:
    cliches = _quotes(findings)
    cl = ", ".join(f'"{c}"' for c in cliches[:5])
    rules = [
        (f"Banned phrases: {cl}. Find a fresh image instead." if cliches else
         "Avoid stock phrases; when a familiar expression appears in your draft, replace it with a concrete image."),
        "Vary sentence length deliberately: mix sentences under 8 words with longer ones.",
        "Prefer specific, sensory detail over abstract description.",
    ]
    body = (
        f"{task.instruction.strip()}\n\n"
        f"{_rules_block(profile, rules)}"
        f"{_tail_emphasis(profile, 'no banned phrase appears and sentence lengths vary')}"
    )
    return ImprovementPrompt(
        failure_mode=FailureMode.LOW_DIVERSITY,
        title="Ban the clichés it reached for",
        diagnosis=("Style statistics flagged " + (f"stock phrases ({cl})" if cliches else "flat, repetitive prose") +
                   ". Repair: ban the exact phrases found and constrain rhythm — negative examples work when they are this specific."),
        prompt_text=body,
        model_family=profile.family,
        technique_source=profile.source,
    )


_BUILDERS = {
    FailureMode.UNFAITHFUL_CONTENT: _build_unfaithful,
    FailureMode.MISSED_CONSTRAINT: _build_constraints,
    FailureMode.FORMAT_VIOLATION: _build_constraints,
    FailureMode.INCOMPLETE_COVERAGE: _build_coverage,
    FailureMode.HALLUCINATION_RISK: _build_hallucination,
    FailureMode.WEAK_REASONING: _build_reasoning,
    FailureMode.VERBOSITY: _build_verbosity,
    FailureMode.WRONG_REGISTER: _build_register,
    FailureMode.POOR_STRUCTURE: _build_structure,
    FailureMode.OFF_TOPIC_DRIFT: _build_drift,
    FailureMode.INVALID_CODE: _build_code,
    FailureMode.INVENTED_FIELDS: _build_invented,
    FailureMode.LOW_DIVERSITY: _build_diversity,
}


def generate_improvement_prompts(
    model_name: str,
    task: TaskClassification,
    parameters: list[ParameterScore],
) -> list[ImprovementPrompt]:
    profile = get_profile(model_name)

    by_mode: dict[FailureMode, list] = {}
    for ps in parameters:
        for f in ps.findings:
            by_mode.setdefault(f.failure_mode, []).append(f)
    # constraint + format failures repair through the same rebuilt prompt
    if FailureMode.FORMAT_VIOLATION in by_mode and FailureMode.MISSED_CONSTRAINT in by_mode:
        by_mode[FailureMode.MISSED_CONSTRAINT].extend(by_mode.pop(FailureMode.FORMAT_VIOLATION))

    prompts: list[ImprovementPrompt] = []
    for mode in _SEVERITY:
        if mode in by_mode and mode in _BUILDERS:
            built = _BUILDERS[mode](by_mode[mode], task, profile)
            if built is not None:
                prompts.append(built)
        if len(prompts) >= MAX_PROMPTS:
            break
    return prompts
