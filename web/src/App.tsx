import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import { MotionPrefProvider } from "./lib/motionPref";
import { PointerProvider } from "./lib/pointer";
import { evaluate, pingHealth, warmup, type EngineState } from "./lib/api";
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

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [tone, setTone] = useState("");

  const [phase, setPhase] = useState<Phase>("intake");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [evaluatedOutput, setEvaluatedOutput] = useState("");
  const [source, setSource] = useState<"live" | "fixture">("live");
  const [engine, setEngine] = useState<EngineState>("checking");

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

  // Engine health — poll, nudge warmup, retry while asleep/waking (capped).
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    warmup();
    const tick = async () => {
      const h = await pingHealth();
      if (!alive) return;
      setEngine(h.state);
      attempts += 1;
      if ((h.state === "waking" || h.state === "offline") && attempts < 12) {
        setTimeout(tick, 6000);
      }
    };
    tick();
    return () => {
      alive = false;
    };
  }, []);

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

      try {
        const res = await evaluate({ prompt: P, output: O, model_name: M, options: { tone: T } }, ctrl.signal);
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
    [prompt, output, model, tone, running, scrollTop],
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

  const pickSample = useCallback(
    (s: DemoSample) => {
      setPrompt(s.prompt);
      setOutput(s.output);
      setProvider(s.provider);
      setModel(s.model);
      setTone("");
      runEval({ prompt: s.prompt, output: s.output, model: s.model, tone: "" });
    },
    [runEval],
  );

  const reset = useCallback(() => {
    cancel();
    setPhase("intake");
    setReport(null);
    setError(null);
    scrollTop(true);
  }, [cancel, scrollTop]);

  // ⌘/Ctrl + Enter evaluates from anywhere in the intake.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "intake") {
        e.preventDefault();
        runEval();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, runEval]);

  return (
    <MotionPrefProvider>
      <PointerProvider>
        <SceneBackground />
        <div className="relative z-scene flex min-h-dvh flex-col">
          <Header engine={engine} />
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
              Rubriq · local, research-grounded evaluation · your text never leaves this device
            </p>
          </footer>
        </div>
      </PointerProvider>
    </MotionPrefProvider>
  );
}
