// The four demo specimens — an inviting way in, not a footnote. They reveal
// stagger-from-centre, carry a tier dot hinting the verdict, and lift on drag as
// a small delight (spring back to origin). Clicking loads the pair.
import { motion } from "framer-motion";
import { SAMPLES } from "../lib/samples";
import type { DemoSample } from "../lib/types";
import { tierColor, tierOf } from "../lib/tiers";
import { SOFT } from "../lib/motion";

const CENTER = (SAMPLES.length - 1) / 2;

export default function SampleChips({ onPick }: { onPick: (s: DemoSample) => void }) {
  return (
    <div>
      <span className="etch mb-3 block" style={{ color: "var(--text-mut)" }}>
        Or examine a specimen
      </span>
      <motion.div
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        {SAMPLES.map((s, i) => {
          const tier = tierOf(s.report.overall.score);
          return (
            <motion.button
              key={s.label}
              type="button"
              custom={Math.abs(i - CENTER)}
              variants={{
                hidden: { opacity: 0, y: 16, filter: "blur(5px)" },
                shown: (d: number) => ({
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { ...SOFT, delay: d * 0.06 },
                }),
              }}
              onClick={() => onPick(s)}
              drag
              dragSnapToOrigin
              dragElastic={0.16}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              whileDrag={{ scale: 1.04, cursor: "grabbing", boxShadow: "var(--shadow-lift)" }}
              className="glass group flex flex-col gap-1.5 p-3.5 text-left"
              style={{ borderRadius: "var(--r-md)" }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 flex-none rounded-full"
                  style={{ background: tierColor(tier), boxShadow: `0 0 8px ${tierColor(tier)}` }}
                />
                <span className="text-[0.9rem] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                  {s.label}
                </span>
              </span>
              <span className="font-mono leading-snug" style={{ fontSize: "0.64rem", color: "var(--text-mut)" }}>
                {s.hint}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
