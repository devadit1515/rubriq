// Expected tone/register, sent through EvalOptions.tone. Segmented dial; the lit
// segment slides between options via a shared layoutId — one indicator, not five.
import { motion } from "framer-motion";
import { TONES } from "../lib/providers";
import { GLASS } from "../lib/motion";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ToneSelector({ value, onChange }: Props) {
  return (
    <div>
      <span className="etch mb-2 block" style={{ color: "var(--text-mut)" }}>
        Expected tone <span style={{ textTransform: "none", letterSpacing: 0 }}>· optional</span>
      </span>
      <div
        role="radiogroup"
        aria-label="Expected tone"
        className="glass flex gap-1 p-1"
        style={{ borderRadius: "var(--r-md)" }}
      >
        {TONES.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id || "any"}
              type="button"
              role="radio"
              aria-checked={on}
              title={t.hint}
              onClick={() => onChange(t.id)}
              className="relative flex-1 rounded-[9px] px-2 py-2 text-center"
            >
              {on && (
                <motion.span
                  layoutId="tone-active"
                  transition={GLASS}
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    background: "oklch(0.85 0.14 160 / 0.14)",
                    boxShadow: "0 0 0 1px var(--ink-soft) inset, 0 0 20px -8px var(--ink-glow)",
                  }}
                />
              )}
              <span
                className="relative text-[0.8rem]"
                style={{ color: on ? "var(--ink)" : "var(--text-dim)", fontWeight: on ? 600 : 400 }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
