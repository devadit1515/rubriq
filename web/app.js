/* Rubriq frontend. No framework, no build step — state machine + renderers.

   MOTION INVENTORY — every JS animation runs through the self-hosted Motion
   library (vendor/motion.js, v12.42.2, global `Motion`). Site rule: at least
   15 distinct Motion features in use, each tagged M<N> where it's used:
     M1  animate() multi-step keyframe arrays
     M2  spring physics (type:"spring", tuned stiffness/damping)
     M3  stagger() for list choreography
     M4  stagger(..., {from:"center"}) origin control
     M5  timeline sequences: animate([[el,...],[el,...]]) with `at` offsets
     M6  raw-value animation: animate(0, n, {onUpdate}) score count-up
     M7  inView() viewport-triggered reveals (with amount option)
     M8  scroll() hardware-accelerated scroll-linked reading progress
     M9  hover() gesture with spring-back
     M10 press() gesture feedback
     M11 playback controls: .stop(), await .finished
     M12 independent transform channels (x/y/scale animated separately)
     M13 custom cubic-bezier easing arrays
     M14 SVG stroke-dashoffset gauge sweep
     M15 exit animation before DOM replacement (skeleton out)
     M16 per-stagger startDelay offsets inside a sequence
     M17 filter/blur as a motion material (repair card entrance)
   All of it is gated on prefers-reduced-motion: reduced users get final
   states instantly, and content is never hidden without JS running. */
