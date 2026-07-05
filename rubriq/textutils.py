"""Shared text primitives: tokenization-free splitting and counting.

Kept dependency-free (no nltk/spacy) so the deterministic checks stay
deterministic and the install stays light.
"""

from __future__ import annotations

import re

_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g",
    "i.e", "fig", "no", "vol", "inc", "ltd", "co", "corp", "dept", "est",
    "approx", "u.s", "u.k",
}

_SENT_BOUNDARY = re.compile(r"(?<=[.!?])[\"')\]]*\s+(?=[A-Z0-9\"'(\[])")


def split_sentences(text: str) -> list[str]:
    """Regex sentence splitter with abbreviation guards. Good enough for
    metric aggregation; not a linguistic gold standard and doesn't need to be.
    """
    text = text.strip()
    if not text:
        return []
    parts: list[str] = []
    for para in re.split(r"\n\s*\n|\n(?=[-*#\d])", text):
        para = para.strip()
        if not para:
            continue
        start = 0
        for m in _SENT_BOUNDARY.finditer(para):
            candidate = para[start:m.start() + 1]
            last_word = re.findall(r"[\w.]+", candidate[-12:].lower())
            if last_word and last_word[-1].rstrip(".") in _ABBREVIATIONS:
                continue
            if candidate.strip():
                parts.append(candidate.strip())
            start = m.end()
        tail = para[start:].strip()
        if tail:
            parts.append(tail)
    return parts


def split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9'’-]+", text))


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z'’-]+", text.lower())


def count_syllables(word: str) -> int:
    """Heuristic syllable count (vowel groups, silent-e adjustment)."""
    w = word.lower().strip(".:;!?,'\"")
    if not w:
        return 0
    groups = re.findall(r"[aeiouy]+", w)
    n = len(groups)
    if w.endswith("e") and n > 1 and not w.endswith(("le", "ee", "ye")):
        n -= 1
    return max(1, n)


def snippet(text: str, limit: int = 160) -> str:
    """Shorten a quote for evidence display without cutting mid-word."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + "…"
