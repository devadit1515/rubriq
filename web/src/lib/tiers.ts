// The schema gives a numeric score; the verdict TIER (weak / mixed / strong) and
// everything that keys off it — color, glow, bar weight, the hero word — is a UI
// derivation. Severity drives visual weight, per the brief. One place, no drift.

import type { FailureMode, ParameterScore, TaskType } from "./types";

export type Tier = "strong" | "mixed" | "weak" | "none";

// Thresholds validated against real engine output: the "done right" summary lands
// 74 → strong, the sabotaged one 33 → weak, a mid code answer 48 → mixed.
export function tierOf(score: number | null | undefined): Tier {
  if (score === null || score === undefined) return "none";
  if (score >= 70) return "strong";
  if (score >= 45) return "mixed";
  return "weak";
}

export const TIER_WORD: Record<Tier, string> = {
  strong: "Strong",
  mixed: "Mixed",
  weak: "Weak",
  none: "Not scored",
};

// CSS custom-property name carrying each tier's ink. Kept as vars so the whole
// palette is tunable in one stylesheet.
export const TIER_VAR: Record<Tier, string> = {
  strong: "--strong",
  mixed: "--mixed",
  weak: "--weak",
  none: "--platinum",
};

export function tierColor(tier: Tier): string {
  return `var(${TIER_VAR[tier]})`;
}

// Hero verdict word for the overall score. Tuned so the word matches the ink tier.
export function overallWord(score: number): string {
  const t = tierOf(score);
  if (t === "strong") return score >= 88 ? "Excellent" : "Strong";
  if (t === "mixed") return "Mixed";
  return score < 25 ? "Failing" : "Weak";
}

export function roundScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return Math.round(score);
}

// A parameter is "not scored" for one of two honest reasons; the UI treats them
// differently from a low score. `requires_judge` is the important carve-out.
export function notScoredKind(p: ParameterScore): "judge" | "skipped" | null {
  if (p.score !== null && p.score !== undefined) return null;
  return p.requires_judge ? "judge" : "skipped";
}

export const TASK_LABEL: Record<TaskType, string> = {
  summarization: "Summarization",
  qa_grounded: "Grounded Q&A",
  qa_open: "Open Q&A",
  code_generation: "Code generation",
  creative_writing: "Creative writing",
  extraction: "Extraction",
  reasoning: "Reasoning",
  rewriting: "Rewriting",
  general: "General",
};

// Short, human badge for a finding's failure mode — used on the specimen anchors
// and the parameter cards. Calm, never mocking.
export const FAILURE_LABEL: Record<FailureMode, string> = {
  unfaithful_content: "Unsupported by source",
  hallucination_risk: "Fabrication risk",
  missed_constraint: "Constraint missed",
  incomplete_coverage: "Incomplete",
  off_topic_drift: "Off topic",
  poor_structure: "Structure",
  wrong_register: "Register",
  verbosity: "Padding",
  weak_reasoning: "Weak reasoning",
  format_violation: "Format",
  low_diversity: "Repetitive",
  invalid_code: "Code defect",
  invented_fields: "Invented fields",
  factual_error: "Factual error",
  subjective_weakness: "Quality",
};

export function failureLabel(mode: FailureMode): string {
  return FAILURE_LABEL[mode] ?? "Finding";
}

export function pct(confidence: number): number {
  return Math.round(confidence * 100);
}
