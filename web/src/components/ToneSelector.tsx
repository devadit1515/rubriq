// Expected tone/register, sent through EvalOptions.tone. A plain segmented dial.
// Deliberately NO shared-layout (layoutId) indicator: a pending layout animation
// here deadlocks the intake→verdict AnimatePresence(mode="wait") transition, which
// is what made "change the tone → no output" happen. Per-chip background only.
import { TONES } from "../lib/providers";

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
              className="relative flex-1 rounded-[9px] px-2 py-2.5 text-center text-[0.84rem]"
              style={{
                background: on ? "oklch(0.85 0.14 160 / 0.12)" : "transparent",
                boxShadow: on ? "0 0 0 1px var(--ink-soft) inset" : "none",
                color: on ? "var(--ink)" : "var(--text-dim)",
                fontWeight: on ? 600 : 400,
                transition: "background 200ms, color 200ms, box-shadow 200ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
