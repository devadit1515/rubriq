import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import { MotionPrefProvider } from "./lib/motionPref";
import { PointerProvider } from "./lib/pointer";
import { evaluate, warmup } from "./lib/api";
import type { DemoSample, EvalReport } from "./lib/types";
import SceneBackground from "./components/SceneBackground";
import Header from "./components/Header";
import IntakeView from "./components/IntakeView";
import VerdictView from "./components/VerdictView";

type Phase = "intake" | "verdict";

interface RunArgs {
  prompt: string;
  output: string;
  model: string;
  tone: string;
}

interface JudgeState {
  enabled: boolean;
  key: string;
  model: string;
}

// Judge settings persist in the browser only (the key never touches our servers
// beyond the per-request header). Falls back to defaults if storage is blocked.
function loadJudge(): JudgeState {
  try {
    const raw = localStorage.getItem("rubriq_judge");
    if (raw) {
      const j = JSON.parse(raw);
      return {
        enabled: !!j.enabled,
        key: typeof j.key === "string" ? j.key : "",
        model: typeof j.model === "string" && j.model ? j.model : "gemini-2.0-flash",
      };
    }
  } catch {
    /* ignore */
  }
  return { enabled: false, key: "", model: "gemini-2.0-flash" };
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [tone, setTone] = useState("");

  const [judgeEnabled, setJudgeEnabled] = useState(() => loadJudge().enabled);
  const [judgeKey, setJudgeKey] = useState(() => loadJudge().key);
  const [judgeModel, setJudgeModel] = useState(() => loadJudge().model);

  const [phase, setPhase] = useState<Phase>("intake");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [evaluatedOutput, setEvaluatedOutput] = useState("");
  const [source, setSource] = useState<"live" | "fixture">("live");

  const inflight = useRef<AbortController | null>(null);
  const lenis = useRef<Lenis | null>(null);

  // Lenis smooth scroll — framer's useScroll reads native scroll, which Lenis drives.
  useEffect(() => {
    const l = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.current = l;
    let raf = 0;
    const loop = (t: number) => {
      l.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      l.destroy();
    };
  }, []);

  // Wake the engine on load so the first evaluation doesn't pay the cold start.
  useEffect(() => {
    warmup();
  }, []);

  // Persist judge settings in the browser (key included — it stays client-side).
  useEffect(() => {
    try {
      localStorage.setItem("rubriq_judge", JSON.stringify({ enabled: judgeEnabled, key: judgeKey, model: judgeModel }));
    } catch {
      /* private mode — ignore */
    }
  }, [judgeEnabled, judgeKey, judgeModel]);

  const scrollTop = useCallback((immediate = false) => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate });
    else window.scrollTo({ top: 0 });
  }, []);

  const runEval = useCallback(
    async (args?: Partial<RunArgs>) => {
      const P = args?.prompt ?? prompt;
      const O = args?.output ?? output;
      const M = args?.model ?? model;
      const T = args?.tone ?? tone;
      if (!P.trim() || !O.trim() || running) return;

      setError(null);
      setRunning(true);
      const ctrl = new AbortController();
      inflight.current = ctrl;

      const judge =
        judgeEnabled && judgeKey.trim()
          ? { key: judgeKey.trim(), model: judgeModel.trim() || undefined }
          : undefined;

      try {
        const res = await evaluate({ prompt: P, output: O, model_name: M, options: { tone: T } }, ctrl.signal, judge);
        if (ctrl.signal.aborted) return;
        setReport(res.report);
        setSource(res.source);
        setEvaluatedOutput(O);
        setPhase("verdict");
        scrollTop(true);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Something went wrong reaching the engine.");
      } finally {
        if (inflight.current === ctrl) inflight.current = null;
        setRunning(false);
      }
    },
    [prompt, output, model, tone, running, scrollTop, judgeEnabled, judgeKey, judgeModel],
  );

  const cancel = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    setRunning(false);
  }, []);

  // Changing provider resets the model, so the model list always matches.
  const changeProvider = useCallback((pv: string) => {
    setProvider(pv);
    setModel("");
  }, []);

  // Load a sample into the fields only; the user presses Evaluate themselves.
  const pickSample = useCallback((s: DemoSample) => {
    setPrompt(s.prompt);
    setOutput(s.output);
    setProvider(s.provider);
    setModel(s.model);
    setTone("");
  }, []);

  const reset = useCallback(() => {
    cancel();
    setPhase("intake");
    setReport(null);
    setError(null);
    scrollTop(true);
  }, [cancel, scrollTop]);

  return (
    <MotionPrefProvider>
      <PointerProvider>
        <SceneBackground />
        <div className="relative z-scene flex min-h-dvh flex-col">
          <Header />
          <main className="flex-1">
            <AnimatePresence mode="wait">
              {phase === "intake" ? (
                <IntakeView
                  key="intake"
                  prompt={prompt}
                  output={output}
                  provider={provider}
                  model={model}
                  tone={tone}
                  setPrompt={setPrompt}
                  setOutput={setOutput}
                  setProvider={changeProvider}
                  setModel={setModel}
                  setTone={setTone}
                  judgeEnabled={judgeEnabled}
                  judgeKey={judgeKey}
                  judgeModel={judgeModel}
                  setJudgeEnabled={setJudgeEnabled}
                  setJudgeKey={setJudgeKey}
                  setJudgeModel={setJudgeModel}
                  running={running}
                  error={error}
                  onEvaluate={() => runEval()}
                  onCancel={cancel}
                  onPickSample={pickSample}
                />
              ) : (
                report && (
                  <VerdictView key="verdict" report={report} output={evaluatedOutput} source={source} onReset={reset} />
                )
              )}
            </AnimatePresence>
          </main>
          <footer className="relative z-scene px-5 py-8 text-center sm:px-8">
            <p className="etch" style={{ fontSize: "0.56rem", color: "var(--text-mut)" }}>
              {judgeEnabled && judgeKey.trim()
                ? "Rubriq · judge mode on — evaluations use your Gemini key and are sent to Google"
                : "Rubriq · local, research-grounded evaluation · your text never leaves this device"}
            </p>
          </footer>
        </div>
      </PointerProvider>
    </MotionPrefProvider>
  );
}
