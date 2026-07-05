// The engine's pulse, told honestly. The LED and label reflect real /health state:
// ready (green, breathing), waking (amber, quick pulse), offline (dim — demo mode),
// checking (platinum). Never claims "ready" when the models aren't loaded.
import { motion } from "framer-motion";
import type { EngineState } from "../lib/api";

const MAP: Record<EngineState, { label: string; color: string; pulse: number }> = {
  checking: { label: "checking engine", color: "var(--platinum)", pulse: 1.4 },
  ready: { label: "local engine · models ready", color: "var(--ink)", pulse: 3.2 },
  waking: { label: "waking engine · ~30s", color: "var(--mixed)", pulse: 0.9 },
  offline: { label: "offline · demo mode", color: "var(--weak)", pulse: 0 },
};

export default function StatusPill({ state }: { state: EngineState }) {
  const s = MAP[state];
  return (
    <div
      className="glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-3 pr-3.5"
      style={{ borderRadius: 999 }}
      role="status"
      aria-live="polite"
    >
      <span className="relative grid place-items-center" style={{ width: 9, height: 9 }}>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
        />
        {s.pulse > 0 && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: s.color }}
            animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
            transition={{ duration: s.pulse, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </span>
      <span className="etch" style={{ color: "var(--text-dim)", letterSpacing: "0.14em", fontSize: "0.62rem" }}>
        {s.label}
      </span>
    </div>
  );
}
