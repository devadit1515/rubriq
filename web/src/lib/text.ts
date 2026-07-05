// Evidence anchoring — the engine behind "illuminate in place".
//
// The report quotes the guilty words, but those quotes are whitespace-normalized
// (newlines flattened to spaces) and sometimes truncated with an ellipsis. Naive
// indexOf fails on both. So we build a whitespace-insensitive regex per quote,
// locate it in the ORIGINAL output (newlines intact for rendering), and split the
// output into plain + highlighted segments. Overlapping evidence windows (the
// hallucination signals stack on the same sentence) merge into one lit span that
// carries every finding that pointed at it, so a card can light its phrase and a
// phrase can light its card.

import type { FailureMode, ParameterScore } from "./types";
import { tierOf, type Tier } from "./tiers";

export interface EvidenceRef {
  key: string; // `${paramIndex}:${findingIndex}`
  paramIndex: number;
  findingIndex: number;
  tier: Tier;
  failureMode: FailureMode;
  detail: string;
}

export interface Segment {
  text: string;
  anchorId?: string; // set when this segment is a lit evidence span
  tier?: Tier;
  refs?: EvidenceRef[];
}

export interface AnchoredOutput {
  segments: Segment[];
  keyToAnchor: Record<string, string>; // finding key -> the anchor it lit
  highlightCount: number;
}

const SEVERITY: Record<Tier, number> = { weak: 3, mixed: 2, strong: 1, none: 0 };

function quoteToRegex(quote: string): RegExp | null {
  // Drop a trailing ellipsis (unicode or three dots) left by truncation.
  const cleaned = quote
    .replace(/[…]+\s*$/, "")
    .replace(/\.\.\.\s*$/, "")
    .trim();
  if (cleaned.length < 4) return null;
  const escaped = cleaned
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex metacharacters (spaces survive)
    .replace(/\s+/g, "\\s+"); // then let any whitespace run match (space vs newline)
  try {
    return new RegExp(escaped);
  } catch {
    return null;
  }
}

interface Candidate {
  start: number;
  end: number;
  ref: EvidenceRef;
}

export function anchorEvidence(output: string, params: ParameterScore[]): AnchoredOutput {
  const candidates: Candidate[] = [];

  params.forEach((p, paramIndex) => {
    const tier = tierOf(p.score);
    p.findings.forEach((f, findingIndex) => {
      f.evidence.forEach((ev) => {
        if (ev.source !== "output") return; // only light the specimen (the output)
        const re = quoteToRegex(ev.quote);
        if (!re) return;
        const m = re.exec(output);
        if (!m || m.index < 0) return;
        candidates.push({
          start: m.index,
          end: m.index + m[0].length,
          ref: {
            key: `${paramIndex}:${findingIndex}`,
            paramIndex,
            findingIndex,
            tier,
            failureMode: f.failure_mode,
            detail: f.detail,
          },
        });
      });
    });
  });

  // Longest-first within a start position so the widest window wins the span.
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const spans: { start: number; end: number; refs: EvidenceRef[] }[] = [];
  for (const c of candidates) {
    const overlap = spans.find((s) => c.start < s.end && c.end > s.start);
    if (overlap) overlap.refs.push(c.ref);
    else spans.push({ start: c.start, end: c.end, refs: [c.ref] });
  }
  spans.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  const keyToAnchor: Record<string, string> = {};
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) segments.push({ text: output.slice(cursor, span.start) });
    const anchorId = `ev-${span.start}`;
    const tier = span.refs.reduce<Tier>(
      (worst, r) => (SEVERITY[r.tier] > SEVERITY[worst] ? r.tier : worst),
      "strong",
    );
    for (const r of span.refs) if (!keyToAnchor[r.key]) keyToAnchor[r.key] = anchorId;
    segments.push({ text: output.slice(span.start, span.end), anchorId, tier, refs: span.refs });
    cursor = span.end;
  }
  if (cursor < output.length) segments.push({ text: output.slice(cursor) });

  return { segments, keyToAnchor, highlightCount: spans.length };
}

// Word count used by the live counters — matches the engine's whitespace split.
export function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}
