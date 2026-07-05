// The diorama. Three depth layers — a green key-light bloom, a cool counter-glow,
// and a sparse dust field — each moving at a different rate on scroll and cursor,
// so the scene has real parallax depth behind the glass instrument.
import { motion, useScroll, useTransform } from "framer-motion";
import { usePointer } from "../lib/pointer";
import { useMotionPref } from "../lib/motionPref";

const DUST = [
  { x: "12%", y: "22%", s: 2, d: 9 },
  { x: "78%", y: "16%", s: 3, d: 12 },
  { x: "63%", y: "38%", s: 1.5, d: 7 },
  { x: "28%", y: "58%", s: 2, d: 11 },
  { x: "88%", y: "62%", s: 2.5, d: 10 },
  { x: "44%", y: "78%", s: 1.5, d: 8 },
  { x: "18%", y: "85%", s: 2, d: 13 },
  { x: "70%", y: "88%", s: 1.5, d: 9 },
];

export default function SceneBackground() {
  const { px, py } = usePointer();
  const { reduced } = useMotionPref();
  const { scrollY } = useScroll();

  // Different scroll rates per layer = depth.
  const keyY = useTransform(scrollY, [0, 1400], [0, -180]);
  const coolY = useTransform(scrollY, [0, 1400], [0, -90]);
  const dustY = useTransform(scrollY, [0, 1400], [0, -260]);

  // Cursor tilt — small, and off entirely under reduced motion.
  const k = reduced ? 0 : 1;
  const keyX = useTransform(px, (v) => v * 46 * k);
  const keyPY = useTransform(py, (v) => v * 34 * k);
  const coolX = useTransform(px, (v) => v * -28 * k);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-aurora overflow-hidden">
      {/* green key light, top */}
      <motion.div
        style={{ x: keyX, y: keyY, translateY: keyPY }}
        className="absolute left-1/2 top-[-24vh] h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bloom"
        animate={reduced ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* cool counter-glow, upper right */}
      <motion.div
        style={{ x: coolX, y: coolY }}
        className="absolute right-[-10vw] top-[6vh] h-[46vh] w-[46vh] rounded-full"
        animate={reduced ? undefined : { opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background: "radial-gradient(closest-side, oklch(0.6 0.09 236 / 0.28), transparent 70%)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>

      {/* dust field, nearest layer */}
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
              background: "oklch(0.9 0.05 170 / 0.6)",
              boxShadow: "0 0 8px oklch(0.85 0.16 160 / 0.5)",
            }}
            animate={reduced ? undefined : { y: [0, -14, 0], opacity: [0.25, 0.7, 0.25] }}
            transition={{ duration: d.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
          />
        ))}
      </motion.div>
    </div>
  );
}
