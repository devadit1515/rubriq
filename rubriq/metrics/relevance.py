"""Answer relevance via embeddings (RESEARCH.md 1.3/1.4, RAGAS-style,
adapted to run without an LLM: cosine similarity between the instruction and
the output, plus per-paragraph drill-down to locate where drift happens).

bge models are asymmetric retrievers: queries get the documented
"Represent this sentence..." prefix, passages do not.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import get_embedder
from ..textutils import snippet, split_paragraphs

_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


@dataclass
class RelevanceResult:
    overall: float                        # cosine, roughly 0..1 for bge
    worst_paragraph: str | None
    worst_paragraph_sim: float | None
    paragraph_sims: list[tuple[str, float]]


def compute(instruction: str, output: str) -> RelevanceResult | None:
    embedder = get_embedder()
    if embedder is None:
        return None
    paragraphs = split_paragraphs(output) or [output]
    texts = [_BGE_QUERY_PREFIX + instruction, output] + paragraphs
    vecs = embedder.encode(texts, normalize_embeddings=True)
    q, whole, para_vecs = vecs[0], vecs[1], vecs[2:]
    overall = float(q @ whole)
    sims = [(p, float(q @ v)) for p, v in zip(paragraphs, para_vecs)]
    worst = min(sims, key=lambda x: x[1]) if len(sims) > 1 else (None, None)
    return RelevanceResult(
        overall=round(overall, 3),
        worst_paragraph=snippet(worst[0]) if worst[0] else None,
        worst_paragraph_sim=round(worst[1], 3) if worst[1] is not None else None,
        paragraph_sims=[(snippet(p, 80), round(s, 3)) for p, s in sims],
    )


def similarity(a: str, b: str) -> float | None:
    """Symmetric semantic similarity (used by rewriting's meaning check)."""
    embedder = get_embedder()
    if embedder is None:
        return None
    va, vb = embedder.encode([a, b], normalize_embeddings=True)
    return round(float(va @ vb), 3)
