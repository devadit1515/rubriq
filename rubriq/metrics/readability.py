"""Readability and fluency statistics (RESEARCH.md 1.10).

Flesch Reading Ease / Flesch-Kincaid grade are audience-fit signals, not
quality scores: the score maps to a target band derived from the stated (or
inferred) audience, and distance from the band is what counts against the
output.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..textutils import count_syllables, split_sentences, words


@dataclass
class ReadabilityStats:
    flesch_reading_ease: float
    fk_grade: float
    avg_sentence_words: float
    n_sentences: int
    n_words: int


def compute(text: str) -> ReadabilityStats | None:
    sents = split_sentences(text)
    toks = words(text)
    if not sents or len(toks) < 10:
        return None
    syllables = sum(count_syllables(w) for w in toks)
    n_w, n_s = len(toks), len(sents)
    fre = 206.835 - 1.015 * (n_w / n_s) - 84.6 * (syllables / n_w)
    fk = 0.39 * (n_w / n_s) + 11.8 * (syllables / n_w) - 15.59
    return ReadabilityStats(
        flesch_reading_ease=round(fre, 1),
        fk_grade=round(fk, 1),
        avg_sentence_words=round(n_w / n_s, 1),
        n_sentences=n_s,
        n_words=n_w,
    )


# Audience keyword -> acceptable FK grade band (inclusive).
_AUDIENCE_BANDS: list[tuple[tuple[str, ...], tuple[float, float], str]] = [
    (("child", "kid", "5 year", "five year", "eli5", "young"), (0.0, 6.0), "young readers"),
    (("teen", "high school", "student", "beginner", "layman", "non-technical", "general public", "simple"), (5.0, 10.0), "general readers"),
    (("professional", "business", "executive",), (8.0, 14.0), "professional readers"),
    (("expert", "academic", "technical", "clinician", "researcher", "phd", "specialist"), (10.0, 18.0), "expert readers"),
]

DEFAULT_BAND = (6.0, 14.0)


def audience_band(audience_text: str, instruction: str) -> tuple[tuple[float, float], str]:
    """Pick the FK grade band from the advanced-options audience field,
    falling back to audience words inside the instruction itself."""
    for probe in (audience_text.lower(), instruction.lower()):
        if not probe:
            continue
        for keys, band, label in _AUDIENCE_BANDS:
            if any(k in probe for k in keys):
                return band, label
    return DEFAULT_BAND, "unspecified audience (default band)"
