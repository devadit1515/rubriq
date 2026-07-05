# Rubriq

Paste the prompt you gave an LLM and the output you got back. Rubriq scores
the output against evaluation parameters drawn from published research,
quotes the evidence for every finding, and generates ready-to-paste
replacement prompts that target the specific failures it found — adapted to
the model you name (GPT, Claude, Gemini, or open-weights).

Everything runs locally. No API calls, no keys, no data leaving your machine.

## How it works

1. **Classify** — rule signals plus embedding prototypes decide the task
   type (summarization, code generation, extraction, Q&A, creative writing,
   reasoning, rewriting) and split pasted source material from the
   instruction.
2. **Score** — each task type gets the parameters the literature assigns it:
   NLI-based faithfulness when source text exists (SummaC method),
   deterministic instruction-following checks (IFEval method), embedding
   relevance (RAGAS-style), readability against the stated audience,
   hallucination-risk signals, static code analysis, style statistics.
3. **Report** — per-parameter verdicts with quotes from the output itself.
   Parameters that local methods cannot judge say so instead of guessing:
   open-world fact checking and subjective quality are labeled as
   judge-mode territory, and proxies are labeled proxies.
4. **Repair** — the flagship. Every diagnosed failure generates a complete
   replacement prompt using the named model family's own documented
   mechanisms (XML tags and quote-first grounding for Claude, delimiters and
   literal phrasing for GPT, few-shot and positive instructions for Gemini,
   constraint repetition for open-weights models).

Every parameter and template traces to a named source — see
[RESEARCH.md](RESEARCH.md).

## Run it

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"     # first run downloads two small models (~350 MB)
.venv/Scripts/uvicorn rubriq.api.main:app --reload
```

`POST /evaluate` with `{"prompt": ..., "output": ..., "model_name": "gpt-4o"}`
returns the full report. `GET /health` shows engine and model status.

Models: `BAAI/bge-small-en-v1.5` (embeddings) and
`cross-encoder/nli-deberta-v3-small` (entailment). Both run CPU-only.

## Tests

```bash
.venv/Scripts/python -m pytest tests -q
```

The suite includes curated prompt/output pairs with known planted failures
(invented facts, broken code, fabricated citations, ignored constraints) and
asserts Rubriq finds each one — plus a documented-limitation test that keeps
the honest boundary of the coverage proxy visible.

## Status

Step 1 (evaluation engine) complete. Frontend and deployment are Step 2.
An LLM-as-judge engine plugs in behind the same `Scorer` interface later.
