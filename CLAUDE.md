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
| Question coverage is a topical proxy | flag a question part only when its topic/keywords are absent from the output | Empirically verified (2026-07-05) that bi-encoder similarity cannot distinguish "mentioned" from "answered" (unanswered part scored 0.65 vs answered 0.59). Labeled is_proxy, limitation documented in a dedicated test; true answerhood is judge-mode work. |
| Scoring adapter | `Scorer` interface with `LocalScorer` now; `LLMJudgeScorer` later (BYO-key free tier, our-key paid tier) | Required by brief. Interface lands in Step 1. |
| Frontend | Vite + React + TypeScript + Tailwind; Framer Motion for animation, Lenis for scroll | Rebuilt ground-up in the 2026-07-05 "Instrument" redesign, replacing the vanilla-JS static UI. Vite keeps the toolchain lean and the bundle small (112KB gzip). |
| 3D instrument | CSS/SVG precision dial, not React Three Fiber | The brief specced an R3F refractive lens; a CSS/SVG gauge holds 60fps on every device, adds no bundle weight, works offline, and keeps the score and the repair prompt as the only two dominant elements. R3F logged as optional progressive enhancement. |
| Display typeface | Bricolage Grotesque (variable), paired with JetBrains Mono | Geist was the first pick but now reads as an AI-UI default; Bricolage is a grotesk with more character and dodges that tell. Both self-hosted, no CDN. |
| Frontend↔engine wiring | The app calls relative paths; Vercel rewrites and the Vite dev proxy forward to the HF Space | Removes CORS and per-environment API-base config. Replaces the old `config.js` origin detection. |
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
  `devadit1515/rubriq` created and pushed.
- 2026-07-05 — **Step 1 complete**: RESEARCH.md (all sources logged),
  classifier (rules + bge prototypes + source split), IFEval-style constraint
  engine, metric modules (SummaC-ZS faithfulness, relevance, readability,
  lexical, hallucination signals, static code ladder), Scorer adapter +
  LocalScorer, improvement-prompt generator (failure × task × model family),
  FastAPI app, 44 tests green on curated planted-failure pairs. Demo pair
  verified end-to-end: sabotaged summary scores 33/100 with all four planted
  fabrications quoted.
- 2026-07-05 — **Step 2 (frontend) built on user's direct go-ahead**
  (Supabase deferred; slot it in when credentials arrive). Impeccable init
  done: PRODUCT.md + DESIGN.md. web/ is a no-build static SPA (IBM Plex
  Sans + JetBrains Mono, OKLCH green-ink lab-report system), served by
  FastAPI locally and battle-tested with Playwright at desktop/mobile.
  Hosting decision: **frontend → Vercel, engine → HF Spaces Docker**
  (Render free tier's 512MB can't hold torch + DeBERTa; HF free tier has
  16GB). Dockerfile + README Space frontmatter + web/vercel.json ready;
  DEPLOY.md has the runbook.
- 2026-07-05 — **DEPLOYED.** Frontend: https://rubriq-liard.vercel.app
  (Vercel, project `rubriq`, account devadit1515). Engine:
  https://devadit15-rubriq.hf.space (HF Space devadit15/rubriq, Docker,
  models baked in, free tier — sleeps after ~48h idle, UI pill handles the
  wake). Live E2E verified: sabotaged-summary sample scores 33 with 4
  repair cards through the deployed stack. Redeploy: `git push hf main`
  (engine; needs HF auth) / `npx vercel deploy --prod --yes` from web/
  (frontend). User's HF token was pasted in chat — advise revoke + re-auth
  via `hf auth login` when next needed. Still open: mentor review +
  Supabase (deferred Checkpoint 2 items).
- 2026-07-05 — **Frontend rebuilt ground-up — "The Instrument" redesign.**
  The vanilla-JS static UI is gone; `web/` is now a Vite + React + TypeScript +
  Tailwind app. Framer Motion drives the animation (17 tagged capabilities),
  Lenis the scroll, a CSS/SVG dial the one instrument. Visual system is
  "Obsidian & Ink": a single dark field, a green-ink jewel accent, frosted-glass
  panels, Bricolage Grotesque over JetBrains Mono. Two states morph into each
  other — the intake (idle dial, two paste fields, sample specimens, one lit
  Evaluate key) and the verdict (a settling-needle score, a read-and-illuminate
  specimen that anchors each quoted phrase to its finding, severity-weighted
  parameter cards, and the self-assembling repair prompt as the climax). The
  engine and its response contract were not touched: the UI derives the
  weak/mixed/strong tiers from the numeric score and renders
  `improvement_prompts[0]` as the single cure. Real `EvalReport` JSON captured
  from the live engine for all four samples ships as offline fixtures, so the
  demo is identical when the Space sleeps. Vercel serves the built `dist` and
  rewrites `/evaluate`, `/health`, `/warmup` to the HF Space, so the app makes
  same-origin calls and `config.js` is gone. Bundle is 112KB gzip. Verified
  in-browser at desktop and mobile, plus reduced-motion, the offline fallback,
  the error path, and copy-to-clipboard. Engine deploy unchanged; a frontend
  change needs only `npx vercel deploy --prod --yes` from `web/`.

## Future work log

- Document evaluation: pending pipeline-cost assessment during Step 1.
