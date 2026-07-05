// Faithful TypeScript mirror of rubriq/schemas.py (the engine's response contract).
// If the engine changes, these change — nothing in the UI invents fields.

export type TaskType =
  | "summarization"
  | "qa_grounded"
  | "qa_open"
  | "code_generation"
  | "creative_writing"
  | "extraction"
  | "reasoning"
  | "rewriting"
  | "general";

export type FailureMode =
  | "unfaithful_content"
  | "hallucination_risk"
  | "missed_constraint"
  | "incomplete_coverage"
  | "off_topic_drift"
  | "poor_structure"
  | "wrong_register"
  | "verbosity"
  | "weak_reasoning"
  | "format_violation"
  | "low_diversity"
  | "invalid_code"
  | "invented_fields";

export type ModelFamily = "claude" | "gpt" | "gemini" | "open_weights" | "generic";

export interface Evidence {
  quote: string;
  source: "output" | "prompt" | string;
  note: string;
}

export interface Finding {
  failure_mode: FailureMode;
  detail: string;
  evidence: Evidence[];
  data: Record<string, unknown>;
}

export interface ParameterScore {
  parameter: string;
  display_name: string;
  score: number | null;
  verdict: string;
  strengths: string[];
  findings: Finding[];
  is_proxy: boolean;
  requires_judge: boolean;
  skipped_reason: string;
  rubric_source: string;
}

export interface TaskClassification {
  task_type: TaskType;
  confidence: number; // 0..1
  signals: string[];
  has_source_text: boolean;
  instruction: string;
  source_text: string | null;
}

export interface ImprovementPrompt {
  failure_mode: FailureMode;
  title: string;
  diagnosis: string;
  prompt_text: string;
  model_family: ModelFamily;
  technique_source: string;
}

export interface OverallScore {
  score: number;
  note: string;
}

export interface EvalReport {
  task: TaskClassification;
  parameters: ParameterScore[];
  overall: OverallScore;
  improvement_prompts: ImprovementPrompt[];
  honesty_notes: string[];
  engine: string;
}

export interface EvalOptions {
  weights?: Record<string, number>;
  audience?: string;
  tone?: string;
}

export interface EvalRequest {
  prompt: string;
  output: string;
  model_name?: string;
  options?: EvalOptions;
}

// The demo.json shape: each sample carries its inputs AND its real captured report.
export interface DemoSample {
  label: string;
  hint: string;
  provider: string;
  model: string;
  prompt: string;
  output: string;
  report: EvalReport;
}
