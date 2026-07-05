"""Static code checks (RESEARCH.md 1.11). No execution in v1 — the ladder:
does it parse, is requested API surface present, are there placeholder stubs.
Honesty note attached by the scorer: static analysis cannot prove the code
runs or is correct; that is HumanEval-style territory reserved for judge mode.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field

from ..textutils import snippet

_FENCE = re.compile(r"```(\w+)?\s*\n(.*?)```", re.S)
_PLACEHOLDERS = re.compile(
    r"(?i)(?:#|//|/\*)?\s*(TODO|FIXME|your[_ ](?:api[_ ]key|code|logic)[_ ]here|"
    r"implement (?:this|me)|\.\.\.\s*$|<[A-Z_]+>|pass\s*#\s*placeholder)", re.M)
_REQUESTED_NAME = re.compile(
    r"(?i)\b(?:function|method|class)\s+(?:called|named)\s+[`'\"]?([A-Za-z_][A-Za-z0-9_]*)")

_BRACKETS = {"(": ")", "[": "]", "{": "}"}


@dataclass
class CodeBlock:
    language: str
    code: str
    parses: bool | None      # None = no parser for this language, balance-checked only
    parse_error: str = ""


@dataclass
class CodeStaticResult:
    blocks: list[CodeBlock] = field(default_factory=list)
    has_code: bool = False
    placeholders: list[str] = field(default_factory=list)
    requested_names_missing: list[str] = field(default_factory=list)
    prose_only: bool = False    # code was requested but none found


def _balanced(code: str) -> bool:
    """Bracket balance ignoring string literals (rough, for non-Python)."""
    stack = []
    in_str: str | None = None
    prev = ""
    for ch in code:
        if in_str:
            if ch == in_str and prev != "\\":
                in_str = None
        elif ch in "\"'":
            in_str = ch
        elif ch in _BRACKETS:
            stack.append(_BRACKETS[ch])
        elif ch in _BRACKETS.values():
            if not stack or stack.pop() != ch:
                return False
        prev = ch
    return not stack


def compute(instruction: str, output: str) -> CodeStaticResult:
    result = CodeStaticResult()
    fences = _FENCE.findall(output)

    # Unfenced fallback: output that is obviously bare code.
    if not fences and re.search(r"(?m)^(def |class |function |import |from \w+ import |const |let |public )", output):
        fences = [("", output)]

    for lang, code in fences:
        lang = (lang or "").lower()
        code = code.strip()
        if not code:
            continue
        block = CodeBlock(language=lang or "unknown", code=code, parses=None)
        if lang in ("python", "py", "") and re.search(r"(?m)^(def |class |import |from )", code):
            block.language = "python"
            try:
                ast.parse(code)
                block.parses = True
            except SyntaxError as e:
                block.parses = False
                block.parse_error = f"line {e.lineno}: {e.msg}"
        elif lang == "json":
            import json
            try:
                json.loads(code)
                block.parses = True
            except json.JSONDecodeError as e:
                block.parses = False
                block.parse_error = e.msg
        else:
            block.parses = None if _balanced(code) else False
            if block.parses is False:
                block.parse_error = "unbalanced brackets/braces"
        result.blocks.append(block)

    result.has_code = bool(result.blocks)
    result.prose_only = not result.has_code

    all_code = "\n".join(b.code for b in result.blocks)
    result.placeholders = [snippet(m.group(0), 60) for m in _PLACEHOLDERS.finditer(all_code)][:5]

    for m in _REQUESTED_NAME.finditer(instruction):
        name = m.group(1)
        if not re.search(rf"\b{re.escape(name)}\b", all_code):
            result.requested_names_missing.append(name)

    return result
