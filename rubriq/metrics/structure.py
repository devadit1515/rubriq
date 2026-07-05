"""Structure, coherence proxy, and conciseness signals.

Coherence proxy per the Coh-Metrix tradition adapted to embeddings
(RESEARCH.md 1.10): adjacent-unit semantic similarity should sit in a
middle band — too low reads disjointed, too high reads repetitive.
Conciseness inverts MT-Bench's verbosity-bias finding (1.6).
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import get_embedder
from ..textutils import snippet, split_paragraphs, split_sentences, word_count


@dataclass
class CoherenceResult:
    mean_adjacent_sim: float
    flagged_low: list[tuple[str, str, float]]    # (unit_a, unit_b, sim) — disjointed jumps
    flagged_high: list[tuple[str, str, float]]   # near-duplicate units


def coherence_proxy(text: str) -> CoherenceResult | None:
    embedder = get_embedder()
    if embedder is None:
        return None
    units = split_paragraphs(text)
    if len(units) < 3:
        units = split_sentences(text)
    if len(units) < 3:
        return None
    vecs = embedder.encode(units, normalize_embeddings=True)
    sims = [float(vecs[i] @ vecs[i + 1]) for i in range(len(vecs) - 1)]
    low = [(snippet(units[i], 70), snippet(units[i + 1], 70), round(s, 2))
           for i, s in enumerate(sims) if s < 0.35][:3]
    high = [(snippet(units[i], 70), snippet(units[i + 1], 70), round(s, 2))
            for i, s in enumerate(sims) if s > 0.92][:3]
    return CoherenceResult(
        mean_adjacent_sim=round(sum(sims) / len(sims), 3),
        flagged_low=low,
        flagged_high=high,
    )


@dataclass
class ConcisenessResult:
    output_words: int
    expected_max: int | None      # None when no expectation could be set
    ratio: float | None
    filler_hits: list[str]


_FILLERS = [
    "it is important to note that", "it is worth noting", "as mentioned earlier",
    "in order to", "due to the fact that", "at this point in time",
    "it goes without saying", "needless to say", "in the world of",
    "in today's", "when it comes to", "at the end of the day",
    "i hope this helps", "certainly!", "great question",
]


def conciseness(instruction: str, output: str, task_expected_words: int | None) -> ConcisenessResult:
    n = word_count(output)
    low_out = output.lower()
    hits = [f for f in _FILLERS if f in low_out]
    ratio = round(n / task_expected_words, 2) if task_expected_words else None
    return ConcisenessResult(
        output_words=n,
        expected_max=task_expected_words,
        ratio=ratio,
        filler_hits=hits,
    )
