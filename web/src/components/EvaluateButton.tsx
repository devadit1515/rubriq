// The single primary action. Bright mercury-ink key with dark text — the one lit
// element in the intake. A specular highlight tracks the cursor across its face.
// Mid-run it flips to a calm Cancel. Nothing else competes with it.
import { useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { SNAP } from "../lib/motion";

interface Props {
  running: boolean;
  disabled: boolean;
  onEvaluate: () => void;
  onCancel: () => void;
}

export default function EvaluateButton({ running, disabled, onEvaluate, onCancel }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const spec = useMotionTemplate`radial-gradient(140px 90px at ${mx}% ${my}%, oklch(1 0 0 / 0.5), transparent 60%)`;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  const inert = disabled && !running;

  return (
    <motion.button
      ref={ref}
      type="button"
      onPointerMove={onMove}
      onClick={running ? onCancel : onEvaluate}
      disabled={inert}
      aria-label={running ? "Cancel evaluation" : "Evaluate output"}
      whileHover={inert ? undefined : { scale: 1.015 }}
      whileTap={inert ? undefined : { scale: 0.985 }}
      transition={SNAP}
      className="relative flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[var(--r-md)] font-semibold"
      style={{
        cursor: inert ? "not-allowed" : "pointer",
        background: running
          ? "linear-gradient(180deg, var(--glass-2), var(--glass))"
          : "linear-gradient(180deg, oklch(0.88 0.15 162), oklch(0.78 0.16 160))",
        color: running ? "var(--text-dim)" : "oklch(0.16 0.03 160)",
        boxShadow: running
          ? "var(--shadow-glass)"
          : "0 1px 0 0 oklch(1 0 0 / 0.4) inset, 0 10px 30px -8px var(--ink-glow), 0 2px 10px -2px oklch(0 0 0 / 0.5)",
        opacity: inert ? 0.5 : 1,
      }}
    >
      {!running && <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: spec }} />}
      <AnimatePresence mode="wait" initial={false}>
        {running ? (
          <motion.span
            key="cancel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative flex items-center gap-2.5"
          >
            <motion.span
              className="block rounded-full"
              style={{ width: 13, height: 13, border: "2px solid var(--text-mut)", borderTopColor: "var(--ink)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
            <span>Reading the specimen — cancel</span>
          </motion.span>
        ) : (
          <motion.span
            key="go"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative flex items-center gap-2.5"
          >
            <span style={{ letterSpacing: "-0.01em" }}>Evaluate output</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
