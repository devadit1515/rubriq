"""Lexical diversity and repetition (RESEARCH.md 1.10).

MTLD (McCarthy & Jarvis 2010) for length-robust diversity; cliché density
against a fixed list; sentence-length variance as the rhythm proxy; repeated
n-grams for mechanical repetition. All of these are labeled proxies in the
creative-writing bundle (carve-out #2).
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

from ..textutils import split_sentences, word_count, words

_CLICHES = [
    "at the end of the day", "in this day and age", "the calm before the storm",
    "a whirlwind of emotions", "time stood still", "heart skipped a beat",
    "sent shivers down", "a rollercoaster of", "little did they know",
    "in the blink of an eye", "against all odds", "a testament to",
    "the fabric of", "a tapestry of", "nestled in", "bustling", "myriad of",
    "delve into", "embark on a journey", "unlock the secrets", "hidden gem",
    "breathtaking", "picturesque", "last but not least", "needless to say",
    "it goes without saying", "each and every", "first and foremost",
    "stood the test of time", "beacon of hope", "double-edged sword",
]


def mtld(tokens: list[str], threshold: float = 0.72) -> float | None:
    """Measure of Textual Lexical Diversity, bidirectional mean."""
    if len(tokens) < 50:
        return None

    def _pass(seq: list[str]) -> float:
        factors, types, count = 0.0, set(), 0
        for tok in seq:
            count += 1
            types.add(tok)
            if len(types) / count <= threshold:
                factors += 1
                types, count = set(), 0
        if count:
            ttr = len(types) / count
            factors += (1 - ttr) / (1 - threshold) if ttr > threshold else 1
        return len(seq) / factors if factors else float(len(seq))

    return round((_pass(tokens) + _pass(tokens[::-1])) / 2, 1)


@dataclass
class LexicalStats:
    mtld: float | None
    cliche_hits: list[str]
    cliches_per_100w: float
    sentence_len_cv: float | None   # coefficient of variation of sentence lengths
    repeated_ngrams: list[str]      # 4-grams appearing 3+ times


def compute(text: str) -> LexicalStats:
    toks = words(text)
    n_w = max(1, len(toks))
    low = text.lower()
    hits = [c for c in _CLICHES if c in low]

    sents = split_sentences(text)
    lens = [word_count(s) for s in sents]
    cv = None
    if len(lens) >= 3:
        mean = sum(lens) / len(lens)
        var = sum((x - mean) ** 2 for x in lens) / len(lens)
        cv = round((var ** 0.5) / mean, 2) if mean else None

    grams = Counter(
        " ".join(toks[i:i + 4]) for i in range(len(toks) - 3)
    )
    repeated = [g for g, c in grams.most_common(5) if c >= 3 and not re.fullmatch(r"(\w+ )*(the|of|and|a|to|in)( \w+)*", g)]

    return LexicalStats(
        mtld=mtld(toks),
        cliche_hits=hits,
        cliches_per_100w=round(100 * len(hits) / n_w, 2),
        sentence_len_cv=cv,
        repeated_ngrams=repeated,
    )
