// THE INTAKE. Full-viewport, obsidian. The headline leads; the two inputs are the
// calm centre; the samples are an inviting way in; one lit CTA. The instrument is
// held back for the verdict, where it earns its entrance.
import { motion } from "framer-motion";
import type { DemoSample } from "../lib/types";
import { PROVIDERS } from "../lib/providers";
import GlassField from "./GlassField";
import Dropdown from "./Dropdown";
import ToneSelector from "./ToneSelector";
import SampleChips from "./SampleChips";
import EvaluateButton from "./EvaluateButton";
import { EASE_OUT_EXPO, revealChild, revealContainer } from "../lib/motion";

const PROVIDER_NAMES = PROVIDERS.filter((p) => p.models.length > 0).map((p) => p.name);

interface Props {
  prompt: string;
  output: string;
  provider: string;
  model: string;
  tone: string;
  setPrompt: (v: string) => void;
  setOutput: (v: string) => void;
  setProvider: (v: string) => void;
  setModel: (v: string) => void;
  setTone: (v: string) => void;
  running: boolean;
  error: string | null;
  onEvaluate: () => void;
  onCancel: () => void;
  onPickSample: (s: DemoSample) => void;
}

export default function IntakeView(p: Props) {
  const ready = p.prompt.trim().length > 0 && p.output.trim().length > 0;
  const modelOptions = PROVIDERS.find((x) => x.name === p.provider)?.models ?? [];

  return (
    <motion.section
      key="intake"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97, filter: "blur(10px)" }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="mx-auto w-full max-w-[1120px] px-5 pb-28 pt-16 sm:px-8 sm:pt-24"
    >
      <motion.div variants={revealContainer} initial="hidden" animate="shown" className="flex flex-col items-center">
        <motion.h1
          variants={revealChild}
          className="text-balance text-center font-display font-semibold leading-[1.01]"
          style={{ fontSize: "clamp(2.4rem, 6vw, 4.6rem)", letterSpacing: "-0.04em", color: "var(--text)" }}
        >
          Read the answer <br className="hidden sm:block" />before you trust it.
        </motion.h1>

        <motion.p
          variants={revealChild}
          className="prose-measure text-pretty mt-6 text-center"
          style={{ color: "var(--text-dim)", fontSize: "1.08rem", lineHeight: 1.55 }}
        >
          Rubriq examines an AI output the way a loupe reads a diamond — scoring it against published
          evaluation research, quoting the evidence in its own words, and handing you one prompt that
          fixes what it found.
        </motion.p>

        <motion.div
          variants={revealChild}
          className="mt-7 inline-flex items-center gap-2.5 rounded-full px-4 py-2"
          style={{ background: "oklch(0.85 0.14 160 / 0.08)", boxShadow: "0 0 0 1px var(--line) inset" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9-4-0.7-7-4.6-7-9V6l7-3Z" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[0.82rem]" style={{ color: "var(--text-dim)" }}>
            Runs entirely on your machine · nothing leaves this device
          </span>
        </motion.div>
      </motion.div>

      <motion.div variants={revealChild} initial="hidden" animate="shown" className="mx-auto mt-14 max-w-[860px]">
        <SampleChips onPick={p.onPickSample} />
      </motion.div>

      <div className="mx-auto mt-6 max-w-[860px]">
        <div className="grid gap-3.5 md:grid-cols-2">
          <GlassField
            label="The prompt you gave"
            value={p.prompt}
            onChange={p.setPrompt}
            placeholder="Paste the instruction you sent the model — include any source text it was asked to work from."
            minHeight={170}
          />
          <GlassField
            label="The output you got back"
            value={p.output}
            onChange={p.setOutput}
            placeholder="Paste the answer the model returned. This is the specimen Rubriq examines."
            mono
            minHeight={170}
          />
        </div>

        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <Dropdown label="Provider" value={p.provider} placeholder="Any provider" options={PROVIDER_NAMES} onChange={p.setProvider} />
          <Dropdown
            label="Model"
            value={p.model}
            placeholder={p.provider ? `Any ${p.provider} model` : "Select a model"}
            options={modelOptions}
            onChange={p.setModel}
            disabled={!p.provider}
            disabledHint="Choose a provider first"
          />
        </div>
        <div className="mt-3.5">
          <ToneSelector value={p.tone} onChange={p.setTone} />
        </div>

        {p.error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass mt-4 flex items-start gap-3 p-4"
            style={{ boxShadow: "0 0 0 1px var(--weak) inset, var(--shadow-glass)" }}
            role="alert"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 flex-none">
              <circle cx="12" cy="12" r="9" stroke="var(--weak)" strokeWidth="1.6" />
              <path d="M12 8v5" stroke="var(--weak)" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16.2" r="0.4" fill="var(--weak)" stroke="var(--weak)" strokeWidth="0.8" />
            </svg>
            <p className="text-[0.9rem]" style={{ color: "var(--text-dim)" }}>
              {p.error}
            </p>
          </motion.div>
        )}

        <div className="mx-auto mt-5 max-w-md">
          <EvaluateButton running={p.running} disabled={!ready} onEvaluate={p.onEvaluate} onCancel={p.onCancel} />
          <p className="mt-3 text-center etch" style={{ fontSize: "0.58rem" }}>
            {ready ? "press ⌘ / Ctrl + Enter" : "paste a prompt and an output to begin"}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
