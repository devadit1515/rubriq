// Visible motion control (accessibility). Cycles Auto → Full → Calm. "Calm"
// forces reduced motion; "Full" forces it on; "Auto" follows the OS setting.
import { motion } from "framer-motion";
import { useMotionPref } from "../lib/motionPref";
import { SNAP } from "../lib/motion";

const LABEL = { auto: "Motion · Auto", full: "Motion · Full", calm: "Motion · Calm" } as const;

export default function MotionToggle() {
  const { mode, cycle, reduced } = useMotionPref();
  return (
    <motion.button
      type="button"
      onClick={cycle}
      whileTap={{ scale: 0.94 }}
      transition={SNAP}
      className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3"
      style={{ borderRadius: 999 }}
      aria-label={`Motion setting: ${mode}. Activate to change.`}
      title="Cycle motion: Auto / Full / Calm"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="var(--text-dim)" strokeWidth="1.5" />
        <motion.circle
          cx="12"
          cy="12"
          r="3.2"
          fill="var(--ink)"
          animate={reduced ? { scale: 1 } : { scale: [1, 1.35, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "12px 12px" }}
        />
      </svg>
      <span className="etch" style={{ color: "var(--text-dim)", letterSpacing: "0.14em", fontSize: "0.62rem" }}>
        {LABEL[mode]}
      </span>
    </motion.button>
  );
}
