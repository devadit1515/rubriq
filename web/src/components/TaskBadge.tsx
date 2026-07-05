// What the instrument decided it was looking at: task type, confidence, and
// whether source text was found in the prompt (which decides what can be checked).
import { motion } from "framer-motion";
import type { TaskClassification } from "../lib/types";
import { TASK_LABEL, pct } from "../lib/tiers";
import { revealChild } from "../lib/motion";

export default function TaskBadge({ task }: { task: TaskClassification }) {
  return (
    <motion.div variants={revealChild} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <span className="etch" style={{ color: "var(--text-mut)" }}>
        classified as
      </span>
      <span
        className="rounded-full px-3 py-1 text-[0.82rem] font-medium"
        style={{ background: "oklch(0.85 0.14 160 / 0.1)", color: "var(--ink)", boxShadow: "0 0 0 1px var(--line) inset" }}
      >
        {TASK_LABEL[task.task_type]}
      </span>
      <span className="font-mono text-[0.72rem]" style={{ color: "var(--text-mut)" }}>
        {pct(task.confidence)}% confidence
      </span>
      <span className="h-3 w-px" style={{ background: "var(--line-2)" }} />
      <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem]" style={{ color: "var(--text-mut)" }}>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: task.has_source_text ? "var(--ink)" : "var(--text-mut)" }}
        />
        {task.has_source_text ? "source text detected" : "no source · open-world"}
      </span>
    </motion.div>
  );
}
