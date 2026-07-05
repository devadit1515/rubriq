// The specimen under examination. The output stays present with its evidence
// highlighted in place — receipts you can see. A light bar reads down the text
// once; the guilty phrases carry a tier-coloured highlight. Each flagged phrase is
// anchored to the finding it triggered, so hovering either one lights the other.
import { motion } from "framer-motion";
import { type AnchoredOutput } from "../lib/text";
import { tierColor, type Tier } from "../lib/tiers";

interface Props {
  anchored: AnchoredOutput;
  activeAnchor: string | null;
  onHover: (id: string | null) => void;
  play: boolean;
}

function Mark({
  text,
  anchorId,
  tier,
  active,
  onHover,
}: {
  text: string;
  anchorId: string;
  tier: Tier;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  const color = tierColor(tier);
  return (
    <span
      tabIndex={0}
      role="mark"
      aria-label={`flagged phrase: ${text}`}
      onMouseEnter={() => onHover(anchorId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(anchorId)}
      onBlur={() => onHover(null)}
      className="cursor-help rounded-[3px] outline-none"
      style={{
        background: active ? `oklch(from ${color} l c h / 0.36)` : `oklch(from ${color} l c h / 0.2)`,
        boxShadow: active ? `0 0 0 1px oklch(from ${color} l c h / 0.55)` : "none",
        color: "var(--text)",
        padding: "1px 2px",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        transition: "background 200ms, box-shadow 200ms",
      }}
    >
      {text}
    </span>
  );
}

export default function Specimen({ anchored, activeAnchor, onHover, play }: Props) {
  return (
    <div className="glass relative overflow-hidden p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="etch" style={{ color: "var(--text-mut)" }}>
          the specimen · examined
        </span>
        {anchored.highlightCount > 0 && (
          <span className="font-mono text-[0.68rem]" style={{ color: "var(--text-dim)" }}>
            {anchored.highlightCount} phrase{anchored.highlightCount === 1 ? "" : "s"} flagged
          </span>
        )}
      </div>

      <p
        className="relative font-mono leading-[1.9]"
        style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--text-dim)", wordBreak: "break-word" }}
      >
        {anchored.segments.map((seg, i) =>
          seg.anchorId ? (
            <Mark
              key={i}
              text={seg.text}
              anchorId={seg.anchorId}
              tier={(seg.tier ?? "weak") as Tier}
              active={activeAnchor === seg.anchorId}
              onHover={onHover}
            />
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>

      {/* the reading light — sweeps down once */}
      {play && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-scene mix-blend-screen"
          style={{
            height: "26%",
            background: "linear-gradient(180deg, transparent, oklch(0.85 0.16 160 / 0.12) 50%, transparent)",
            filter: "blur(6px)",
          }}
          initial={{ top: "-26%", opacity: 0 }}
          animate={{ top: ["-26%", "104%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.4, ease: "easeInOut", times: [0, 0.1, 0.9, 1] }}
        />
      )}
    </div>
  );
}
