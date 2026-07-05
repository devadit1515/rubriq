"""Instruction-following: extract verifiable constraints from the prompt,
check each with code (IFEval approach, RESEARCH.md 1.8).

Extraction is deliberately conservative. A constraint only becomes a check
when the pattern is unambiguous, and every extracted constraint is reported
to the user whether it passed or failed — so a wrong extraction is visible,
not a hidden scoring error. Counting checks like these are the case where
deterministic code beats LLM judges (MT-Bench bias findings, RESEARCH.md 1.6).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .schemas import Evidence, FailureMode, Finding
from .textutils import snippet, split_paragraphs, split_sentences, word_count

_NUM_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "a single": 1, "single": 1,
}


def _num(tok: str) -> int:
    tok = tok.strip().lower()
    return int(tok) if tok.isdigit() else _NUM_WORDS[tok]


_NUM_PAT = r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a single|single)"


@dataclass
class Constraint:
    kind: str                    # e.g. "max_words", "format_json"
    description: str             # human-readable, e.g. "at most 150 words"
    source_quote: str            # the prompt text that produced it
    params: dict = field(default_factory=dict)


@dataclass
class CheckResult:
    constraint: Constraint
    passed: bool
    detail: str                  # e.g. "212 words (limit 150)"
    evidence: list[Evidence] = field(default_factory=list)


# ---------------------------------------------------------------- extraction

_UNIT = r"(words?|sentences?|paragraphs?|bullet ?points?|bullets?|items?|characters?|lines?|sections?)"

_LIMIT_PATTERNS = [
    # (regex, bound kind); bound in {"max","min","exact","approx"}
    (re.compile(rf"(?i)\b(?:in|within|under|at most|no more than|not more than|maximum(?: of)?|max\.?|up to|fewer than|less than|no longer than)\s+{_NUM_PAT}\s+{_UNIT}"), "max"),
    (re.compile(rf"(?i)\b(?:at least|minimum(?: of)?|min\.?|no fewer than|more than|over)\s+{_NUM_PAT}\s+{_UNIT}"), "min"),
    (re.compile(rf"(?i)\bexactly\s+{_NUM_PAT}\s+{_UNIT}"), "exact"),
    (re.compile(rf"(?i)\b(?:about|around|approximately|roughly|~)\s*{_NUM_PAT}\s+{_UNIT}"), "approx"),
    (re.compile(rf"(?i)\b{_NUM_PAT}[- ]{_UNIT}\b(?:\s+(?:summary|answer|response|list|essay|description|overview|explanation))"), "approx"),
]

_STRUCT_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"(?i)\b(?:as|in|into|to|return|output|respond(?: only)? (?:in|with)|format(?:ted)? as)\s+(?:a |an |valid |pure |raw )?json\b"), "format_json", "output should be valid JSON"),
    (re.compile(r"(?i)\bas (?:a |an )?(?:markdown )?table\b"), "format_table", "output should be a table"),
    (re.compile(r"(?i)\b(?:as|in|using) (?:a )?(?:bullet(?:ed)?|bulleted) (?:points?|list)\b|\bbullet points? only\b"), "format_bullets", "output should be a bulleted list"),
    (re.compile(r"(?i)\bnumbered list\b"), "format_numbered", "output should be a numbered list"),
    (re.compile(r"(?i)\b(?:in |as )(?:a )?single paragraph\b|\bone paragraph\b"), "single_paragraph", "output should be one paragraph"),
    (re.compile(r"(?i)\bin (?:a )?single sentence\b|\bone sentence\b"), "single_sentence", "output should be one sentence"),
    (re.compile(r"(?i)\ball (?:in )?lower ?case\b|\bin lowercase only\b"), "all_lowercase", "output should be all lowercase"),
    (re.compile(r"(?i)\ball (?:in )?(?:upper ?case|caps)\b"), "all_uppercase", "output should be all uppercase"),
    (re.compile(r"(?i)\bno bullet points?\b|\bwithout (?:any )?bullets?\b|\bdo not use bullet\b"), "no_bullets", "output should not use bullet points"),
    (re.compile(r"(?i)\bin plain (?:text|prose)\b|\bno markdown\b|\bwithout (?:any )?(?:markdown|formatting)\b"), "no_markdown", "output should be plain prose without markdown"),
]

_INCLUDE_PAT = re.compile(
    r"(?i)\b(?:must (?:include|mention|contain)|be sure to (?:include|mention)|"
    r"include|mention|don'?t forget to (?:include|mention))\s+"
    r"(?:the (?:word|term|phrase)s?\s+)?[\"“']([^\"”']{2,60})[\"”']"
)
_EXCLUDE_PAT = re.compile(
    r"(?i)\b(?:do not|don'?t|never|avoid)\s+"
    r"(?:us(?:e|ing)|mention(?:ing)?|includ(?:e|ing)|say(?:ing)?)(?:\s+the\s+(?:word|term|phrase)s?)?\s+[\"“']([^\"”']{2,60})[\"”']"
)
_START_PAT = re.compile(r"(?i)\b(?:begin|start)\s+(?:your\s+)?(?:response|answer|output|reply|with)?\s*with\s+[\"“']([^\"”']{2,80})[\"”']")
_END_PAT = re.compile(r"(?i)\bend\s+(?:your\s+)?(?:response|answer|output|reply)?\s*with\s+[\"“']([^\"”']{2,80})[\"”']")

_BULLET_LINE = re.compile(r"(?m)^\s*(?:[-*•]|\d+[.)])\s+\S")
_NUMBERED_LINE = re.compile(r"(?m)^\s*\d+[.)]\s+\S")
_MD_MARKUP = re.compile(r"(?m)(^#{1,6}\s)|(\*\*)|(^\s*[-*]\s)|(```)|(^\s*>\s)|(\|.+\|)")


def extract_constraints(instruction: str) -> list[Constraint]:
    found: list[Constraint] = []
    seen: set[tuple] = set()

    for pat, bound in _LIMIT_PATTERNS:
        for m in pat.finditer(instruction):
            n, unit = _num(m.group(1)), m.group(2).lower()
            unit_key = re.sub(r"\s|s$", "", unit)
            unit_key = {"bulletpoint": "bullet", "item": "bullet"}.get(unit_key, unit_key)
            key = (bound, unit_key, n)
            if key in seen:
                continue
            seen.add(key)
            found.append(Constraint(
                kind=f"{bound}_{unit_key}",
                description=f"{ {'max':'at most','min':'at least','exact':'exactly','approx':'about'}[bound] } {n} {unit}",
                source_quote=m.group(0),
                params={"n": n, "bound": bound, "unit": unit_key},
            ))

    for pat, kind, desc in _STRUCT_PATTERNS:
        m = pat.search(instruction)
        if m and ("struct", kind) not in seen:
            seen.add(("struct", kind))
            found.append(Constraint(kind=kind, description=desc, source_quote=m.group(0)))

    for m in _INCLUDE_PAT.finditer(instruction):
        term = m.group(1).strip()
        if ("include", term.lower()) not in seen:
            seen.add(("include", term.lower()))
            found.append(Constraint(kind="must_include", description=f'must include "{term}"',
                                    source_quote=m.group(0), params={"term": term}))
    for m in _EXCLUDE_PAT.finditer(instruction):
        term = m.group(1).strip()
        if ("exclude", term.lower()) not in seen:
            seen.add(("exclude", term.lower()))
            found.append(Constraint(kind="must_exclude", description=f'must not use "{term}"',
                                    source_quote=m.group(0), params={"term": term}))
    m = _START_PAT.search(instruction)
    if m:
        found.append(Constraint(kind="starts_with", description=f'must start with "{m.group(1)}"',
                                source_quote=m.group(0), params={"term": m.group(1)}))
    m = _END_PAT.search(instruction)
    if m:
        found.append(Constraint(kind="ends_with", description=f'must end with "{m.group(1)}"',
                                source_quote=m.group(0), params={"term": m.group(1)}))
    return found


# ------------------------------------------------------------------- checking

def _count_units(output: str, unit: str) -> int:
    if unit == "word":
        return word_count(output)
    if unit == "sentence":
        return len(split_sentences(output))
    if unit == "paragraph":
        return len(split_paragraphs(output))
    if unit == "character":
        return len(output.strip())
    if unit == "line":
        return len([ln for ln in output.splitlines() if ln.strip()])
    if unit in ("bullet",):
        return len(_BULLET_LINE.findall(output))
    if unit == "section":
        return len(re.findall(r"(?m)^#{1,6}\s+\S", output)) or len(split_paragraphs(output))
    return word_count(output)


def _strip_code_blocks(output: str) -> str:
    return re.sub(r"```.*?```", "", output, flags=re.S)


def check_constraint(c: Constraint, output: str) -> CheckResult:
    kind = c.kind
    if kind.startswith(("max_", "min_", "exact_", "approx_")):
        bound, unit = c.params["bound"], c.params["unit"]
        n = c.params["n"]
        actual = _count_units(output, unit)
        if bound == "max":
            ok = actual <= n
        elif bound == "min":
            ok = actual >= n
        elif bound == "exact":
            ok = actual == n
        else:  # approx: ±20% with a floor of ±2
            tol = max(2, round(n * 0.2))
            ok = abs(actual - n) <= tol
        return CheckResult(c, ok, f"{actual} {unit}{'' if actual == 1 else 's'} (asked: {c.description})")

    if kind == "format_json":
        text = output.strip()
        fence = re.search(r"```(?:json)?\s*(.+?)```", text, flags=re.S)
        candidate = fence.group(1).strip() if fence else text
        try:
            json.loads(candidate)
            extra = text != candidate and not fence
            return CheckResult(c, not extra, "valid JSON" if not extra else "JSON present but wrapped in extra prose")
        except json.JSONDecodeError as e:
            return CheckResult(c, False, f"not valid JSON ({e.msg} at position {e.pos})",
                               [Evidence(quote=snippet(candidate[max(0, e.pos - 60):e.pos + 60]), note="around the parse error")])

    if kind == "format_table":
        ok = bool(re.search(r"(?m)^\|.+\|\s*$", output)) or bool(re.search(r"(?m)^.+\t.+$", output))
        return CheckResult(c, ok, "table detected" if ok else "no table structure found in output")

    if kind == "format_bullets":
        n = len(_BULLET_LINE.findall(output))
        return CheckResult(c, n >= 2, f"{n} bullet lines found")

    if kind == "format_numbered":
        n = len(_NUMBERED_LINE.findall(output))
        return CheckResult(c, n >= 2, f"{n} numbered lines found")

    if kind == "single_paragraph":
        n = len(split_paragraphs(output))
        return CheckResult(c, n == 1, f"{n} paragraphs")

    if kind == "single_sentence":
        n = len(split_sentences(output))
        return CheckResult(c, n == 1, f"{n} sentences")

    if kind == "all_lowercase":
        letters = re.sub(r"[^A-Za-z]", "", output)
        ok = letters.islower() if letters else True
        bad = re.search(r"[A-Z][a-zA-Z]*", output)
        ev = [Evidence(quote=snippet(bad.group(0)), note="uppercase found")] if bad else []
        return CheckResult(c, ok, "all lowercase" if ok else "contains uppercase", ev)

    if kind == "all_uppercase":
        letters = re.sub(r"[^A-Za-z]", "", output)
        ok = letters.isupper() if letters else True
        return CheckResult(c, ok, "all caps" if ok else "contains lowercase")

    if kind == "no_bullets":
        n = len(_BULLET_LINE.findall(output))
        return CheckResult(c, n == 0, "no bullets" if n == 0 else f"{n} bullet lines present")

    if kind == "no_markdown":
        m = _MD_MARKUP.search(output)
        return CheckResult(c, m is None, "plain prose" if m is None else "markdown markup present",
                           [Evidence(quote=snippet(m.group(0)))] if m else [])

    if kind == "must_include":
        term = c.params["term"]
        ok = term.lower() in output.lower()
        return CheckResult(c, ok, f'"{term}" {"present" if ok else "missing from output"}')

    if kind == "must_exclude":
        term = c.params["term"]
        i = output.lower().find(term.lower())
        ok = i < 0
        ev = [] if ok else [Evidence(quote=snippet(output[max(0, i - 50):i + len(term) + 50]))]
        return CheckResult(c, ok, f'"{term}" {"absent" if ok else "appears in output"}', ev)

    if kind == "starts_with":
        term = c.params["term"]
        ok = output.strip().lower().startswith(term.lower())
        return CheckResult(c, ok, "starts as required" if ok else f'output starts with "{snippet(output.strip(), 50)}"')

    if kind == "ends_with":
        term = c.params["term"]
        ok = output.strip().rstrip(".!?").lower().endswith(term.lower().rstrip(".!?"))
        return CheckResult(c, ok, "ends as required" if ok else f'output ends with "…{output.strip()[-50:]}"')

    return CheckResult(c, True, "constraint recognized but no checker bound (reported, not scored)")


def run_checks(instruction: str, output: str) -> list[CheckResult]:
    prose = output
    constraints = extract_constraints(instruction)
    # Word/sentence limits should not count code inside fences for mixed outputs.
    results = []
    for c in constraints:
        target = prose
        if c.kind.split("_")[-1] in ("word", "sentence") and "```" in output:
            target = _strip_code_blocks(output)
        results.append(check_constraint(c, target))
    return results


def to_findings(results: list[CheckResult]) -> list[Finding]:
    findings = []
    for r in results:
        if r.passed:
            continue
        findings.append(Finding(
            failure_mode=FailureMode.FORMAT_VIOLATION if r.constraint.kind.startswith(("format", "single", "no_", "all_"))
            else FailureMode.MISSED_CONSTRAINT,
            detail=f"Prompt asked for {r.constraint.description} — output has {r.detail}.",
            evidence=r.evidence + [Evidence(quote=r.constraint.source_quote, source="prompt", note="the instruction that set this constraint")],
            data={"kind": r.constraint.kind, **r.constraint.params, "actual": r.detail},
        ))
    return findings
