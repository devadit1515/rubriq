# Design

Visual system for Rubriq. Register: product (see PRODUCT.md). Mood: forensic
lab bench — verdicts in green ink on white paper, evidence under glass.

## Color

Strategy: **Restrained.** Pure white surface; one deep green carries the
brand; semantic colors appear only on verdicts and states. OKLCH throughout.

```css
--bg:        oklch(1.000 0.000 0);      /* pure white, no hidden warmth   */
--surface:   oklch(0.972 0.004 140);    /* panels, input pane             */
--surface-2: oklch(0.945 0.006 140);    /* wells, code/evidence beds      */
--ink:       oklch(0.230 0.015 140);    /* body text, ~13:1 on bg         */
--muted:     oklch(0.470 0.018 140);    /* secondary text, ≥4.5:1 on bg   */
--line:      oklch(0.885 0.008 140);    /* hairline borders               */
--primary:   oklch(0.480 0.100 140);    /* verdict green: buttons, links, brand */
--primary-ink: oklch(0.980 0.005 140);  /* text on primary fills          */
--accent:    oklch(0.400 0.075 255);    /* slate-blue: info, model-family badges */
/* semantic verdicts — never color-alone; always paired with icon/label   */
--good:      oklch(0.480 0.100 140);    /* shares primary hue: pass IS the brand */
--warn:      oklch(0.560 0.120 75);     /* amber: partial, proxy caveats  */
--bad:       oklch(0.505 0.160 25);     /* oxide red: failures            */
--judge:     oklch(0.400 0.075 255);    /* "requires judge" carve-outs    */
```

Dark mode: none in v1 (projector demo + long-form reading; logged trade-off).

### Instrument console (2026-07-05 redesign)

The input pane is a dark instrument console; the report stays white paper.
The split IS the brand: you operate the dark machine, it prints a light
document.

```css
--console:      oklch(0.180 0.020 150);  /* pane bg                    */
--console-2:    oklch(0.225 0.022 150);  /* input wells, dropdowns     */
--console-line: oklch(0.330 0.022 150);
--console-ink:  oklch(0.935 0.008 140);  /* ~12:1 on console           */
--console-mut:  oklch(0.720 0.020 145);  /* labels, ~6:1 on console    */
--led:          oklch(0.760 0.150 148);  /* phosphor green: LED, focus,
                                            evaluate fill (dark text)  */
--led-dim:      oklch(0.320 0.060 148);  /* selected wells             */
```

Console field labels are JetBrains Mono 11px uppercase tracked +0.09em —
instrument etching. This amends the "mono = verbatim only" rule: mono is
verbatim material in the REPORT; on the CONSOLE it is the control-label
voice. Two surfaces, two mono roles, both deliberate.

## Typography

- **UI + prose**: IBM Plex Sans (variable, self-hosted woff2). Weights
  400/500/600-650. Chosen over Inter deliberately: Plex's technical-document
  heritage fits the forensic register, and Inter is the saturated AI default.
- **Evidence, scores, code**: JetBrains Mono 400/600. Monospace is reserved
  for verbatim material — quoted evidence, scores, code, the repair prompts.
  That reservation IS the brand: if it's mono, Rubriq is quoting, not talking.
- Fixed rem scale, ratio ~1.2: 12.5 / 14 / 15 / 17 / 20 / 24 / 34px.
  Body 15px/1.6. Report headings 17-20px. Wordmark 20px 600.
- Prose ≤ 70ch. Tables/dense rows may run wider.

## Layout

- App shell: slim top bar (wordmark, engine status pill, GitHub link),
  then a two-pane split: input pane (~420px, `--surface`) left, report pane
  (white, scrollable) right. Under 960px the panes stack, input first.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Radius: 6px controls, 10px panels. Hairline `--line` borders; shadows only
  on overlays (toast, menus).
- z-scale: dropdown 10 · sticky 20 · toast 40.

## Components

- **Score meter**: 64px mono number + thin horizontal track (not a card,
  not a ring per row). Fill color by band: ≥80 good / ≥55 warn / <55 bad,
  with the band word ("strong / mixed / weak") printed beside it.
- **Verdict row**: parameter name + source citation superscript, meter,
  verdict sentence; expands (native `<details>`) to strengths + findings.
- **Evidence quote**: `--surface-2` bed, JetBrains Mono 13px, left-set
  quotation glyph, "from the output / from your prompt" tag. Full border,
  never a side-stripe.
- **Badges**: PROXY (warn outline), NEEDS JUDGE (judge outline), task chip
  (primary outline). 11px caps, 500 weight — the one sanctioned small-caps
  use; never as section eyebrows.
- **Repair card**: title + diagnosis prose, mono prompt block with sticky
  Copy button, model-family badge (accent), technique source footnote.
- **Empty state**: teaches by doing — three sample pairs as one-click chips
  ("Sabotaged summary", "Broken code", "Confident nonsense") plus a short
  line on what local scoring can/can't judge.
- **Loading**: skeleton verdict rows in the report pane; never a centered
  spinner.
- Buttons: primary = filled `--primary` with `--primary-ink` text; secondary
  = hairline outline. All controls: visible focus ring
  (`2px solid --primary`, 2px offset), disabled at 45% with cursor guard.

## Motion

**Rule: all JS animation runs through the self-hosted Motion library**
(`web/vendor/motion.js`, v12.42.2, global `Motion`), and the surface must
use **at least 15 distinct Motion features**, each tagged `M<N>` in app.js
with the inventory at the top of the file. Current inventory: keyframe
arrays, springs, stagger, stagger-from-center, timeline sequences,
raw-value count-up, inView, scroll-linked progress, hover(), press(),
playback controls (.stop/.finished), independent transform channels,
custom bezier arrays, SVG dashoffset gauge sweep, exit-before-swap,
stagger startDelay, blur-as-material.

Energy: demo-theatrical on the report arrival (the set piece: masthead
rises, gauge sweeps + counts up, verdict rows cascade, meters spring when
seen, repair card develops into focus). Everything else stays 150-250ms.
Base ease `cubic-bezier(0.22, 1, 0.36, 1)`.

`prefers-reduced-motion`: the FX flag gates every Motion call; reduced
users get final states instantly. Content is never hidden pre-animation —
a script failure leaves a fully readable page.
