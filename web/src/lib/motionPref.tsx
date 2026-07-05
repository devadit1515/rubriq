// Motion preference: system pref, plus a user override the header exposes as a
// visible toggle (accessibility requirement). `reduced` gates the JS-driven
// sequences (the read sweep, needle timeline); MotionConfig handles the rest.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";

type Mode = "auto" | "full" | "calm";

interface MotionPrefCtx {
  mode: Mode;
  reduced: boolean;
  cycle: () => void;
}

const Ctx = createContext<MotionPrefCtx | null>(null);
const KEY = "rubriq_motion";

export function MotionPrefProvider({ children }: { children: ReactNode }) {
  const system = useReducedMotion();
  const [mode, setMode] = useState<Mode>(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return v === "full" || v === "calm" ? v : "auto";
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* private mode — ignore */
    }
  }, [mode]);

  const reduced = mode === "calm" ? true : mode === "full" ? false : !!system;

  const cycle = () =>
    setMode((m) => (m === "auto" ? "full" : m === "full" ? "calm" : "auto"));

  return (
    <Ctx.Provider value={{ mode, reduced, cycle }}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useMotionPref(): MotionPrefCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMotionPref must be used within MotionPrefProvider");
  return c;
}
