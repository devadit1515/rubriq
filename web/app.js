/* Rubriq frontend. No framework, no build step — state machine + renderers. */
(() => {
  "use strict";

  // ---------- API base ----------
  const qp = new URLSearchParams(location.search).get("api");
  if (qp) localStorage.setItem("rubriq_api", qp.replace(/\/+$/, ""));
  const API = (qp && qp.replace(/\/+$/, ""))
    || localStorage.getItem("rubriq_api")
    || window.RUBRIQ_API
    || "";

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
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  }

  // ---------- engine status ----------
  let engineReady = false;
  async function checkHealth(retries = 0) {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const ok = data.models && data.models.embeddings && data.models.nli;
      engineReady = true;
      enginePill.dataset.state = "ready";
      engineLabel.textContent = ok ? "local engine · models ready" : "engine up · models loading";
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
    reportPane.innerHTML = `
      <div class="report-empty">
        <h1>Paste a prompt and the output it produced.<br>Rubriq shows you what the model got right — with receipts.</h1>
        <p>The output is scored against evaluation parameters from published research,
           chosen to fit the task it detects. Every finding quotes the text that triggered it,
           and every diagnosed failure generates a repair prompt you can paste straight back
           into the model that misbehaved.</p>
        <p>Fastest way to see it: load a sample from the panel — each one has planted,
           known failures.</p>
        <div class="empty-honesty">
          <strong>What local scoring can and cannot judge.</strong>
          Faithfulness to a source, instruction compliance, structure, and style statistics
          are checked locally with published methods — no API calls, nothing leaves this machine.
          Open-world fact checking and subjective quality need a judge model; Rubriq labels
          those honestly instead of guessing.
        </div>
      </div>`;
  }

  function renderSkeleton(note) {
    reportPane.innerHTML = `
      <div class="report">
        <p class="skel-note">${esc(note || "Classifying the task and running the parameter suite…")}</p>
        ${'<div class="skel-row"></div>'.repeat(5)}
      </div>`;
  }

  function renderError(message, hint) {
    reportPane.innerHTML = `
      <div class="report-error" role="alert">
        <h2>Evaluation failed</h2>
        <p>${esc(message)}</p>
        ${hint ? `<p style="margin-top:8px">${hint}</p>` : ""}
      </div>`;
  }

  // ---------- report rendering ----------
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

  function verdictHtml(p, i) {
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
        <span class="v-score">${Math.round(p.score)}</span>
        <div class="v-track"><div class="v-fill fill-${b}" data-p="${p.score}"></div></div>
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
      <details class="verdict reveal ${skipped ? "is-skipped" : ""}" style="animation-delay:${i * 40}ms">
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
      <article class="repair reveal" style="animation-delay:${i * 40}ms">
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

  function renderReport(rep) {
    const t = rep.task;
    const [ob, oword] = band(rep.overall.score);
    const scored = rep.parameters.filter((p) => p.score !== null && p.score !== undefined);
    const nFindings = rep.parameters.reduce((n, p) => n + (p.findings || []).length, 0);

    reportPane.innerHTML = `
      <div class="report">
        <header class="report-head reveal">
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
            <div class="overall-score band-${ob}">${Math.round(rep.overall.score)}</div>
            <div class="overall-band band-${ob}">${oword} overall</div>
            <p class="overall-note">${esc(rep.overall.note)}</p>
          </div>
        </header>

        ${rep.honesty_notes.length ? `
        <aside class="honesty reveal" style="animation-delay:40ms">
          <p class="honesty-title">What this report can and cannot claim</p>
          <ul>${rep.honesty_notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
        </aside>` : ""}

        <h2 class="sect">Parameter verdicts <span class="count">· ${scored.length} scored, ${nFindings} findings</span></h2>
        ${rep.parameters.map(verdictHtml).join("")}

        <h2 class="sect">Repair prompts <span class="count">· targeted at ${esc(FAMILY_LABELS[(rep.improvement_prompts[0] || {}).model_family] || "your model")}</span></h2>
        ${rep.improvement_prompts.length
          ? rep.improvement_prompts.map(repairHtml).join("")
          : '<p class="no-repairs">No repairs needed — every locally checkable parameter came back clean. If the output still feels wrong, the issue likely lives in the judge-mode territory listed above.</p>'}
      </div>`;

    // meter fill animation (double rAF so the 0-scale paints first)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      reportPane.querySelectorAll(".v-fill").forEach((el) => {
        el.style.transform = `scaleX(${Math.max(0.02, el.dataset.p / 100)})`;
      });
    }));

    // copy buttons
    reportPane.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pre = $(`repair-pre-${btn.dataset.copyIdx}`);
        try {
          await navigator.clipboard.writeText(pre.textContent);
          btn.textContent = "Copied ✓";
          btn.classList.add("copied");
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
  async function evaluate() {
    const payload = {
      prompt: $("promptIn").value,
      output: $("outputIn").value,
      model_name: composedModelName(),
      options: { audience: $("audienceIn").value.trim(), tone: $("toneIn").value.trim(), weights: {} },
    };
    evalBtn.disabled = true;
    evalBtn.textContent = "Evaluating…";
    renderSkeleton(engineReady ? undefined : "Waking the engine — free hosting sleeps between uses; first run can take a minute…");
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
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) {
        const detail = await res.json().then((d) => d.detail).catch(() => res.statusText);
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      renderReport(await res.json());
    } catch (err) {
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
      evalBtn.disabled = false;
      evalBtn.textContent = "Evaluate output";
    }
  }

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
        // mousedown (not click) so it fires before the input's blur
        li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
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
      // no provider chosen: search everything, most-popular model of each provider first
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

  // ---------- boot ----------
  renderEmpty();
  checkHealth();
})();
