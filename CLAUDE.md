# Rubriq

LLM output quality evaluator. Name chosen at Checkpoint 1 (2026-07-05);
rubric-driven scoring is the method, the -q makes it ownable. Repo:
`devadit1515/rubriq`. Owner: Devadit (EXL intern, GitHub `devadit1515`). Claude Code acts as senior engineering partner. The
deliverable is a working product demoed to the mentor in ~10 minutes; every
decision optimizes for (1) depth and correctness of evaluation logic,
(2) demo polish.

## What it does

Web app. User pastes the prompt they gave an LLM and the output they got back,
optionally names the provider/model (GPT-4o, Claude, Gemini, Llama, ...). The
app then:

1. Classifies the task (summarization, code generation, creative writing,
   Q&A, extraction, reasoning, ...).
2. Selects evaluation parameters fitting that task, drawn from established
   evaluation research — never invented here.
3. Scores the output against each parameter.
4. Reports strengths and failures per parameter, with evidence quoted from
   the output itself.
5. Generates ready-to-paste improvement prompts targeted at the specific
   failures found, adapted to the named model's quirks and its provider's own
   prompting guidance. **This is the flagship feature** and gets most of the
   research effort. Generic advice ("be more specific") is a failure state;
   every generated prompt must name the diagnosed problem and fix it.

## Hard constraints

- Text in, text out. No images, audio, video.
- **v1 calls no external LLM API.** Scoring is deterministic and statistical:
  rubric checks, readability and structure metrics, semantic similarity via a
  local embedding model, instruction-following checks against the original
  prompt, hallucination heuristics — whatever the literature supports. The UI
  is honest about what local scoring can and cannot judge.
- Scoring engine sits behind an adapter interface so an LLM-as-judge mode
  plugs in later: free tier (user's own API key) and paid tier (our key).
  Build the interface now, not the billing.
- Document evaluation (grading edited documents): include only if it falls
  out of the text pipeline nearly for free; otherwise skip and log as future
  work here.
- Customization: sensible defaults everywhere; advanced options (parameter
  weights, audience, tone expectations, custom rubrics) collapsed behind an
  "advanced" section.

## Feasibility ruling (Step 0a, answered 2026-07-05)

**Yes — full version achievable at high quality locally**, with two carve-outs
that the UI labels explicitly and the adapter unlocks later:

1. **Open-world factual accuracy.** When the prompt contains no source text,
   no local method verifies output claims against world knowledge. v1 instead
   surfaces *hallucination risk signals* (unsupported specificity, uncited
   statistics, fabricated-citation patterns) and says plainly that
   verification needs a judge model.
2. **Deep subjective quality** (creativity, humor, emotional resonance). v1
   scores proxies only (lexical diversity, cliché density, rhythm variance)
   and labels them as proxies.

What IS fully local and strong: task classification (embeddings + rules),
deterministic instruction-following checks (word limits, format, required/
forbidden content — more reliable than LLM judges on counting constraints),
readability/structure/fluency statistics, NLI-based faithfulness whenever the
source text is in the prompt (the RAGAS/SummaC approach, DeBERTa-class local
model), and the entire improvement-prompt template library.

## Architecture decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Backend language | Python (FastAPI) | sentence-transformers and NLI models are Python-native; the evaluation engine is the product's core, so the backend follows the ML ecosystem. |
| Local models | `BAAI/bge-small-en-v1.5` (embeddings) + `cross-encoder/nli-deberta-v3-small` (NLI) | Locked 2026-07-05 after research: bge-small beats MiniLM-class on quality at the same CPU latency class; nli-deberta-v3-small is the sbert-documented entailment cross-encoder, CPU-viable, which SummaC-style faithfulness needs. See RESEARCH.md. |
| No ROUGE/BLEU | n-gram metrics excluded everywhere | SummEval showed weak human correlation; embedding + NLI methods used instead. |
| No code execution in v1 | static analysis ladder for code tasks | Executing arbitrary pasted code is a safety/dependency problem; HumanEval-style pass@k logged as judge-mode-era future work. |
| No toxicity metric in v1 | deferred | Lexicon approaches false-positive heavily; a proper local classifier is future work. |
| Scoring adapter | `Scorer` interface with `LocalScorer` now; `LLMJudgeScorer` later (BYO-key free tier, our-key paid tier) | Required by brief. Interface lands in Step 1. |
| Frontend | Decided at Step 2 (leaning React/Next.js + Vercel) | Not needed before Checkpoint 2. |
| Document evaluation | Deferred decision until the text pipeline exists | Include only if nearly free per brief. |

Log every future trade-off decision in this table with reasoning; don't stall
on non-checkpoint choices.

## Research protocol

Before evaluation code is written, ground every parameter and every
improvement-prompt template in named sources, logged in `RESEARCH.md`
(source → what we took from it). Minimum reading list:

- Evaluation: G-Eval, RAGAS, DeepEval, TruLens, HELM, MT-Bench / LLM-as-judge
  rubrics, classic NLG metrics (coherence, fluency, faithfulness, relevance)
  and their known failure modes, SummaC / NLI-based faithfulness.
- Prompting: Anthropic prompt engineering docs, OpenAI guide, Google Gemini
  guidance, chain-of-thought / few-shot selection / role-prompting papers.
  Distilled into a template library keyed by
  **failure mode × task type × model family**.

## Order of work and checkpoints

Work autonomously between checkpoints; stop and wait at each one.

- **Step 0** (done except name pick): feasibility ruling, this file,
  5–8 name proposals.
- **CHECKPOINT 1** — user picks name and renames folder; then create public
  GitHub repo under `devadit1515` named after it and push.
- **Step 1** — research (RESEARCH.md), task classifier, parameter taxonomy,
  scoring engine, improvement-prompt generator, tests proving sensible
  behavior on sample prompt/output pairs.
- **CHECKPOINT 2** — user reviews, sets up Supabase, hands over credentials.
- **Step 2** — frontend and deployment (recommend Vercel or better, with
  reasoning). Only after go-ahead.

## Standing rules

- Commit after every meaningful unit of work, clear messages, no batching.
- Real trade-off? Pick one, log it here, move on — unless it's a checkpoint.
- "Done" bar for any feature: comfortable demoing it to the mentor yourself.

## Project state

- 2026-07-05 — Step 0 complete: feasibility answered (yes, two carve-outs),
  CLAUDE.md created, names proposed.
- 2026-07-05 — **Checkpoint 1 passed**: name = Rubriq. Folder rename deferred
  by user (still `LLM Quality` on disk — harmless, git doesn't care). Repo
  `devadit1515/rubriq` created and pushed. **Step 1 underway**: research →
  RESEARCH.md → classifier → taxonomy → scoring engine → prompt generator →
  tests. Next stop: Checkpoint 2 (user review + Supabase credentials).

## Future work log

- Document evaluation: pending pipeline-cost assessment during Step 1.
