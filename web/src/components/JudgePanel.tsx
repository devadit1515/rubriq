// Bring-your-own-key judge tier (opt-in). Off by default. When on, Gemini scores
// factual accuracy + quality and rewrites the repair prompt using YOUR key — which
// means the text leaves the device, so the panel says so plainly. The key lives only
// in your browser (localStorage) and is sent per request; it is never stored by us.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GLASS, SOFT } from "../lib/motion";

interface Props {
  enabled: boolean;
  apiKey: string;
  model: string;
  onToggle: (v: boolean) => void;
  onKey: (v: string) => void;
  onModel: (v: string) => void;
}

export default function JudgePanel({ enabled, apiKey, model, onToggle, onKey, onModel }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="glass overflow-hidden p-5 sm:p-6" style={{ boxShadow: enabled ? "0 0 0 1px var(--ink-soft) inset, var(--shadow-glass)" : "var(--shadow-glass)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.95rem] font-semibold" style={{ color: enabled ? "var(--ink)" : "var(--text)" }}>
              LLM judge · Gemini
            </span>
            <span className="rounded px-1.5 py-0.5 font-mono" style={{ fontSize: "0.56rem", color: "var(--text-mut)", background: "oklch(0.5 0.02 260 / 0.2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              your key
            </span>
          </div>
          <p className="mt-2 text-[0.88rem] leading-snug" style={{ color: "var(--text-dim)" }}>
            Add real factual-accuracy checking, a second opinion on the faithfulness flags, and a sharper repair prompt.
          </p>
        </div>

        {/* switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable the Gemini judge"
          onClick={() => onToggle(!enabled)}
          className="relative flex-none rounded-full"
          style={{
            width: 46,
            height: 26,
            padding: 3,
            background: enabled ? "oklch(0.8 0.15 160 / 0.9)" : "oklch(0.5 0.02 260 / 0.4)",
            boxShadow: enabled ? "0 0 14px -2px var(--ink-glow), 0 0 0 1px var(--ink-soft) inset" : "0 0 0 1px var(--line) inset",
            transition: "background 240ms",
          }}
        >
          <motion.span
            className="block rounded-full"
            style={{ width: 20, height: 20, background: enabled ? "oklch(0.16 0.03 160)" : "var(--text-dim)" }}
            animate={{ x: enabled ? 20 : 0 }}
            transition={GLASS}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SOFT}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="glass flex items-center gap-2 px-3" style={{ borderRadius: "var(--r-md)", height: 44 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "0 0 auto" }}>
                    <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="var(--text-mut)" strokeWidth="1.6" strokeLinecap="round" />
                    <rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="var(--text-mut)" strokeWidth="1.6" />
                  </svg>
                  <input
                    type={show ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => onKey(e.target.value)}
                    placeholder="Paste your Gemini API key"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full bg-transparent font-mono text-[0.82rem] outline-none placeholder:text-[var(--text-mut)]"
                    style={{ color: "var(--text)" }}
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="etch flex-none" style={{ fontSize: "0.54rem", color: "var(--text-mut)" }} aria-label={show ? "Hide key" : "Show key"}>
                    {show ? "hide" : "show"}
                  </button>
                </div>
                <input
                  value={model}
                  onChange={(e) => onModel(e.target.value)}
                  placeholder="gemini-2.0-flash"
                  spellCheck={false}
                  aria-label="Gemini model id"
                  className="glass bg-transparent px-3 font-mono text-[0.82rem] outline-none placeholder:text-[var(--text-mut)]"
                  style={{ color: "var(--text)", borderRadius: "var(--r-md)", height: 44, minWidth: 160 }}
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "oklch(from var(--mixed) l c h / 0.1)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 flex-none">
                  <path d="M12 3 2 20h20L12 3Z" stroke="var(--mixed)" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M12 10v4" stroke="var(--mixed)" strokeWidth="1.7" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="0.4" fill="var(--mixed)" stroke="var(--mixed)" strokeWidth="0.8" />
                </svg>
                <p className="text-[0.78rem] leading-snug" style={{ color: "var(--text-dim)" }}>
                  With the judge on, your prompt and output are sent to Google to be scored — they leave this device.
                  Your key stays in your browser and is never stored by Rubriq.{" "}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--ink)", textDecoration: "underline" }}>
                    Get a free key
                  </a>
                  .
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
