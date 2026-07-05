// Engine client. Always relative paths — the Vite dev proxy and Vercel rewrites
// forward /evaluate, /health, /warmup to the FastAPI engine, so there is no CORS
// and no per-environment base URL. When the engine is asleep/offline and the user
// runs one of the built-in samples, we serve its baked fixture silently: the demo
// looks flawless whether or not the models are awake.

import { fixtureFor } from "./samples";
import type { EvalReport, EvalRequest } from "./types";

export interface EvalResult {
  report: EvalReport;
  source: "live" | "fixture";
}

export class EngineOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineOfflineError";
  }
}

// Merge the caller's cancel signal with an internal timeout.
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  // AbortSignal.any is supported in current Chrome/Firefox/Safari and Node 20+.
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

export async function evaluate(req: EvalRequest, signal?: AbortSignal): Promise<EvalResult> {
  const fixture = fixtureFor(req.prompt, req.output);
  try {
    const res = await fetch("/evaluate?engine=local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: withTimeout(signal, 45_000),
    });
    if (!res.ok) {
      if (fixture) return { report: fixture, source: "fixture" };
      const detail = await res
        .json()
        .then((d) => d?.detail as string)
        .catch(() => "");
      throw new EngineOfflineError(detail || `The engine returned ${res.status}.`);
    }
    return { report: (await res.json()) as EvalReport, source: "live" };
  } catch (err) {
    // A caller-initiated cancel must propagate so the UI can distinguish it.
    if (signal?.aborted) throw err;
    if (fixture) return { report: fixture, source: "fixture" };
    throw new EngineOfflineError(
      "The local engine is asleep or unreachable. It wakes in ~30s — retry, or load a sample to see a full report now.",
    );
  }
}

export type EngineState = "checking" | "ready" | "waking" | "offline";

export interface Health {
  state: EngineState;
  embeddings: boolean;
  nli: boolean;
}

export async function pingHealth(timeoutMs = 6000): Promise<Health> {
  try {
    const res = await fetch("/health", { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { state: "offline", embeddings: false, nli: false };
    const data = (await res.json()) as { status?: string; models?: { embeddings?: boolean; nli?: boolean } };
    const embeddings = !!data.models?.embeddings;
    const nli = !!data.models?.nli;
    return { state: embeddings && nli ? "ready" : "waking", embeddings, nli };
  } catch {
    return { state: "offline", embeddings: false, nli: false };
  }
}

// Fire-and-forget: nudge the engine to load its models so the first real
// evaluation doesn't pay the cost. Never throws.
export function warmup(): void {
  fetch("/warmup", { method: "POST", signal: AbortSignal.timeout(90_000) }).catch(() => {});
}
