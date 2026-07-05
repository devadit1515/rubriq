"""Lazy singletons for the two local models.

Checkpoints locked in RESEARCH.md:
- embeddings: BAAI/bge-small-en-v1.5
- NLI cross-encoder: cross-encoder/nli-deberta-v3-small

Both load on first use (first request pays the load; the API exposes a
warmup endpoint). If loading fails (no download yet, offline machine),
callers receive None and the affected metrics report skipped_reason instead
of fake numbers — degradation is visible, never silent.
"""

from __future__ import annotations

import logging
import threading

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
NLI_MODEL = "cross-encoder/nli-deberta-v3-small"

_lock = threading.Lock()
_embedder = None
_nli = None
_embedder_failed = False
_nli_failed = False


def get_embedder():
    global _embedder, _embedder_failed
    if _embedder is not None or _embedder_failed:
        return _embedder
    with _lock:
        if _embedder is None and not _embedder_failed:
            try:
                from sentence_transformers import SentenceTransformer
                _embedder = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
            except Exception:
                logger.exception("embedding model unavailable")
                _embedder_failed = True
    return _embedder


def get_nli():
    global _nli, _nli_failed
    if _nli is not None or _nli_failed:
        return _nli
    with _lock:
        if _nli is None and not _nli_failed:
            try:
                from sentence_transformers import CrossEncoder
                _nli = CrossEncoder(NLI_MODEL, device="cpu")
            except Exception:
                logger.exception("NLI model unavailable")
                _nli_failed = True
    return _nli


def availability() -> dict[str, bool]:
    """Force-loads both models and reports the outcome (use for warmup)."""
    return {
        "embeddings": get_embedder() is not None,
        "nli": get_nli() is not None,
    }


def loaded() -> dict[str, bool]:
    """Reports current state WITHOUT loading anything (safe for /health)."""
    return {"embeddings": _embedder is not None, "nli": _nli is not None}
