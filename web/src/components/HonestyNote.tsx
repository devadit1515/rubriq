// "What this report can and cannot claim" — designed as candor, not disabled
// fine print. Honesty is a feature here; it gets real weight and the ink accent.
import { motion } from "framer-motion";
import { revealChild } from "../lib/motion";

export default function HonestyNote({ notes, source }: { notes: string[]; source: "live" | "fixture" }) {
  const all = source === "fixture"
    ? [...notes, "Shown from a bundled sample because the local engine was asleep — the figures are real output the engine produced for this specimen."]
    : notes;
  if (all.length === 0) return null;

  return (
    <motion.aside
      variants={revealChild}
      className="glass mx-auto max-w-[720px] p-5 sm:p-6"
      aria-label="What this report can and cannot claim"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="var(--ink-soft)" strokeWidth="1.5" />
          <path d="M12 11v5" stroke="var(--ink-soft)" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="7.8" r="0.5" fill="var(--ink-soft)" stroke="var(--ink-soft)" strokeWidth="0.9" />
        </svg>
        <h3 className="etch" style={{ color: "var(--ink-soft)", letterSpacing: "0.2em" }}>
          What this report can &amp; cannot claim
        </h3>
      </div>
      <ul className="space-y-2.5">
        {all.map((n, i) => (
          <li key={i} className="flex gap-2.5 text-[0.86rem] leading-relaxed" style={{ color: "var(--text-dim)" }}>
            <span className="mt-2 h-1 w-1 flex-none rounded-full" style={{ background: "var(--ink-soft)" }} />
            <span className="text-pretty">{n}</span>
          </li>
        ))}
      </ul>
    </motion.aside>
  );
}
