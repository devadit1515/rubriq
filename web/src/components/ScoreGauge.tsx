// The score readout. A clean luminous arc that draws in to the value, a soft glowing
// bead at its tip, and the number counting up at the centre — no needle, no hub, no
// tick clutter. The arc, the bead, and the count-up all resolve together.
import { useEffect, useState } from "react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "framer-motion";
import { usePointer } from "../lib/pointer";
import { useMotionPref } from "../lib/motionPref";
import { tierColor, type Tier } from "../lib/tiers";

const START = -135;
const RANGE = 270;
const R = 84;
const CX = 100;
const CY = 100;

const angleOf = (v: number) => START + (Math.max(0, Math.min(100, v)) / 100) * RANGE;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
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
  value: number;
  tier: Tier;
  word: string;
  size?: number;
}

export default function ScoreGauge({ value, tier, word, size = 340 }: Props) {
  const { reduced } = useMotionPref();
  const { px, py } = usePointer();
  const color = tierColor(tier);
  const play = !reduced;
  const finalAngle = angleOf(value);
  const bead = polar(finalAngle, R);

  // one spring drives the count-up; the arc draws with a matched tween
  const target = useMotionValue(play ? 0 : value);
  const sv = useSpring(target, { stiffness: 46, damping: 16, mass: 1 });
  useEffect(() => {
    if (play) {
      const id = requestAnimationFrame(() => target.set(value));
      return () => cancelAnimationFrame(id);
    }
    target.jump(value);
  }, [play, value, target]);

  // faint parallax on the whole dial
  const k = reduced ? 0 : 1;
  const driftX = useTransform(px, (v) => v * 10 * k);
  const driftY = useTransform(py, (v) => v * 8 * k);

  return (
    <motion.div className="relative grid place-items-center" style={{ width: size, height: size, x: driftX, y: driftY }}>
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: `radial-gradient(closest-side, ${color}, transparent 70%)`,
          opacity: 0.1,
          filter: "blur(16px)",
        }}
      />

      <svg viewBox="0 0 200 200" width={size} height={size} className="absolute inset-0" aria-hidden>
        <defs>
          <filter id="gaugeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* track */}
        <path d={arcPath(START, START + RANGE, R)} fill="none" stroke="var(--line-2)" strokeWidth="5" strokeLinecap="round" />

        {/* value arc — draws in */}
        <motion.path
          d={arcPath(START, finalAngle, R)}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
          initial={{ pathLength: play ? 0 : 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: play ? 1.15 : 0, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* glowing bead at the value */}
        <motion.circle
          cx={bead.x}
          cy={bead.y}
          r="4.4"
          fill={color}
          filter="url(#gaugeGlow)"
          initial={{ opacity: play ? 0 : 1, scale: play ? 0.4 : 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: play ? 1.05 : 0, type: "spring", stiffness: 300, damping: 16 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      </svg>

      {/* centre readout — clean, no hub to collide with */}
      <div className="relative z-scene grid place-items-center text-center" style={{ transform: "translateY(-2%)" }}>
        <div className="flex items-baseline justify-center font-display tabular-nums" style={{ color: "var(--text)" }}>
          <span style={{ fontSize: size * 0.3, lineHeight: 0.9, letterSpacing: "-0.045em", fontWeight: 600 }}>
            {play ? <Counter mv={sv} /> : Math.round(value)}
          </span>
          <span className="font-mono" style={{ fontSize: size * 0.058, color: "var(--text-mut)", marginLeft: size * 0.014 }}>
            /100
          </span>
        </div>
        <span className="etch mt-2" style={{ color, letterSpacing: "0.3em", fontSize: size * 0.04 }}>
          {word}
        </span>
      </div>
    </motion.div>
  );
}
