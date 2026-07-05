// One evaluation parameter as an instrument-glass card. Severity is legible
// instantly — score color, ring intensity, and a meter that springs to value as
// the card enters view. Proxies and judge-only checks are honestly badged, never
// shown as a red zero. Expands to the verdict, strengths, and quoted evidence;
// hovering a finding lights its phrase back in the specimen.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ParameterScore } from "../lib/types";
import { failureLabel, notScoredKind, roundScore, tierColor, tierOf, TIER_WORD } from "../lib/tiers";
import { SOFT, revealChild } from "../lib/motion";

interface Props {
  param: ParameterScore;
  index: number;
  keyToAnchor: Record<string, string>;
  activeAnchor: string | null;
  onHover: (id: string | null) => void;
}

export default function ParameterCard({ param, index, keyToAnchor, activeAnchor, onHover }: Props) {
  const [open, setOpen] = useState(false);
  const tier = tierOf(param.score);
  const color = tierColor(tier);
  const notScored = notScoredKind(param);
  const score = roundScore(param.score);

  // severity → visual weight (weak carries the most ring/glow)
  const ringAlpha = notScored ? 0.12 : tier === "weak" ? 0.5 : tier === "mixed" ? 0.32 : 0.22;

  const anchorIds = param.findings
    .map((_, fi) => keyToAnchor[`${index}:${fi}`])
    .filter(Boolean) as string[];
  const cardActive = activeAnchor !== null && anchorIds.includes(activeAnchor);

  const hasBody = param.strengths.length > 0 || param.findings.length > 0 || notScored;

  return (
    <motion.div
      variants={revealChild}
      onMouseEnter={() => anchorIds[0] && onHover(anchorIds[0])}
      onMouseLeave={() => onHover(null)}
      className="glass flex flex-col p-4 sm:p-5"
      style={{
        boxShadow: cardActive
          ? `0 0 0 1px ${color} inset, 0 0 30px -10px ${color}, var(--shadow-glass)`
          : `0 0 0 1px oklch(from ${color} l c h / ${ringAlpha}) inset, var(--shadow-glass)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[0.98rem] font-semibold leading-tight" style={{ color: "var(--text)" }}>
              {param.display_name.replace(/\s*\(proxy\)/i, "")}
            </h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {param.is_proxy && <Badge label="proxy" tone="muted" title="A statistical stand-in, not the subjective quality itself" />}
            {notScored === "judge" && <Badge label="needs judge" tone="muted" title="Cannot be judged locally — requires LLM-judge mode" />}
            {!notScored && (
              <span className="etch" style={{ color, letterSpacing: "0.2em", fontSize: "0.58rem" }}>
                {TIER_WORD[tier]}
              </span>
            )}
          </div>
        </div>

        <div className="flex-none text-right">
          {notScored ? (
            <span className="font-mono text-[0.78rem]" style={{ color: "var(--text-mut)" }}>
              {notScored === "judge" ? "judge only" : "n/a"}
            </span>
          ) : (
            <span className="font-display tabular-nums leading-none" style={{ fontSize: "1.95rem", color, letterSpacing: "-0.03em", fontWeight: 600 }}>
              {score}
            </span>
          )}
        </div>
      </div>

      {/* meter — springs to value in view; thicker/glowier for worse scores */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--line-2)" }}>
        {!notScored && (
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ background: color, boxShadow: tier === "weak" ? `0 0 10px ${color}` : "none" }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: (score ?? 0) / 100 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={SOFT}
          />
        )}
      </div>

      <p className="mt-3 text-[0.85rem] leading-snug" style={{ color: "var(--text-dim)" }}>
        {param.verdict}
      </p>

      {hasBody && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-3 flex items-center gap-1.5 self-start etch"
            style={{ color: "var(--text-mut)", fontSize: "0.58rem" }}
          >
            <motion.svg width="11" height="11" viewBox="0 0 24 24" fill="none" animate={{ rotate: open ? 90 : 0 }} transition={SOFT}>
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
            {open ? "hide detail" : param.findings.length ? `${param.findings.length} finding${param.findings.length === 1 ? "" : "s"} · evidence` : "detail"}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SOFT}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                  {param.strengths.map((s, i) => (
                    <div key={`s${i}`} className="flex gap-2 text-[0.82rem]" style={{ color: "var(--text-dim)" }}>
                      <span style={{ color: "var(--strong)" }}>✓</span>
                      <span>{s}</span>
                    </div>
                  ))}

                  {param.findings.map((f, fi) => {
                    const anchor = keyToAnchor[`${index}:${fi}`];
                    return (
                      <div
                        key={`f${fi}`}
                        onMouseEnter={() => anchor && onHover(anchor)}
                        onMouseLeave={() => onHover(null)}
                        className="rounded-[9px] p-2.5"
                        style={{ background: activeAnchor && anchor === activeAnchor ? "oklch(0.85 0.14 160 / 0.06)" : "oklch(0.5 0.02 260 / 0.14)" }}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="rounded px-1.5 py-0.5 font-mono" style={{ fontSize: "0.58rem", color, background: `oklch(from ${color} l c h / 0.14)` }}>
                            {failureLabel(f.failure_mode)}
                          </span>
                        </div>
                        <p className="text-[0.82rem] leading-snug" style={{ color: "var(--text-dim)" }}>
                          {f.detail}
                        </p>
                        {f.evidence.map((ev, ei) => (
                          <blockquote
                            key={ei}
                            className="mt-2 border-l-2 pl-2.5 font-mono text-[0.76rem] leading-snug"
                            style={{ borderColor: ev.source === "output" ? color : "var(--line-2)", color: "var(--text-mut)" }}
                          >
                            <span style={{ color: ev.source === "output" ? "var(--text-dim)" : "var(--text-mut)" }}>“{ev.quote}”</span>
                            {ev.note && <span className="mt-0.5 block" style={{ fontStyle: "italic", opacity: 0.75 }}>— {ev.note}</span>}
                            {ev.source === "prompt" && !ev.note && <span className="mt-0.5 block opacity-70">— from your prompt</span>}
                          </blockquote>
                        ))}
                      </div>
                    );
                  })}

                  {param.rubric_source && (
                    <p className="pt-1 font-mono text-[0.66rem] leading-snug" style={{ color: "var(--text-mut)" }}>
                      grounded in {param.rubric_source}
                    </p>
                  )}
                  {notScored && param.skipped_reason && (
                    <p className="text-[0.78rem]" style={{ color: "var(--text-mut)" }}>
                      Not scored — {param.skipped_reason}.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function Badge({ label, tone, title }: { label: string; tone: "muted"; title: string }) {
  return (
    <span
      title={title}
      className="rounded px-1.5 py-0.5 font-mono"
      style={{ fontSize: "0.56rem", letterSpacing: "0.06em", color: "var(--text-mut)", background: "oklch(0.5 0.02 260 / 0.2)", textTransform: "uppercase" }}
    >
      {tone === "muted" ? label : label}
    </span>
  );
}
