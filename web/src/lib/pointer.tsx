// One global pointer signal, spring-smoothed, shared by every component that
// tracks the cursor — the scene tilt, the gauge's specular highlight, glass
// specular. One window listener, zero jitter (useSpring), values in -0.5..0.5.
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { type MotionValue, useMotionValue, useSpring } from "framer-motion";

interface PointerCtx {
  px: MotionValue<number>; // -0.5 (left) .. 0.5 (right)
  py: MotionValue<number>; // -0.5 (top) .. 0.5 (bottom)
}

const Ctx = createContext<PointerCtx | null>(null);

export function PointerProvider({ children }: { children: ReactNode }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [rawX, rawY]);

  return <Ctx.Provider value={{ px, py }}>{children}</Ctx.Provider>;
}

export function usePointer(): PointerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePointer must be used within PointerProvider");
  return c;
}
