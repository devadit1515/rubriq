# Product

## Register

product

## Users

Developers, prompt engineers, and analysts who just got a disappointing LLM
output and want to know what exactly went wrong and how to fix the prompt.
They arrive mid-task with two blobs of text on the clipboard. Secondary but
critical user: Devadit demoing to his EXL mentor on a projector for ten
minutes — the interface must read from across a room and never require
explanation.

## Product Purpose

Rubriq scores a pasted prompt/output pair against evaluation parameters from
published research, quotes the evidence for every finding, and generates
paste-ready repair prompts adapted to the model that produced the output.
Everything runs locally — the honesty about what local scoring can and
cannot judge is a core feature, not fine print. Success: a user pastes a
pair, understands the verdict profile in seconds, and leaves with a repair
prompt on their clipboard.

## Brand Personality

Forensic, precise, calm. A pathology report, not a dashboard: verdicts in
green ink on white paper, evidence under glass. The interface asserts what
it can prove, flags what it cannot, and never decorates. Quoted text is
sacred — always verbatim, always visually distinct.

## Anti-references

- SaaS-cream analytics dashboards: hero metrics, gradient accents, KPI tiles.
- Hacker/terminal aesthetics: all-mono, neon-on-black. (Considered and
  rejected by the owner — too costume-y for a tool claiming rigor.)
- AI-chat products: bubbles, sparkle icons, "magic" language. Rubriq is the
  skeptic that checks AI, so it must not look like AI marketing.
- Grading-app gamification: confetti, letter grades, celebratory motion.

## Design Principles

1. **The profile is the star, never the average.** Per-parameter verdicts
   lead; the overall score is a small summary, not a hero number (HELM's
   reporting philosophy, which the engine itself follows).
2. **Every claim shows its receipt.** Findings quote the output; parameters
   cite their research source; repair prompts name the diagnosed failure.
   If the UI states something, the evidence is one glance away.
3. **Honesty is a first-class surface.** Proxy badges, judge-mode carve-outs,
   and skipped checks render as designed elements, not disclaimers in gray 7px.
4. **Disappear into the task.** Paste, evaluate, read, copy. No onboarding
   tour, no settings hunt; advanced options fold away until wanted.
5. **Motion states, never decorates.** Report arrival, score fill, copy
   confirmation — feedback only, 150-250ms, reduced-motion respected.

## Accessibility & Inclusion

WCAG 2.1 AA. Body text ≥4.5:1; score semantics never carried by color alone
(icons + labels accompany pass/warn/fail). Full keyboard operability for the
evaluate flow and copy actions. `prefers-reduced-motion` honored everywhere.
Projector legibility: minimum 14px effective text in the report pane.