(() => {
  "use strict";

  // ---------- API base ----------
  const qp = new URLSearchParams(location.search).get("api");
  if (qp) localStorage.setItem("rubriq_api", qp.replace(/\/+$/, ""));
  const API = (qp && qp.replace(/\/+$/, ""))
    || localStorage.getItem("rubriq_api")
    || window.RUBRIQ_API
    || "";

  // ---------- motion setup ----------
  const M = window.Motion || null;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FX = M && !REDUCED;                 // animate only when allowed & loaded
  const EASE_OUT = [0.22, 1, 0.36, 1];      // M13 custom bezier (ease-out-quint)
  const SPRING_FILL = { type: "spring", stiffness: 120, damping: 20 };   // M2
  let liveAnimations = [];                  // M11: stopped on every re-render
  function stopLive() {
    liveAnimations.forEach((a) => { try { a.stop(); } catch { /* already done */ } });
    liveAnimations = [];
  }
  function track(anim) { if (anim) liveAnimations.push(anim); return anim; }

  // ---------- elements ----------
  const $ = (id) => document.getElementById(id);
  const form = $("evalForm");
  const reportPane = $("reportPane");
  const evalBtn = $("evalBtn");
  const enginePill = $("enginePill");
  const engineLabel = $("engineLabel");
  const toast = $("toast");

  // ---------- utilities ----------
  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  const band = (score) =>
    score >= 80 ? ["good", "strong"] : score >= 55 ? ["warn", "mixed"] : ["bad", "weak"];

  const TASK_LABELS = {
    summarization: "Summarization", qa_grounded: "Q&A · grounded in source",
    qa_open: "Q&A · open-world", code_generation: "Code generation",
    creative_writing: "Creative writing", extraction: "Extraction",
    reasoning: "Reasoning", rewriting: "Rewriting / editing", general: "General",
  };
  const MODE_LABELS = {
    unfaithful_content: "unfaithful", hallucination_risk: "unverifiable",
    missed_constraint: "constraint missed", incomplete_coverage: "incomplete",
    off_topic_drift: "off-topic", poor_structure: "structure",
    wrong_register: "register", verbosity: "verbose", weak_reasoning: "reasoning",
    format_violation: "format", low_diversity: "flat style",
    invalid_code: "invalid code", invented_fields: "invented data",
  };
  const FAMILY_LABELS = {
    claude: "Claude technique", gpt: "GPT technique", gemini: "Gemini technique",
    open_weights: "open-weights technique", generic: "model-agnostic",
  };

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    if (FX) track(M.animate(toast, { opacity: [0, 1], y: [8, 0] }, { duration: 0.2, ease: EASE_OUT }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  }

  // ---------- engine status ----------
  let engineReady = false;
  function ledBlink() {
    // M1: multi-step keyframe array — the "instrument comes online" double blink
    if (!FX) return;
    const dot = enginePill.querySelector(".engine-dot");
    track(M.animate(dot, { opacity: [1, 0.2, 1, 0.2, 1], scale: [1, 1.5, 1] },
      { duration: 0.7, ease: "easeOut" }));
  }
  async function checkHealth(retries = 0) {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const ok = data.models && data.models.embeddings && data.models.nli;
      const wasReady = engineReady;
      engineReady = true;
      enginePill.dataset.state = "ready";
      engineLabel.textContent = ok ? "local engine · models ready" : "engine up · models loading";
      if (ok && !wasReady) ledBlink();
      if (!ok && retries < 20) setTimeout(() => checkHealth(retries + 1), 6000);
    } catch {
      if (retries === 0) {
        enginePill.dataset.state = "waking";
        engineLabel.textContent = "waking the engine…";
      }
      if (retries < 40) setTimeout(() => checkHealth(retries + 1), 5000);
      else { enginePill.dataset.state = "down"; engineLabel.textContent = "engine unreachable"; }
    }
  }

  // ---------- states ----------
  function renderEmpty() {
    stopLive();
    reportPane.innerHTML = `
      <div class="report-empty">
        <h1>Paste a prompt and the output it produced.<br>Rubriq shows you what the model got right — with receipts.</h1>
        <p>The output is scored against evaluation parameters from published research,
           chosen to fit the task it detects. Every finding quotes the text that triggered it,
           and every diagnosed failure feeds one repair prompt you can paste straight back
           into the model that misbehaved.</p>
        <p>Fastest way to see it: load a sample from the console — each one has planted,
           known failures.</p>
        <div class="empty-honesty">
          <strong>What local scoring can and cannot judge.</strong>
          Faithfulness to a source, instruction compliance, structure, and style statistics
          are checked locally with published methods — no API calls, nothing leaves this machine.
          Open-world fact checking and subjective quality need a judge model; Rubriq labels
          those honestly instead of guessing.
        </div>
      </div>`;
    if (FX) {
      track(M.animate(reportPane.querySelector(".report-empty"),
        { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, ease: EASE_OUT }));
    }
  }

  function renderSkeleton(note) {
    stopLive();
    reportPane.innerHTML = `
      <div class="report">
        <p class="skel-note">${esc(note || "Classifying the task and running the parameter suite…")}</p>
        ${'<div class="skel-row"></div>'.repeat(5)}
      </div>`;
    if (FX) {
      // M3: stagger the skeleton rows in
      track(M.animate(reportPane.querySelectorAll(".skel-row"),
        { opacity: [0, 1], y: [6, 0] },
        { delay: M.stagger(0.05), duration: 0.25, ease: EASE_OUT }));
    }
  }

  function renderError(message, hint) {
    stopLive();
    reportPane.innerHTML = `
      <div class="report-error" role="alert">
        <h2>Evaluation failed</h2>
        <p>${esc(message)}</p>
        ${hint ? `<p style="margin-top:8px">${hint}</p>` : ""}
      </div>`;
    if (FX) {
      // M12: independent transform channels — x shake while opacity settles
      track(M.animate(reportPane.querySelector(".report-error"),
        { x: [0, -6, 6, -3, 0], opacity: [0, 1] }, { duration: 0.4, ease: "easeOut" }));
    }
  }

  // ---------- report rendering ----------
  const GAUGE_R = 37;
  const GAUGE_C = 2 * Math.PI * GAUGE_R;

  function evidenceHtml(ev) {
    const tag = ev.source === "prompt" ? "from your prompt" : "from the output";
    const note = ev.note ? ` · ${esc(ev.note)}` : "";
    return `<blockquote class="evidence"><span class="ev-tag">${tag}${note}</span>${esc(ev.quote)}</blockquote>`;
  }

  function findingHtml(f) {
    return `
      <div class="finding">
        <div class="finding-head">
          <span class="finding-mode">${esc(MODE_LABELS[f.failure_mode] || f.failure_mode)}</span>
          <span class="finding-detail">${esc(f.detail)}</span>
        </div>
        ${(f.evidence || []).map(evidenceHtml).join("")}
      </div>`;
  }

  function verdictHtml(p) {
    const skipped = p.score === null || p.score === undefined;
    const badges =
      (p.is_proxy ? '<span class="badge badge-proxy">PROXY</span>' : "") +
      (p.requires_judge ? '<span class="badge badge-judge">NEEDS JUDGE</span>' : "");

    let meter;
    if (skipped) {
      meter = `<div class="v-meter"><span class="v-score skipped">—</span>
        <div class="v-track"></div><span class="v-bandword" style="color:var(--muted)">skipped</span></div>`;
    } else {
      const [b, word] = band(p.score);
      meter = `<div class="v-meter">
        <span class="sr-only">score ${Math.round(p.score)} of 100</span>
        <span class="v-score" data-count="${p.score}" aria-hidden="true">0</span>
        <div class="v-track" aria-hidden="true"><div class="v-fill fill-${b}" data-p="${p.score}"></div></div>
        <span class="v-bandword band-${b}">${word}</span></div>`;
    }

    const strengths = (p.strengths || []).map((s) => `<p class="v-strength">${esc(s)}</p>`).join("");
    const findings = (p.findings || []).map(findingHtml).join("");
    const body = `
      <div class="v-body">
        <p class="v-source">${esc(p.rubric_source || "")}</p>
        ${strengths ? `<p class="v-group-title t-good">Did well</p>${strengths}` : ""}
        ${findings ? `<p class="v-group-title t-bad">Findings</p>${findings}` : ""}
        ${!strengths && !findings ? '<p class="v-verdict">No further detail for this parameter.</p>' : ""}
      </div>`;

    return `
      <details class="verdict ${skipped ? "is-skipped" : ""}">
        <summary>
          <div class="v-top">
            <span class="v-caret" aria-hidden="true">▶</span>
            <span class="v-name">${esc(p.display_name)}</span>
            ${badges}
          </div>
          ${meter}
          <p class="v-verdict">${esc(skipped ? (p.verdict || p.skipped_reason) : p.verdict)}</p>
        </summary>
        ${body}
      </details>`;
  }

  function repairHtml(r, i) {
    return `
      <article class="repair">
        <div class="repair-head">
          <div class="repair-title-row">
            <h3 class="repair-title">${esc(r.title)}</h3>
            <span class="badge badge-family">${esc(FAMILY_LABELS[r.model_family] || r.model_family)}</span>
          </div>
          <p class="repair-diagnosis">${esc(r.diagnosis)}</p>
        </div>
        <div class="repair-block">
          <div class="repair-block-bar">
            <button type="button" class="copy-btn" data-copy-idx="${i}">Copy prompt</button>
          </div>
          <pre class="repair-pre" id="repair-pre-${i}">${esc(r.prompt_text)}</pre>
        </div>
        <p class="repair-foot">${esc(r.technique_source)}</p>
      </article>`;
  }

  function gaugeHtml(score, b) {
    return `
      <svg class="gauge" width="86" height="86" viewBox="0 0 86 86" role="img"
           aria-label="Overall score ${Math.round(score)} out of 100">
        <circle class="gauge-track" cx="43" cy="43" r="${GAUGE_R}" fill="none" stroke-width="7"/>
        <circle class="gauge-fill gauge-${b}" cx="43" cy="43" r="${GAUGE_R}" fill="none" stroke-width="7"
                stroke-dasharray="${GAUGE_C.toFixed(2)}" stroke-dashoffset="${GAUGE_C.toFixed(2)}"/>
        <text class="gauge-num" x="43" y="51" text-anchor="middle" aria-hidden="true">0</text>
      </svg>`;
  }

  function renderReport(rep) {
    stopLive();
    const t = rep.task;
    const [ob, oword] = band(rep.overall.score);
    const scored = rep.parameters.filter((p) => p.score !== null && p.score !== undefined);
    const nFindings = rep.parameters.reduce((n, p) => n + (p.findings || []).length, 0);

    reportPane.innerHTML = `
      <div class="report">
        <header class="report-head" data-fx="head">
          <div class="report-head-left">
            <h1 class="report-title">Evaluation report</h1>
            <div class="task-line">
              <span class="task-chip">${esc(TASK_LABELS[t.task_type] || t.task_type)}</span>
              <span>confidence ${(t.confidence * 100).toFixed(0)}%</span>
              ${t.has_source_text ? "<span>· source text detected</span>" : ""}
            </div>
            <details class="signals">
              <summary>Why this classification</summary>
              <ul>${t.signals.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
            </details>
          </div>
          <div class="overall">
            <div class="overall-text">
              <div class="overall-band band-${ob}">${oword} overall</div>
              <p class="overall-note">${esc(rep.overall.note)}</p>
            </div>
            ${gaugeHtml(rep.overall.score, ob)}
          </div>
        </header>

        ${rep.honesty_notes.length ? `
        <aside class="honesty" data-fx="honesty">
          <p class="honesty-title">What this report can and cannot claim</p>
          <ul>${rep.honesty_notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
        </aside>` : ""}

        <h2 class="sect" data-fx="sect1">Parameter verdicts <span class="count">· ${scored.length} scored, ${nFindings} findings</span></h2>
        ${rep.parameters.map(verdictHtml).join("")}

        <h2 class="sect" data-fx="sect2">The repaired prompt <span class="count">· one paste-ready fix for everything found · ${esc(FAMILY_LABELS[(rep.improvement_prompts[0] || {}).model_family] || "your model")}</span></h2>
        ${rep.improvement_prompts.length
          ? rep.improvement_prompts.map(repairHtml).join("")
          : '<p class="no-repairs">No repair needed — every locally checkable parameter came back clean. If the output still feels wrong, the issue likely lives in the judge-mode territory listed above.</p>'}
      </div>`;

    wireCopyButtons();
    choreographReport(rep);
  }

  // The report-arrival set piece. Every effect degrades to final state.
  function choreographReport(rep) {
    const q = (sel) => reportPane.querySelector(sel);
    const qa = (sel) => [...reportPane.querySelectorAll(sel)];
    const gaugeFill = q(".gauge-fill");
    const gaugeNum = q(".gauge-num");
    const fills = qa(".v-fill");
    const counts = qa(".v-score[data-count]");
    const finalOffset = GAUGE_C * (1 - rep.overall.score / 100);

    const settle = () => {
      if (gaugeFill) gaugeFill.setAttribute("stroke-dashoffset", finalOffset);
      if (gaugeNum) gaugeNum.textContent = Math.round(rep.overall.score);
      fills.forEach((el) => { el.style.transform = `scaleX(${Math.max(0.02, el.dataset.p / 100)})`; });
      counts.forEach((el) => { el.textContent = Math.round(el.dataset.count); });
    };
    if (!FX) { settle(); return; }

    const head = q('[data-fx="head"]');
    const honesty = q('[data-fx="honesty"]');
    const rows = qa("details.verdict");
    const repair = q(".repair, .no-repairs");

    // M5: timeline sequence with `at` offsets — the report assembles in order
    const seq = [
      [head, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, ease: EASE_OUT }],
    ];
    if (honesty) seq.push([honesty, { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: EASE_OUT, at: "-0.15" }]);
    if (rows.length) {
      // M3 stagger + M16 startDelay inside the sequence + M12 independent y/opacity
      seq.push([rows, { opacity: [0, 1], y: [14, 0] },
        { delay: M.stagger(0.06), duration: 0.35, ease: EASE_OUT, at: "-0.1" }]);
    }
    track(M.animate(seq));

    // M14 gauge sweep (SVG stroke-dashoffset) with M13 custom bezier
    track(M.animate(gaugeFill,
      { strokeDashoffset: [GAUGE_C, finalOffset] },
      { duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.25 }));
    // M6 raw-value count-up driving the gauge number
    track(M.animate(0, rep.overall.score, {
      duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.25,
      onUpdate: (v) => { gaugeNum.textContent = Math.round(v); },
    }));

    // M7 inView: each verdict row's meter springs to value when it scrolls
    // into view (rows already on screen fire immediately)
    rows.forEach((row) => {
      const fill = row.querySelector(".v-fill");
      const count = row.querySelector(".v-score[data-count]");
      M.inView(row, () => {
        if (fill) track(M.animate(fill,
          { scaleX: Math.max(0.02, fill.dataset.p / 100) }, SPRING_FILL));   // M2 spring
        if (count) track(M.animate(0, Number(count.dataset.count), {
          duration: 0.6, ease: EASE_OUT,
          onUpdate: (v) => { count.textContent = Math.round(v); },
        }));
        return false; // fire once
      }, { amount: 0.4 });
    });

    // M17 blur as motion material: the repair card develops into focus
    if (repair) {
      M.inView(repair, () => {
        track(M.animate(repair,
          { opacity: [0, 1], filter: ["blur(6px)", "blur(0px)"], y: [16, 0] },
          { duration: 0.45, ease: EASE_OUT }));
        return false;
      }, { amount: 0.15 });
    }
  }

  function wireCopyButtons() {
    reportPane.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pre = $(`repair-pre-${btn.dataset.copyIdx}`);
        try {
          await navigator.clipboard.writeText(pre.textContent);
          btn.textContent = "Copied ✓";
          btn.classList.add("copied");
          if (FX) track(M.animate(btn, { scale: [1, 1.15, 1] }, { duration: 0.35, ease: EASE_OUT })); // M1
          showToast("Repair prompt on your clipboard");
          setTimeout(() => { btn.textContent = "Copy prompt"; btn.classList.remove("copied"); }, 1400);
        } catch {
          showToast("Copy failed — select the text manually");
        }
      });
    });
  }

  // ---------- evaluate flow ----------
  let slowTimer = null;
  let inflight = null;   // AbortController while an evaluation runs
  async function evaluate() {
    if (inflight) return;   // guarded; the button becomes Cancel while running
    const payload = {
      prompt: $("promptIn").value,
      output: $("outputIn").value,
      model_name: composedModelName(),
      options: (() => {
        const tone = form.querySelector('input[name="tone"]:checked');
        return { audience: tone?.dataset.audience || "", tone: tone?.value || "", weights: {} };
      })(),
    };
    inflight = new AbortController();
    evalBtn.textContent = "Cancel";
    renderSkeleton(engineReady ? undefined : "Waking the engine — free hosting sleeps between uses; first run can take a minute…");
    // Mobile: the console is tall; make the result visible immediately.
    if (window.innerWidth < 960) {
      document.querySelector(".pane-report").scrollIntoView({
        behavior: REDUCED ? "auto" : "smooth", block: "start",
      });
    }
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      const note = reportPane.querySelector(".skel-note");
      if (note) note.textContent = "Still working — the NLI faithfulness matrix is the slow part on long sources…";
    }, 12000);

    try {
      const res = await fetch(`${API}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([AbortSignal.timeout(180000), inflight.signal]),
      });
      if (!res.ok) {
        const detail = await res.json().then((d) => d.detail).catch(() => res.statusText);
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const rep = await res.json();
      // M15 exit animation + M11 await .finished before swapping content
      const skel = reportPane.querySelector(".report");
      if (FX && skel) {
        await M.animate(skel, { opacity: 0, scale: 0.985 }, { duration: 0.18, ease: "easeIn" }).finished;
      }
      renderReport(rep);
    } catch (err) {
      if (inflight && inflight.signal.aborted) {   // user hit Cancel
        renderEmpty();
        showToast("Evaluation cancelled");
        return;
      }
      const unreachable = err.name === "TypeError" || err.name === "TimeoutError" || err.name === "AbortError";
      renderError(
        unreachable ? "Could not reach the evaluation engine." : err.message,
        unreachable
          ? `The engine may still be waking (check the status pill, top right). It retries automatically —
             try again in ~30 seconds. To point this UI at a different engine, add
             <code>?api=https://your-engine-url</code> to the address.`
          : "",
      );
      checkHealth();
    } finally {
      clearTimeout(slowTimer);
      inflight = null;
      evalBtn.textContent = "Evaluate output";
    }
  }

  evalBtn.addEventListener("click", (e) => {
    if (inflight) { e.preventDefault(); inflight.abort(); }
  });

  // Ctrl/Cmd+Enter evaluates from anywhere in the form (the one accelerator)
  form.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!inflight) evaluate();
    }
  });
  evalBtn.title = "Ctrl+Enter";

  // ---------- model picker (two searchable comboboxes) ----------
  const PROVIDERS = window.RUBRIQ_PROVIDERS || [];
  const providerIn = $("providerIn");

  function composedModelName() {
    const provider = providerIn.value.trim();
    const model = $("modelIn").value.trim();
    if (!model) return provider === "Other" ? "" : provider;
    if (!provider || provider === "Other") return model;
    return model.toLowerCase().startsWith(provider.toLowerCase()) ? model : `${provider} ${model}`;
  }

  function makeCombo(rootSel, opts) {
    const root = document.querySelector(rootSel);
    const input = root.querySelector("input");
    const toggle = root.querySelector(".combo-toggle");
    const list = root.querySelector(".combo-list");
    let items = [];
    let active = -1;

    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      active = -1;
    }
    function render(filter) {
      const q = (filter ?? "").trim().toLowerCase();
      items = opts.items().filter((it) =>
        !q || it.label.toLowerCase().includes(q) || (it.meta || "").toLowerCase().includes(q));
      list.innerHTML = "";
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "co-empty";
        li.textContent = opts.emptyText || "No matches — free text is fine";
        list.appendChild(li);
      }
      items.forEach((it, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.id = `${input.id}-opt-${i}`;
        li.textContent = it.label;
        if (it.meta) {
          const m = document.createElement("span");
          m.className = "co-provider";
          m.textContent = it.meta;
          li.appendChild(m);
        }
        li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      const wasHidden = list.hidden;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (FX && wasHidden) {
        track(M.animate(list, { opacity: [0, 1], y: [-4, 0] }, { duration: 0.15, ease: EASE_OUT }));
      }
    }
    function pick(i) {
      const it = items[i];
      if (!it) return;
      input.value = it.label;
      close();
      opts.onPick(it);
    }
    function setActive(i) {
      active = (i + items.length) % Math.max(1, items.length);
      [...list.querySelectorAll("[role=option]")].forEach((el, j) => {
        el.setAttribute("aria-selected", String(j === active));
        if (j === active) el.scrollIntoView({ block: "nearest" });
      });
      input.setAttribute("aria-activedescendant", `${input.id}-opt-${active}`);
    }
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(input.value); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter" && !list.hidden && active >= 0) { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { close(); }
      else if (e.key === "Tab") { close(); }
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
    toggle.addEventListener("click", () => {
      if (list.hidden) { input.focus(); render(""); } else close();
    });
    return { close };
  }

  makeCombo('[data-combo="provider"]', {
    items: () => PROVIDERS.map((p) => ({ label: p.name })),
    onPick: (it) => {
      const prov = PROVIDERS.find((p) => p.name === it.label);
      if (prov && !prov.models.some((m) => m === $("modelIn").value)) $("modelIn").value = "";
      $("modelIn").focus();
    },
    emptyText: "No such provider — free text is fine",
  });

  makeCombo('[data-combo="model"]', {
    items: () => {
      const prov = PROVIDERS.find((p) => p.name === providerIn.value.trim());
      if (prov && prov.models.length) return prov.models.map((m) => ({ label: m }));
      const rows = [];
      for (let rank = 0; rank < 8; rank++) {
        for (const p of PROVIDERS) {
          if (p.models[rank]) rows.push({ label: p.models[rank], meta: p.name });
        }
      }
      return rows;
    },
    onPick: (it) => { if (it.meta) providerIn.value = it.meta; },
    emptyText: "Not listed — type the model name",
  });

  form.addEventListener("submit", (e) => { e.preventDefault(); evaluate(); });
  $("clearBtn").addEventListener("click", () => {
    form.reset();
    renderEmpty();
    $("promptIn").focus();
  });

  // ---------- samples ----------
  const chips = $("sampleChips");
  (window.RUBRIQ_SAMPLES || []).forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = s.label;
    b.title = s.hint;
    b.addEventListener("click", () => {
      $("promptIn").value = s.prompt;
      $("outputIn").value = s.output;
      providerIn.value = s.provider || "";
      $("modelIn").value = s.model;
      evaluate();
    });
    chips.appendChild(b);
  });

  // ---------- gestures & console boot ----------
  if (FX) {
    // M9 hover(): chips lift with a spring and settle back
    M.hover(".chip, .tone-chip span", (el) => {
      M.animate(el, { y: -2 }, { type: "spring", stiffness: 400, damping: 25 });
      return () => M.animate(el, { y: 0 }, { type: "spring", stiffness: 400, damping: 25 });
    });
    // M10 press(): tactile push on the primary action and chips
    M.press("#evalBtn, .chip", (el) => {
      M.animate(el, { scale: 0.965 }, { duration: 0.1 });
      return () => M.animate(el, { scale: 1 }, { type: "spring", stiffness: 500, damping: 22 });
    });
    // M8 scroll(): reading progress bound to page scroll
    const progressFill = $("readProgress");
    M.scroll((progress) => {
      const v = typeof progress === "number" ? progress : (progress?.y?.progress ?? 0);
      progressFill.style.transform = `scaleX(${v})`;
    });
    // One-time console power-on: fields rise, chips fan out from the center
    M.animate(".pane-input .field, .pane-input fieldset, .pane-input .actions, .pane-input .samples",
      { opacity: [0, 1], y: [10, 0] },
      { delay: M.stagger(0.05), duration: 0.35, ease: EASE_OUT });
    // M4 stagger from center + M16 startDelay: chips fan out after the fields land
    M.animate(".samples-row .chip",
      { opacity: [0, 1], scale: [0.9, 1] },
      { delay: M.stagger(0.04, { from: "center", startDelay: 0.3 }), duration: 0.3, ease: EASE_OUT });
  }

  // ---------- boot ----------
  renderEmpty();
  checkHealth();
})();
