// The four demo specimens. Inputs AND their real captured reports come from one
// file, so the offline fixture can never diverge from what the live engine returns.
import demo from "../data/demo.json";
import type { DemoSample, EvalReport } from "./types";

export const SAMPLES = demo as unknown as DemoSample[];

// Match an evaluation request to a known sample by its exact prompt+output, so the
// offline path can serve the right fixture silently. Whitespace-normalized to
// survive trivial editing (e.g. a trailing newline).
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function fixtureFor(prompt: string, output: string): EvalReport | null {
  const p = norm(prompt);
  const o = norm(output);
  const hit = SAMPLES.find((s) => norm(s.prompt) === p && norm(s.output) === o);
  return hit ? hit.report : null;
}
