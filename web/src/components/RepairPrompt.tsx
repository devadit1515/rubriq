// THE CLIMAX — the flagship. One paste-ready prompt that names every diagnosed
// fault and fixes it, adapted to the model's family. It gets the most visual weight
// on the results view: the faults name themselves, then the cure self-assembles line
// by line and glows green — the diagnosis can be red, but the cure is hope. One
// satisfying Copy action. Assembles when it scrolls into view (`active`).
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ImprovementPrompt } from "../lib/types";
import { useMotionPref } from "../lib/motionPref";
import { cureReveal, revealChild, SNAP } from "../lib/motion";

const FAMILY: Record<string, string> = {
  claude: "tuned for Claude",
  gpt: "tuned for GPT",
  gemini: "tuned for Gemini",
  open_weights: "tuned for open-weights models",
  generic: "model-agnostic",
};

interface Props {
  prompt: ImprovementPrompt;
  problems: { label: string; count: number }[];
  active: boolean;
}

export default function RepairPrompt({ prompt, problems, active }: Props) {
  const { reduced } = useMotionPref();
  const [copied, setCopied] = useState(false);
  const lines = prompt.prompt_text.split("\n");
  const show = active ? "shown" : "hidden";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.section
      variants={cureReveal}
      initial="hidden"
      animate={show}
      className="relative mx-auto w-full max-w-[880px]"
      aria-label="The repaired prompt"
    >
      <div aria-hidden className="absolute -inset-x-8 -top-10 h-40 bloom" style={{ opacity: 0.5 }} />

      <div
        className="glass relative overflow-hidden p-5 sm:p-7"
        style={{ boxShadow: "0 0 0 1px var(--ink-soft) inset, 0 40px 100px -40px var(--ink-glow), var(--shadow-lift)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="etch" style={{ color: "var(--ink)", letterSpacing: "0.26em" }}>
              the cure · paste-ready
            </span>
            <h2
              className="mt-1.5 font-display font-semibold leading-tight"
              style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", letterSpacing: "-0.03em", color: "var(--text)" }}
            >
              One prompt that repairs every fault
            </h2>
          </div>
          <span
            className="rounded-full px-3 py-1.5 font-mono text-[0.7rem]"
            style={{ color: "var(--ink)", background: "oklch(0.85 0.14 160 / 0.1)", boxShadow: "0 0 0 1px var(--line) inset" }}
          >
            {FAMILY[prompt.model_family] ?? "model-agnostic"}
          </span>
        </div>

        {problems.length > 0 && (
          <motion.div
            className="mt-4 flex flex-wrap items-center gap-2"
            variants={{ shown: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
          >
            <span className="etch" style={{ color: "var(--text-mut)" }}>
              fixing
            </span>
            {problems.map((p) => (
              <motion.span
                key={p.label}
                variants={revealChild}
                className="rounded-full px-2.5 py-1 font-mono text-[0.68rem]"
                style={{ color: "var(--weak)", background: "oklch(from var(--weak) l c h / 0.12)" }}
              >
                {p.label}
                {p.count > 1 && <span style={{ opacity: 0.7 }}> ·{p.count}</span>}
              </motion.span>
            ))}
          </motion.div>
        )}

        <div className="relative mt-5">
          <motion.pre
            className="max-h-[440px] overflow-y-auto rounded-[var(--r-md)] p-4 font-mono leading-[1.7]"
            style={{
              background: "oklch(0.09 0.012 262 / 0.6)",
              boxShadow: "0 0 0 1px var(--line) inset",
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
            variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } } }}
          >
            {lines.map((line, i) => (
              <motion.span
                key={i}
                className="block min-h-[1.2em]"
                variants={{
                  hidden: { opacity: 0, filter: "blur(6px)" },
                  shown: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.28 } },
                }}
              >
                {line || " "}
              </motion.span>
            ))}
            {active && !reduced && (
              <motion.span
                aria-hidden
                className="inline-block align-middle"
                style={{ width: 8, height: "1em", background: "var(--ink)", marginLeft: 2 }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </motion.pre>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.66rem] leading-snug" style={{ color: "var(--text-mut)" }}>
            technique · {prompt.technique_source}
          </p>
          <motion.button
            type="button"
            onClick={copy}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={SNAP}
            className="relative flex h-11 items-center gap-2.5 overflow-hidden rounded-[var(--r-md)] px-5 font-semibold"
            style={{
              background: copied
                ? "linear-gradient(180deg, var(--glass-2), var(--glass))"
                : "linear-gradient(180deg, oklch(0.88 0.15 162), oklch(0.78 0.16 160))",
              color: copied ? "var(--ink)" : "oklch(0.16 0.03 160)",
              boxShadow: copied
                ? "var(--shadow-glass)"
                : "0 1px 0 0 oklch(1 0 0 / 0.4) inset, 0 10px 30px -8px var(--ink-glow)",
            }}
            aria-label="Copy the repair prompt"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="m5 13 4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied — paste it back
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Copy the fix
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
