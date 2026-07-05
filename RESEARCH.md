# RESEARCH.md — source log for Rubriq's evaluation logic

Every evaluation parameter and every improvement-prompt template in Rubriq
traces back to an entry here. Format per entry: what the source is, what we
took from it, and what we deliberately did not take. Nothing in the scoring
engine is invented in-house; where we had to adapt a method (usually to make
it run locally), the adaptation is stated.

---

## Part 1 — Evaluation methods

### 1.1 SummEval (Fabbri et al., TACL 2021)

Re-annotated 23 summarization systems with expert judgments on four
dimensions: **coherence, consistency, fluency, relevance**. Found ROUGE and
other n-gram metrics correlate weakly with all four (Kendall tau mostly
below 0.3).

**Took:** the four-dimension core taxonomy for summarization, reused across
grounded tasks. Also the license to *not* build ROUGE/BLEU scoring: the paper
is the standard citation for n-gram overlap being a poor quality signal.

**Did not take:** their reference-based setup. Rubriq users rarely have gold
references; our reference is the prompt's own source text.

### 1.2 SummaC (Laban et al., TACL 2022)

Zero-shot factual-consistency detection by splitting the summary and source
into sentences, scoring every (source-sentence, summary-sentence) pair with
an off-the-shelf NLI model, and aggregating the entailment matrix (SummaC-ZS
takes max-over-source then mean-over-summary). Beat trained factuality models
on the SummaC benchmark's six datasets.

**Took:** the entire local faithfulness design. Rubriq's `faithfulness`
metric is SummaC-ZS with `cross-encoder/nli-deberta-v3-small`: sentence-split
the output, entail each sentence against source chunks, aggregate, and report
the *least-supported sentences* as quoted evidence. This is our hallucination
detector whenever source text exists in the prompt.

**Did not take:** SummaC-Conv (the learned convolution layer) — adds a
trained component for a small gain; ZS keeps v1 fully deterministic given the
NLI checkpoint.

### 1.3 RAGAS (Es et al., EACL 2024)

Reference-free RAG evaluation: **faithfulness** (decompose answer into
statements, verify each against retrieved context), **answer relevancy**
(embedding similarity between the question and questions regenerated from
the answer), **context relevance**. Originally LLM-driven.

**Took:** statement-level granularity for faithfulness reporting (we
decompose by sentence, they by LLM-extracted claim — sentence is the honest
local approximation), and the idea that *relevance to the question* is
scoreable by embedding similarity without any reference answer. Rubriq's
`answer_relevance` embeds the prompt's core request and the output and scores
cosine similarity, with per-paragraph drill-down to locate drift.

**Did not take:** the LLM-based statement extraction and verdicts — reserved
for `LLMJudgeScorer`.

### 1.4 TruLens "RAG triad" (TruLens docs, 2023–2025)

Context relevance / groundedness / answer relevance as the minimal triangle
for grounded Q&A: is the context on-topic, is the answer supported by the
context, does the answer address the question.

**Took:** the triad as Rubriq's parameter set for Q&A-with-context tasks —
groundedness maps to our NLI faithfulness, answer relevance to embedding
relevance, and context relevance becomes a *diagnostic* (if the prompt's own
context doesn't cover the question, the improvement prompt says to fix the
context, not the instructions).

### 1.5 G-Eval (Liu et al., EMNLP 2023)

LLM-as-judge with chain-of-thought and form-filling; state-of-the-art
correlation with humans on SummEval dimensions when run with GPT-4. Two
documented failure modes: score clustering (narrow band around 3/5) and a
measurable preference for LLM-written text over human text even when humans
judge the human text better.

**Took:** their per-dimension rubric *definitions* (what "coherence 1–5"
means in words) — these become the rubric text shown in Rubriq's UI and the
grading spec for the future `LLMJudgeScorer`. Also the bias list, which the
UI's honesty copy cites when explaining why judge mode is optional, not
default.

**Did not take:** any runtime LLM dependency (v1 constraint).

### 1.6 MT-Bench / LLM-as-judge biases (Zheng et al., NeurIPS 2023)

