"""Hallucination *risk signals* for ungrounded prompts (RESEARCH.md 1.9).

Without a source or knowledge base, no local method can verify claims
(FActScore's precondition). What we CAN do is flag the patterns that
correlate with fabrication: citation-shaped strings, precise unattributed
statistics, vague-authority claims, and confident framing around
unverifiable specifics. Wording contract: every finding says "unverifiable
here", never "false".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..textutils import snippet

_SIGNALS: list[tuple[str, re.Pattern, str]] = [
    ("citation_pattern",
     re.compile(r"\([A-Z][A-Za-z-]+(?:\s+et al\.?|\s+(?:&|and)\s+[A-Z][A-Za-z-]+)?,?\s+(?:19|20)\d{2}\)|\[[0-9]{1,3}\]"),
     "citation-shaped reference — LLMs fabricate plausible-looking citations; verify each one exists"),
    ("case_or_statute",
     re.compile(r"\b[A-Z][a-z]+ v\.? [A-Z][a-z]+\b|\b\d+ U\.S\.C?\.? §? ?\d+\b"),
     "legal citation pattern — a documented fabrication hotspot (Mata v. Avianca, 2023)"),
    ("precise_statistic",
     re.compile(r"\b\d{1,3}(?:\.\d{1,2})?%|\b\d+(?:\.\d+)? (?:million|billion|trillion)\b"),
     "precise statistic with no source in the prompt to check it against"),
    ("vague_authority",
     re.compile(r"(?i)\b(?:studies|research|experts|scientists|reports?) (?:show|shows|suggest|indicate|have (?:shown|found)|found|say|agree|confirm)\b"),
     "appeal to unnamed studies/experts — no way to trace the claim"),
    ("url",
     re.compile(r"https?://\S+"),
     "URL in output — LLMs generate dead or wrong links; verify before trusting"),
    ("specific_date_event",
     re.compile(r"(?i)\b(?:on|in) (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? (?:19|20)\d{2}\b"),
     "specific dated event — unverifiable without a source"),
    ("named_figure_quote",
     re.compile(r"(?i)(?:said|stated|according to|wrote|declared)[,:]? ?[\"“]"),
     "attributed quotation — fabricated quotes are a known failure pattern"),
]

_HEDGES = re.compile(r"(?i)\b(?:reportedly|allegedly|approximately|around|roughly|estimated|as of my knowledge|may|might|possibly|it is believed)\b")


@dataclass
class RiskSignal:
    kind: str
    quote: str
    why: str


@dataclass
class HallucinationRiskResult:
    signals: list[RiskSignal] = field(default_factory=list)
    hedge_count: int = 0
    density_per_100w: float = 0.0


def compute(output: str, n_words: int) -> HallucinationRiskResult:
    signals: list[RiskSignal] = []
    seen: set[str] = set()
    for kind, pat, why in _SIGNALS:
        for m in pat.finditer(output):
            start = max(0, m.start() - 60)
            quote = snippet(output[start:m.end() + 60])
            key = f"{kind}:{m.group(0)[:40]}"
            if key in seen:
                continue
            seen.add(key)
            signals.append(RiskSignal(kind=kind, quote=quote, why=why))
            if sum(1 for s in signals if s.kind == kind) >= 3:
                break   # cap per kind; the report needs examples, not a census

    return HallucinationRiskResult(
        signals=signals,
        hedge_count=len(_HEDGES.findall(output)),
        density_per_100w=round(100 * len(signals) / max(1, n_words), 2),
    )
