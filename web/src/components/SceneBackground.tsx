// Minimalist scene: no coloured blooms — just a very sparse, faint neutral dust
// field drifting on scroll for a touch of depth. The obsidian field carries itself.
import { motion, useScroll, useTransform } from "framer-motion";
import { useMotionPref } from "../lib/motionPref";

const DUST = [
  { x: "16%", y: "24%", s: 1.5, d: 11 },
  { x: "80%", y: "18%", s: 2, d: 13 },
  { x: "30%", y: "62%", s: 1.5, d: 12 },
  { x: "86%", y: "58%", s: 1.5, d: 10 },
  { x: "58%", y: "82%", s: 1.5, d: 14 },
];

export default function SceneBackground() {
  const { reduced } = useMotionPref();
  const { scrollY } = useScroll();
  const dustY = useTransform(scrollY, [0, 1400], [0, -200]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-aurora overflow-hidden">
      <motion.div style={{ y: dustY }} className="absolute inset-0">
        {DUST.map((d, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: d.x,
              top: d.y,
              width: d.s,
              height: d.s,
              background: "oklch(0.85 0.008 250 / 0.45)",
            }}
            animate={reduced ? undefined : { y: [0, -12, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: d.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
          />
        ))}
      </motion.div>
    </div>
  );
}