Documented judge biases: **position bias** (prefers first answer), 
**verbosity bias** (prefers longer answers), **self-enhancement bias**
(prefers own outputs), and weak math/counting grading.

**Took:** two things. (1) The honesty framing — local deterministic checks
are *more* trustworthy than LLM judges for countable constraints (word
limits, list lengths, format compliance), so Rubriq leads with them.
(2) Verbosity bias inverted into a metric: Rubriq's `conciseness` check
flags output that is much longer than the task warrants, because users
over-trust long answers for the same reason judges do.

### 1.7 HELM (Liang et al., 2022)

Holistic evaluation: every model scored on **multiple metrics
simultaneously** (accuracy, calibration, robustness, fairness, bias,
toxicity, efficiency) rather than one headline number.

**Took:** the reporting philosophy. Rubriq never emits a single overall
score without the per-parameter breakdown; the UI leads with the profile,
not the average. Weighted overall score exists but is explicitly labeled as
a weighted view of the profile.

### 1.8 IFEval (Zhou et al., 2023)

"Instruction-Following Eval": ~25 *verifiable* instruction types (word
counts, keyword inclusion/exclusion, format constraints, casing, bullet
counts...) checked by deterministic programs, no judge needed.

**Took:** the core idea and much of the constraint typology for Rubriq's
`instruction_following` module: we parse the user's prompt for verifiable
constraints (length, format, required/forbidden content, structure, casing,
language) and check each one with code. This is the most defensible metric
in the product and the demo's opening move.

**Adaptation:** IFEval generates prompts with known constraints; Rubriq must
*extract* constraints from arbitrary user prompts. Extraction is
rule/pattern-based and conservative — a constraint is only checked if
extraction is confident, and every checked constraint is shown to the user
so false extractions are visible.

### 1.9 FActScore (Min et al., EMNLP 2023) and fabricated-citation literature

FActScore decomposes generations into atomic facts and verifies each against
a knowledge source — which requires a knowledge source. Without one,
verification is impossible; this is the formal basis for Rubriq's carve-out
#1. Separately, fabricated citations/statistics are a documented LLM failure
pattern (e.g., *Mata v. Avianca* sanctions over invented case law, 2023, and
subsequent studies of citation hallucination rates in GPT-class models).

**Took:** the carve-out's wording (verification needs a source; we don't
have one locally) and the **hallucination risk signal** list for ungrounded
prompts: specific numbers with no source in the prompt, citation-shaped
strings (author-year, case names, DOIs, URLs), superlatives and precise
statistics without attribution, and confidence markers wrapping unverifiable
claims. Each signal is *flagged as risk, never asserted as false* — the UI
wording is "unverifiable here", not "wrong".

### 1.10 Readability and lexical statistics (classic, pre-LLM)

- **Flesch Reading Ease** (Flesch 1948) and **Flesch-Kincaid Grade Level**
  (Kincaid et al. 1975): validated on human text for decades; used as
  audience-fit signals, not quality scores — the target band shifts with
  the stated audience ("explain to a child" vs. "write for clinicians").
- **MTLD** (McCarthy & Jarvis 2010): lexical diversity robust to text
  length, unlike raw type-token ratio. Used in the creative-writing proxy
  bundle and in repetition detection.
- **Coh-Metrix** tradition (Graesser et al. 2004): connective density and
  referential cohesion (noun/argument overlap between adjacent sentences) as
  computable coherence proxies. Rubriq's `coherence_proxy` uses embedding
  similarity between adjacent sentences/paragraphs (too low = disjointed,
  too high = repetitive) plus connective counts — labeled as a proxy per
  carve-out #2.

### 1.11 HumanEval (Chen et al., 2021) and static code analysis

pass@k on executed unit tests is the gold standard for code quality — and
requires execution, which Rubriq v1 won't do on arbitrary pasted code
(safety and dependency reasons, logged as a trade-off).

**Took:** the honesty note (static ≠ executed) and the static-check ladder
for the code-generation task type: does it parse (`ast` for Python, brace/
bracket balance heuristics otherwise), are requested functions/classes
present, docstrings/comments if requested, imports plausible, no obvious
placeholder stubs (`TODO`, `your_api_key_here`, `...` bodies) — each check
quoted with line evidence.

