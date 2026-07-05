// Full motion is the standard. There is no user-facing motion control; the only
// thing honoured is the OS "reduce motion" accessibility setting, silently.
// `reduced` gates the JS-driven sequences; MotionConfig handles the declarative rest.
import { createContext, useContext, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";

interface MotionPrefCtx {
  reduced: boolean;
}

const Ctx = createContext<MotionPrefCtx>({ reduced: false });

export function MotionPrefProvider({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion();
  return (
    <Ctx.Provider value={{ reduced }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useMotionPref(): MotionPrefCtx {
  return useContext(Ctx);
}
