// THE VERDICT. The read-and-illuminate plays, the needle settles, the parameter
// cards resolve, and the cure assembles. The overall score and the repair prompt
// are the only two things allowed to dominate — and never in the same instant
// (the score leads the hero, the cure leads the climax far below it).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import type { EvalReport } from "../lib/types";
import { anchorEvidence } from "../lib/text";
import { failureLabel, overallWord, tierOf } from "../lib/tiers";
import { useMotionPref } from "../lib/motionPref";
import { EASE_OUT_EXPO, revealChild, revealContainer, SOFT } from "../lib/motion";
import ScoreGauge from "./ScoreGauge";
import TaskBadge from "./TaskBadge";
import Specimen from "./Specimen";
import ParameterCard from "./ParameterCard";
import RepairPrompt from "./RepairPrompt";
import HonestyNote from "./HonestyNote";

interface Props {
  report: EvalReport;
  output: string;
  source: "live" | "fixture";
  onReset: () => void;
}

export default function VerdictView({ report, output, source, onReset }: Props) {
  const { reduced } = useMotionPref();
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  const anchored = useMemo(() => anchorEvidence(output, report.parameters), [output, report]);
  const problems = useMemo(() => {
    const m = new Map<string, number>();
    report.parameters.forEach((p) => p.findings.forEach((f) => m.set(failureLabel(f.failure_mode), (m.get(failureLabel(f.failure_mode)) ?? 0) + 1)));
    return [...m.entries()].map(([label, count]) => ({ label, count }));
  }, [report]);

  const overall = report.overall.score;
  const tier = tierOf(overall);
  const repair = report.improvement_prompts[0] ?? null;

  const cardsRef = useRef<HTMLDivElement>(null);
  const cardsInView = useInView(cardsRef, { once: true, margin: "-12%" });
  const cureRef = useRef<HTMLDivElement>(null);
  const cureInView = useInView(cureRef, { once: true, margin: "-18%" });

  // Safety floor: the scroll-triggered reveals are an enhancement, never a
  // visibility gate. If the observer never fires (idle user, hidden tab, headless
  // render) everything reveals anyway after a beat — content is never left blank.
  const [floor, setFloor] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFloor(true), 2600);
    return () => clearTimeout(t);
  }, []);
  const showCards = cardsInView || reduced || floor;
  const showCure = cureInView || reduced || floor;

  // reading-progress line, brighter on faster scroll (useVelocity)
  const { scrollYProgress } = useScroll();
  const prog = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const vel = useVelocity(scrollYProgress);
  const glow = useTransform(vel, [-2.5, 0, 2.5], [1, 0.35, 1]);

  return (
    <motion.section
      key="verdict"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
      className="relative mx-auto w-full max-w-[1160px] px-5 pb-32 pt-4 sm:px-8"
    >
      {/* reading progress */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-thread h-[2px] origin-left"
        style={{ scaleX: prog, background: "var(--ink)", opacity: glow, boxShadow: "0 0 10px var(--ink-glow)" }}
      />

      {/* toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-[0.8rem]"
          style={{ color: "var(--text-dim)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M11 6 5 12l6 6M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Examine another
        </button>
      </div>

      {/* HERO — the score dominates */}
      <motion.div variants={revealContainer} initial="hidden" animate="shown" className="flex flex-col items-center">
        <motion.div variants={revealChild}>
          <ScoreGauge value={overall} tier={tier} word={overallWord(overall)} phase="live" size={340} />
        </motion.div>
        <motion.p variants={revealChild} className="prose-measure mt-4 text-center text-[0.9rem]" style={{ color: "var(--text-mut)" }}>
          {report.overall.note}
        </motion.p>
        <div className="mt-5">
          <TaskBadge task={report.task} />
        </div>
      </motion.div>

      {/* SPECIMEN — receipts */}
      <div className="mx-auto mt-16 max-w-[880px]">
        <Specimen anchored={anchored} activeAnchor={activeAnchor} onHover={setActiveAnchor} play={!reduced} />
      </div>

      {/* PARAMETERS */}
      <div className="mt-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display font-semibold" style={{ fontSize: "clamp(1.3rem, 2.6vw, 1.75rem)", letterSpacing: "-0.03em", color: "var(--text)" }}>
            Parameter verdicts
          </h2>
          <span className="etch hidden sm:inline" style={{ color: "var(--text-mut)" }}>
            {report.parameters.length} measured · severity-weighted
          </span>
        </div>
        <motion.div
          ref={cardsRef}
          variants={revealContainer}
          initial="hidden"
          animate={showCards ? "shown" : "hidden"}
          className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {report.parameters.map((p, i) => (
            <ParameterCard
              key={p.parameter}
              param={p}
              index={i}
              keyToAnchor={anchored.keyToAnchor}
              activeAnchor={activeAnchor}
              onHover={setActiveAnchor}
            />
          ))}
        </motion.div>
      </div>

      {/* THE CURE — the climax */}
      <div ref={cureRef} className="mt-24">
        {repair ? (
          <RepairPrompt prompt={repair} problems={problems} active={showCure} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={showCure ? { opacity: 1, y: 0 } : {}}
            transition={SOFT}
            className="glass mx-auto max-w-[720px] p-7 text-center"
            style={{ boxShadow: "0 0 0 1px var(--ink-soft) inset, 0 40px 100px -40px var(--ink-glow), var(--shadow-lift)" }}
          >
            <span className="etch" style={{ color: "var(--ink)", letterSpacing: "0.26em" }}>nothing to repair</span>
            <p className="mt-3 text-[1.05rem]" style={{ color: "var(--text-dim)" }}>
              No fault crossed the threshold for a repair prompt. This output holds up on the checks Rubriq can run locally.
            </p>
          </motion.div>
        )}
      </div>

      {/* HONESTY */}
      <div className="mt-20">
        <HonestyNote notes={report.honesty_notes} source={source} />
      </div>

      <div className="mt-16 flex justify-center">
        <motion.button
          type="button"
          onClick={onReset}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="glass inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-[0.92rem] font-medium"
          style={{ color: "var(--text)" }}
        >
          Evaluate another output
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>
    </motion.section>
  );
}