### 1.12 DeepEval (Confident AI docs, 2024–2026)

Open-source eval library; its metric catalog (answer relevancy, faithfulness,
hallucination, toxicity, summarization, custom G-Eval) is a practical map of
what practitioners measure.

**Took:** naming conventions and the metric → task mapping sanity check: our
taxonomy's coverage was cross-checked against DeepEval's catalog so no
standard metric is missing without a logged reason. (Toxicity: deferred —
needs either a lexicon with high false-positive rates or a local classifier;
logged in future work.)

---

## Part 2 — Prompting guidance (source base for the improvement-prompt library)

### 2.1 Anthropic prompt engineering documentation (docs.anthropic.com)

Techniques with documented rationale: be clear and direct; use examples
(multishot); let Claude think (chain-of-thought); **use XML tags to
structure prompts**; give Claude a role via system prompt; prefill the
response to control format; for long context, put documents first and
instructions after, and ask for quote extraction before analysis.

**Took:** the Claude-family template variants: XML-tag structuring for any
format/faithfulness failure, quotes-first repair for grounded-task
faithfulness failures, prefill-style "start your response with..." for
format failures, role assignment for tone/audience failures.

### 2.2 OpenAI prompt engineering guide (platform.openai.com)

Six strategies: write clear instructions (include details, adopt a persona,
use delimiters, specify steps, provide examples, specify output length);
provide reference text; split complex tasks; give the model time to think;
plus GPT-4.1-era guidance that newer GPT models follow instructions more
*literally* — vague prompts that older models guessed through now fail.

