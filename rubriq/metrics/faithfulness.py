"""NLI faithfulness — SummaC-ZS (Laban et al. 2022), RESEARCH.md 1.2.

Output sentences are scored for entailment against source chunks with
cross-encoder/nli-deberta-v3-small. Per output sentence we take the max
entailment over source chunks ("is this sentence supported anywhere?");
the document score is the mean; the least-supported sentences become quoted
evidence for unfaithful_content findings.

The cross-encoder returns logits over (contradiction, entailment, neutral)
— sbert's documented label order for the nli-deberta-v3 family.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import get_nli
from ..textutils import snippet, split_sentences, word_count

_LABELS = ("contradiction", "entailment", "neutral")


@dataclass
class SentenceSupport:
    sentence: str
    entailment: float       # max over source chunks
    contradiction: float    # at the chunk where entailment peaked
    best_chunk: str


@dataclass
class FaithfulnessResult:
    mean_entailment: float
    sentences: list[SentenceSupport]
    unsupported: list[SentenceSupport]     # entailment below threshold
    contradicted: list[SentenceSupport]    # contradiction dominant somewhere
    threshold: float


def _chunks(source: str, max_words: int = 90) -> list[str]:
    """Sliding sentence windows so support spanning two sentences isn't missed."""
    sents = split_sentences(source)
    if not sents:
        return [source]
    chunks, cur, cur_w = [], [], 0
    for s in sents:
        w = word_count(s)
        cur.append(s)
        cur_w += w
        if cur_w >= max_words:
            chunks.append(" ".join(cur))
            cur, cur_w = cur[-1:], word_count(cur[-1]) if cur else 0
    if cur:
        chunks.append(" ".join(cur))
    return chunks or [source]


def _score_sentences(sents: list[str]) -> list[str]:
    """Filter out non-claims: headers, tiny fragments, questions."""
    return [s for s in sents if word_count(s) >= 4 and not s.strip().endswith("?")
            and not s.strip().startswith("#")]


def compute(source: str, output: str, threshold: float = 0.5) -> FaithfulnessResult | None:
    nli = get_nli()
    if nli is None:
        return None
    import numpy as np

    out_sents = _score_sentences(split_sentences(output))
    if not out_sents:
        return None
    chunks = _chunks(source)

    pairs = [(c, s) for s in out_sents for c in chunks]
    logits = nli.predict(pairs, batch_size=16)
    probs = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
    probs = probs.reshape(len(out_sents), len(chunks), 3)

    ent_idx = _LABELS.index("entailment")
    con_idx = _LABELS.index("contradiction")

    supports: list[SentenceSupport] = []
    for i, s in enumerate(out_sents):
        best_j = int(probs[i, :, ent_idx].argmax())
        supports.append(SentenceSupport(
            sentence=s,
            entailment=round(float(probs[i, best_j, ent_idx]), 3),
            contradiction=round(float(probs[i, :, con_idx].max()), 3),
            best_chunk=snippet(chunks[best_j]),
        ))

    unsupported = [s for s in supports if s.entailment < threshold]
    contradicted = [s for s in supports if s.contradiction > 0.5]
    mean_ent = round(sum(s.entailment for s in supports) / len(supports), 3)

    return FaithfulnessResult(
        mean_entailment=mean_ent,
        sentences=supports,
        unsupported=sorted(unsupported, key=lambda s: s.entailment)[:5],
        contradicted=contradicted[:5],
        threshold=threshold,
    )
