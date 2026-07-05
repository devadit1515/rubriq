"""Improvement-prompt generation — the flagship.

Contract (RESEARCH.md Part 4, enforced by tests): the generator produces ONE
unified repair prompt that addresses every diagnosed failure at once —
(a) the diagnosis names each failure with the evidence that triggered it,
(b) prompt_text is a complete, ready-to-paste replacement prompt,
(c) the repairs use the named model family's documented mechanisms.
"Be more specific" is a bug, not a template.

Each failure mode contributes pieces (a role line, hard rules, previous-
attempt problems, a pre-instruction) and the composer assembles them around
the user's original instruction.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..schemas import (FailureMode, ImprovementPrompt, ModelFamily,
                       ParameterScore, TaskClassification)
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

_MODE_NAMES = {
    FailureMode.UNFAITHFUL_CONTENT: "content the source does not support",
    FailureMode.INVALID_CODE: "defective code",
    FailureMode.INVENTED_FIELDS: "extracted values not present in the source",
    FailureMode.MISSED_CONSTRAINT: "missed constraints",
    FailureMode.FORMAT_VIOLATION: "format violations",
    FailureMode.INCOMPLETE_COVERAGE: "unanswered parts of the request",
    FailureMode.HALLUCINATION_RISK: "unverifiable claims stated as fact",
    FailureMode.OFF_TOPIC_DRIFT: "off-topic drift",
    FailureMode.WEAK_REASONING: "reasoning without checkable working",
    FailureMode.VERBOSITY: "padding",
    FailureMode.WRONG_REGISTER: "the wrong reading level for the audience",
    FailureMode.POOR_STRUCTURE: "structural problems",
    FailureMode.LOW_DIVERSITY: "flat, cliché-heavy style",
}

MAX_RULES = 9
MAX_PROBLEMS = 7


@dataclass
class _Parts:
    role: str = ""
    pre: str = ""                      # grounding / think-first instruction
    rules: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)   # "previous attempt" lines
    wants_example: bool = False        # gemini few-shot skeleton
    criticals: list[str] = field(default_factory=list)  # tail-emphasis candidates
    sources: list[str] = field(default_factory=list)


def _quotes(findings, limit=3, source="output") -> list[str]:
    out = []
    for f in findings:
        for e in f.evidence:
            if e.source == source and e.quote:
                out.append(e.quote)
                break
        if len(out) >= limit:
            break
    return out


# ------------------------------------------------------ per-mode contributions

def _contribute(mode: FailureMode, findings, task, profile: Profile, parts: _Parts) -> str | None:
    """Fold this mode's repair into parts. Returns a diagnosis fragment, or
    None when the mode has nothing usable to say."""
    fam = profile.family

    if mode == FailureMode.UNFAITHFUL_CONTENT:
        bad = _quotes(findings)
        if fam == ModelFamily.CLAUDE:
            parts.pre = ("First, copy the exact sentences from the source that support your answer into "
                         "<quotes> tags. Then write the final answer in <answer> tags using only what you quoted.")
        elif fam == ModelFamily.GEMINI:
            parts.pre = "Base every sentence of your answer on the source text above; quote or closely paraphrase it."
        else:
            parts.pre = "Answer using only the provided source text. Quote the source where possible."
        parts.rules.append("Use ONLY information stated in the source text. If the source does not say it, do not write it.")
        parts.rules.append('If something the task needs is missing from the source, write "the source does not specify" rather than filling the gap.')
        parts.problems += [f'invented content: "{q}"' for q in bad]
        parts.criticals.append("every claim traces to a sentence in the source text")
        parts.sources.append(profile.source)
        return "content the source does not support" + (f' (e.g. "{bad[0]}")' if bad else "")

    if mode == FailureMode.INVALID_CODE:
        parts.rules.append("Return complete, runnable code — no TODOs, placeholders, or elided sections.")
        parts.rules.append("After the code, list 2-3 quick test cases I can run to verify it.")
        parts.problems += [f.detail for f in findings[:3]]
        parts.criticals.append("the code parses, is complete, and includes every requested name")
        parts.sources.append(profile.source)
        return "concrete code defects (" + "; ".join(f.detail.rstrip(".") for f in findings[:2]) + ")"

    if mode == FailureMode.INVENTED_FIELDS:
        invented = _quotes(findings)
        parts.rules.append("Copy every extracted value verbatim from the source text — no paraphrasing, no normalizing.")
        parts.rules.append("If a requested field is not in the text, output null for it. Never fill gaps from general knowledge.")
        parts.problems += [f'value not in the source: "{q}"' for q in invented]
        parts.criticals.append("every value string-matches the source text or is null")
        parts.sources.append(profile.source)
        return "extracted values that are not in the source" + (f' (e.g. "{invented[0]}")' if invented else "")

    if mode in (FailureMode.MISSED_CONSTRAINT, FailureMode.FORMAT_VIOLATION):
        for f in findings:
            req = f.detail.split(" — ")[0].removeprefix("Prompt asked for ").strip().capitalize()
            parts.rules.append(req + ". Count and check this before giving your final answer.")
            parts.problems.append(f.detail)
            parts.criticals.insert(0, req.lower())
        parts.wants_example = fam == ModelFamily.GEMINI
        parts.sources.append(profile.source)
        return f"{len(findings)} verifiable constraint(s) missed"

    if mode == FailureMode.INCOMPLETE_COVERAGE:
        qparts = _quotes(findings, limit=6, source="prompt")
        if not qparts:
            return None
        numbered = " ".join(f"({i + 1}) {p}" for i, p in enumerate(qparts))
        parts.rules.append(f"Answer every part of the request separately, under its own heading: {numbered}. "
                           "If you cannot answer a part, say so under that heading rather than skipping it.")
        parts.problems += [f'left unanswered: "{p}"' for p in qparts[:3]]
        parts.criticals.append("every numbered part has its own answer")
        parts.sources.append(profile.source)
        return f"{len(qparts)} part(s) of the request left unanswered"

    if mode == FailureMode.HALLUCINATION_RISK:
        flagged = _quotes(findings)
        parts.rules.append("For every statistic or citation, name its real source inline, or state it as an "
                           'estimate in words ("roughly", "on the order of"). Never invent citations or URLs.')
        parts.rules.append('Mark claims you are unsure about explicitly, and end with a one-line note: '
                           "which claims should I double-check independently?")
        parts.problems += [f'stated as fact but unverifiable: "{q}"' for q in flagged]
        parts.criticals.append("no statistic or citation appears without a named source or an uncertainty marker")
        parts.sources.append(profile.source)
        return "unverifiable specifics stated as fact" + (f' (e.g. "{flagged[0]}")' if flagged else "")

    if mode == FailureMode.OFF_TOPIC_DRIFT:
        drifting = _quotes(findings, 1)
        parts.rules.append("Stay strictly on the request. No background, related topics, or general advice unless asked.")
        if drifting:
            parts.problems.append(f'drifted into: "{drifting[0]}"')
        parts.criticals.append("every paragraph directly serves the request")
        parts.sources.append(profile.source)
        return "off-topic drift"

    if mode == FailureMode.WEAK_REASONING:
        if not parts.pre:
            parts.pre = ("Work through the problem step by step inside <thinking> tags first, then give the final "
                         "answer in <answer> tags." if fam == ModelFamily.CLAUDE else
                         'Solve this step by step, each step on its own line, then state the final answer on a '
                         'last line beginning "Answer:".')
        parts.rules.append("Show the working before the answer; if possible, re-derive the answer a second way and confirm both agree.")
        parts.criticals.append("working shown, final answer explicitly labeled")
        parts.sources.append("Wei et al. 2022 (CoT); Wang et al. 2023 (self-consistency)")
        return "a conclusion without checkable working"

    if mode == FailureMode.VERBOSITY:
        fillers = _quotes(findings)
        parts.rules.append("Open with the answer itself — no preamble, no restating the question."
                           + (" Banned filler: " + ", ".join(f'"{q}"' for q in fillers[:3]) + "." if fillers else ""))
        parts.problems += [f'filler: "{q}"' for q in fillers[:2]]
        parts.criticals.append("the response starts with substance and contains no filler")
        parts.sources.append(profile.source)
        return "padding" + (f' (e.g. "{fillers[0]}")' if fillers else "")

    if mode == FailureMode.WRONG_REGISTER:
        data = findings[0].data
        fk, band = data.get("fk_grade"), data.get("band", [6, 14])
        audience = data.get("audience", "the intended audience")
        too_hard = fk is not None and fk > band[1]
        style = ("short sentences, everyday words, one idea at a time" if too_hard
                 else "precise terminology and compact, information-dense prose")
        parts.role = f"You are writing for {audience}. Use {style}."
        parts.criticals.append(f"the text reads naturally for {audience}")
        parts.sources.append("role prompting for register (RESEARCH.md 2.8)")
        return f"reading level {fk} outside the {band[0]:g}-{band[1]:g} band for {audience}"

    if mode == FailureMode.POOR_STRUCTURE:
        repeats = any("repeat" in f.detail.lower() or "duplicate" in f.detail.lower() for f in findings)
        parts.rules.append("Before writing, produce a short outline; then write one section per point"
                           + (" — no section may restate an earlier one." if repeats else ", each following from the previous."))
        parts.sources.append(profile.source)
        return "sections that repeat each other" if repeats else "abrupt jumps between sections"

    if mode == FailureMode.LOW_DIVERSITY:
        cliches = _quotes(findings)
        parts.rules.append(("Banned phrases: " + ", ".join(f'"{c}"' for c in cliches[:5]) + ". Find a fresh image instead."
                            if cliches else "Replace stock phrases with concrete, sensory detail.")
                           + " Vary sentence length deliberately.")
        parts.problems += [f'stock phrase: "{c}"' for c in cliches[:2]]
        parts.sources.append(profile.source)
        return "flat style" + (f" (stock phrases like {cliches[0]!r})" if cliches else "")

    return None


# --------------------------------------------------------------- composition

def _rules_block(profile: Profile, rules: list[str]) -> str:
    if profile.family == ModelFamily.CLAUDE:
        return "<rules>\n" + "\n".join(f"- {r}" for r in rules) + "\n</rules>"
    if profile.family == ModelFamily.GPT:
        return "### Requirements\n" + "\n".join(f"{i + 1}. {r}" for i, r in enumerate(rules))
    return "Rules:\n" + "\n".join(f"- {r}" for r in rules)


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
    if not by_mode:
        return []

    parts = _Parts()
    fragments: list[str] = []
    lead_mode: FailureMode | None = None
    for mode in _SEVERITY:
        if mode not in by_mode:
            continue
        fragment = _contribute(mode, by_mode[mode], task, profile, parts)
        if fragment:
            fragments.append(fragment)
            lead_mode = lead_mode or mode
    if lead_mode is None:
        return []

    parts.rules = list(dict.fromkeys(parts.rules))[:MAX_RULES]
    parts.problems = list(dict.fromkeys(parts.problems))[:MAX_PROBLEMS]

    segments: list[str] = []
    if parts.role:
        segments.append(parts.role)
    if task.has_source_text:
        segments.append(profile.wrap_source())
    segments.append(task.instruction.strip())
    if parts.pre:
        segments.append(parts.pre)
    if parts.rules:
        segments.append(_rules_block(profile, parts.rules))
    if parts.wants_example:
        segments.append("Here is an example of a response with the right shape (replace the content, keep the form):\n"
                        "[write one short example that satisfies every rule above]")
    if parts.problems:
        segments.append("A previous attempt had these problems — do not repeat any of them:\n"
                        + "\n".join(f"- {p}" for p in parts.problems))
    if parts.criticals and profile.family in (ModelFamily.GPT, ModelFamily.OPEN_WEIGHTS, ModelFamily.GENERIC):
        # lost-in-the-middle: repeat the most critical checks at the very end
        segments.append("IMPORTANT — before finishing, verify: " + "; ".join(parts.criticals[:3]) + ".")

    diagnosis = (f"{len(fragments)} problem(s) diagnosed: " + "; ".join(fragments) + ". "
                 f"This single prompt rebuilds your original instruction to fix all of them, using "
                 f"{profile.display} mechanisms — {profile.structure_hint}")

    return [ImprovementPrompt(
        failure_mode=lead_mode,
        title="The repaired prompt",
        diagnosis=diagnosis,
        prompt_text="\n\n".join(segments),
        model_family=profile.family,
        technique_source="; ".join(dict.fromkeys(parts.sources)),
    )]