**Took:** GPT-family template variants: delimiter-based structuring (###,
triple quotes), explicit step decomposition for reasoning failures,
reference-text-first for faithfulness failures, and the literalness note
baked into GPT-specific phrasing ("state the requirement explicitly; do not
rely on implication").

### 2.3 Google Gemini prompting guidance (ai.google.dev)

Emphases: few-shot examples over zero-shot for format control (explicitly
"always include examples" in their 101 guide), put context before the
question, specify output format in the instruction, break down complex
prompts, and prefer positive instructions ("do X") over prohibitions
("don't do Y") — Gemini docs note prohibitions are followed less reliably.

**Took:** Gemini-family variants: few-shot insertion as the first-line fix
for format failures, context-then-question ordering, positive-instruction
rewrites of "don't"-style constraints.

### 2.4 Chain-of-thought (Wei et al., NeurIPS 2022) and zero-shot CoT (Kojima et al., NeurIPS 2022)

Reasoning traces improve multi-step accuracy in large models; "Let's think
step by step" captures a chunk of the gain without exemplars. Later caveat
(documented in both papers' follow-ups and provider docs): CoT helps
reasoning/math tasks and does little or harms brevity-sensitive tasks.

**Took:** CoT insertion as the primary template for *reasoning* failure
modes only — gated by task type, never a universal suggestion. Templates
request the reasoning *before* the answer, matching provider guidance that
answer-first negates the benefit.

### 2.5 Self-consistency (Wang et al., ICLR 2023)

Sampling multiple reasoning paths and majority-voting improves accuracy
substantially on arithmetic/commonsense benchmarks.

**Took:** offered in reasoning-failure templates as a "if the model keeps
getting this wrong" escalation: ask the same question multiple times or
request the model produce two independent derivations and reconcile — the
manual, no-API rendering of the technique.

### 2.6 Few-shot example selection and ordering (Liu et al. 2022 "What Makes Good In-Context Examples"; Lu et al. 2022 "Fantastically Ordered Prompts")

Semantically similar exemplars beat random ones; example *order* alone
swings accuracy by double digits; recency bias means the last example
dominates.

**Took:** few-shot templates always instruct: pick examples similar to the
real input, put the most representative one last, and keep formats
identical across examples. Every few-shot template in the library carries
these three rules inline.

### 2.7 Lost in the Middle (Liu et al., TACL 2024)

Models retrieve information best from the start and end of long contexts;
middle placement degrades sharply.

**Took:** for faithfulness/completeness failures on long-source tasks, the
repair template moves critical instructions and the most important source
material to the edges of the prompt and repeats key constraints at the end.

### 2.8 Role/system prompting (provider docs; Zheng et al. 2023 persona analysis)

Provider docs recommend role assignment for tone and domain register;
academic results on *accuracy* gains are mixed (personas reliably shift
style, unreliably shift correctness).

**Took:** role-prompt templates are generated for tone/audience/style
failures only — never sold as an accuracy fix. The template text says what
it does: "this controls register, not correctness."

---

## Part 3 — Derived parameter taxonomy (task type → parameters → source)

| Task type | Parameters (source) |
|---|---|
| Summarization | faithfulness (1.2), relevance/coverage (1.1, 1.3), coherence proxy (1.10), conciseness (1.6), instruction following (1.8), fluency stats (1.10) |
| Q&A — grounded | groundedness (1.4/1.2), answer relevance (1.3/1.4), instruction following (1.8), completeness vs. question parts (1.8 adaptation) |
| Q&A — open-world | hallucination risk signals (1.9) **[verification carve-out]**, answer relevance (1.3), structure/directness (1.6), instruction following (1.8) |
| Code generation | static validity ladder (1.11) **[execution carve-out]**, instruction following (1.8), completeness vs. requested components (1.11), explanation quality if requested (1.10) |
| Creative writing | proxy bundle: lexical diversity/MTLD, cliché density, rhythm variance (1.10) **[subjective carve-out]**, instruction following (1.8), audience fit (1.10) |
| Extraction | schema/format compliance (1.8), faithfulness to source (1.2), completeness vs. source entities (1.2 adaptation), no-invention check (1.9) |
| Reasoning | instruction following (1.8), structure of derivation (2.4 rubric), internal consistency signals (1.9), answer presence/directness (1.6) |
| Rewriting/editing | meaning preservation (embedding similarity, 1.3), instruction following (1.8), register shift verification (1.10 readability delta) |
| General/chat | instruction following (1.8), relevance (1.3), structure (1.10), hallucination risk (1.9) |

Weights default to equal within a task, user-adjustable behind Advanced
(per brief). Carve-out parameters render with an explicit "proxy" or
"risk-signal" badge.

---

## Part 4 — Improvement-prompt library design

Keyed by **failure mode × task type × model family**, per the brief.

Failure modes (each detected by a Part-1 metric, each mapped to Part-2
repairs): `unfaithful_content`, `hallucination_risk`, `missed_constraint`
(with constraint subtype), `incomplete_coverage`, `off_topic_drift`,
`poor_structure`, `wrong_register`, `verbosity`, `weak_reasoning`,
`format_violation`, `low_diversity` (creative), `invalid_code`,
`invented_fields` (extraction).

Model families and quirk profiles (from 2.1–2.3 plus provider release
notes): `claude` (XML tags, prefill, quotes-first, thinking room),
`gpt` (delimiters, literal instruction following, steps, system message),
`gemini` (few-shot first, context-before-question, positive instructions),
`llama`/`mistral`/open-weights (explicit format spec, shorter instructions,
repeat constraints at end — smaller instruction-following headroom),
`generic` (provider-agnostic fallback used when the user names no model).

Template contract (enforced by tests): every generated prompt must
(a) name the diagnosed failure with the evidence quote that triggered it,
(b) contain a concrete rewritten prompt or prompt fragment, ready to paste,
(c) use the named model family's mechanism, not generic advice. "Be more
specific" or any template that could apply to every failure is a bug.

---

## Checkpoint decisions locked by this research

- Embedding model: `BAAI/bge-small-en-v1.5` — small enough for laptop CPU,
  measurably stronger than MiniLM-class at similar latency (MTEB and
  independent 2025–26 benchmark roundups).
- NLI model: `cross-encoder/nli-deberta-v3-small` — SNLI+MNLI cross-encoder,
  hundreds of ms per pair on CPU, the sbert-documented checkpoint family for
  entailment scoring (SummaC's method).
- No ROUGE/BLEU anywhere (1.1).
- No toxicity metric in v1 (logged: future work, needs a proper classifier).
- No code execution in v1 (1.11; static ladder instead).
