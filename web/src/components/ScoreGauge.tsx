// The instrument. A 270° dial whose needle settles with a spring overshoot, whose
// arc draws in with SVG pathLength, and whose number counts up from the SAME spring
// as the needle (so digit and needle arrive together). A specular glint tracks the
// cursor. Idle in the intake, settling to the verdict on results — one object.
import { useEffect } from "react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "framer-motion";
import { useState } from "react";
import { usePointer } from "../lib/pointer";
import { useMotionPref } from "../lib/motionPref";
import { NEEDLE_SPRING } from "../lib/motion";
import { tierColor, type Tier } from "../lib/tiers";

const START = -135; // 0 score, down-left
const RANGE = 270; // sweep to down-right (100)
const R = 82; // arc radius in a 200x200 viewBox
const CX = 100;
const CY = 100;

const angleOf = (v: number) => START + (Math.max(0, Math.min(100, v)) / 100) * RANGE;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180; // 0 at top, clockwise
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}
function arcPath(a0: number, a1: number, r: number) {
  const p0 = polar(a0, r);
  const p1 = polar(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

function Counter({ mv }: { mv: MotionValue<number> }) {
  const [n, setN] = useState(() => Math.round(mv.get()));
  useMotionValueEvent(mv, "change", (v) => setN(Math.round(v)));
  return <>{n}</>;
}

interface Props {
  value: number | null;
  tier: Tier;
  word?: string;
  phase: "idle" | "live";
  size?: number;
  caption?: string;
}

export default function ScoreGauge({ value, tier, word, phase, size = 300, caption }: Props) {
  const { reduced } = useMotionPref();
  const { px, py } = usePointer();
  const color = tierColor(tier);
  const play = phase === "live" && value !== null && !reduced;
  const finalAngle = value === null ? START : angleOf(value);

  // One spring drives needle + number. On idle/reduced it holds the final angle.
  const target = useMotionValue(play ? START : finalAngle);
  const angle = useSpring(target, NEEDLE_SPRING);
  const scoreFromAngle = useTransform(angle, (a) => Math.max(0, Math.min(100, ((a - START) / RANGE) * 100)));

  useEffect(() => {
    if (play) {
      target.set(START);
      const id = requestAnimationFrame(() => target.set(finalAngle));
      return () => cancelAnimationFrame(id);
    }
    angle.jump(finalAngle);
    target.jump(finalAngle);
  }, [play, finalAngle, target, angle]);

  // Always the spring-managed value so framer normalizes the SVG rotation origin
  // (a static number and a MotionValue take different origin code paths otherwise).
  const needleRotate = angle;

  // specular glint drift
  const k = reduced ? 0 : 1;
  const glintX = useTransform(px, (v) => v * 18 * k);
  const glintY = useTransform(py, (v) => v * 14 * k);

  const idle = value === null;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* volumetric key-light behind the dial */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: `radial-gradient(closest-side, ${idle ? "var(--ink-glow)" : color}, transparent 70%)`,
          opacity: idle ? 0.22 : 0.32,
          filter: "blur(10px)",
        }}
      />

      <svg viewBox="0 0 200 200" width={size} height={size} className="absolute inset-0" aria-hidden>
        <defs>
          <filter id="gaugeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ticks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = START + (i / 10) * RANGE;
          const outer = polar(a, R + 9);
          const inner = polar(a, R + (i % 5 === 0 ? 2 : 5));
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--line-2)"
              strokeWidth={i % 5 === 0 ? 1.6 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* track */}
        <path d={arcPath(START, START + RANGE, R)} fill="none" stroke="var(--line-2)" strokeWidth="6" strokeLinecap="round" />

        {/* value arc — draws in */}
        {!idle && (
          <motion.path
            d={arcPath(START, finalAngle, R)}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            initial={{ pathLength: play ? 0 : 1, opacity: play ? 0.4 : 1 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: play ? 1.15 : 0, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* needle — the invisible circle forces the group's bbox centre onto the
            dial pivot (100,100), so framer's default 50%/50% rotation origin is
            exactly the pivot at every angle */}
        <motion.g style={{ rotate: needleRotate }}>
          <circle cx={CX} cy={CY} r={R + 8} fill="none" stroke="none" />
          <line x1={CX} y1={CY + (idle ? 8 : 14)} x2={CX} y2={idle ? CY - R * 0.52 : CY - R + 8} stroke={idle ? "var(--text-mut)" : color} strokeWidth="2.2" strokeLinecap="round" filter={idle ? undefined : "url(#gaugeGlow)"} />
          <circle cx={CX} cy={CY} r="6.5" fill="var(--bg-2)" stroke={idle ? "var(--text-mut)" : color} strokeWidth="2" />
          <circle cx={CX} cy={CY} r="1.8" fill={idle ? "var(--text-mut)" : color} />
        </motion.g>
      </svg>

      {/* specular glint */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full mix-blend-screen"
        style={{
          x: glintX,
          y: glintY,
          width: size * 0.5,
          height: size * 0.5,
          top: size * 0.1,
          background: "radial-gradient(closest-side, oklch(1 0 0 / 0.14), transparent 70%)",
        }}
      />

      {/* center readout — HTML for crisp huge type, seated in the lower dial so it
          clears the needle hub at the exact centre */}
      <div
        className="pointer-events-none absolute inset-x-0 z-scene grid place-items-center text-center"
        style={{ top: "50%", transform: `translateY(calc(-50% + ${size * 0.14}px))` }}
      >
        {idle ? (
          <span className="etch max-w-[9rem] leading-relaxed" style={{ color: "var(--text-mut)" }}>
            {caption ?? "awaiting specimen"}
          </span>
        ) : (
          <>
            <div className="flex items-baseline justify-center font-display tabular-nums" style={{ color: "var(--text)" }}>
              <span style={{ fontSize: size * 0.27, lineHeight: 0.9, letterSpacing: "-0.04em", fontWeight: 600 }}>
                {play ? <Counter mv={scoreFromAngle} /> : Math.round(value as number)}
              </span>
              <span className="font-mono" style={{ fontSize: size * 0.058, color: "var(--text-mut)", marginLeft: size * 0.012 }}>
                /100
              </span>
            </div>
            {word && (
              <span className="etch mt-1.5" style={{ color, letterSpacing: "0.28em", fontSize: size * 0.038 }}>
                {word}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
