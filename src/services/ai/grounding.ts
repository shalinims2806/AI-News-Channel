import type { AiResult } from "./types";

const numbersIn = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, ""));
const quotesIn = (s: string) => [...s.matchAll(/["“”]([^"“”]{6,})["“”]/g)].map((m) => m[1].trim().toLowerCase());

/**
 * Cheap hallucination guard. Any number or quoted phrase in the AI output must
 * appear in the source text, otherwise the result is rejected.
 */
export function checkGrounding(result: AiResult, sourceText: string): { ok: boolean; reason?: string } {
  const src = sourceText.toLowerCase();
  const srcNums = new Set(numbersIn(sourceText));
  const out = [result.headline, result.summary, ...result.keyPoints].join(" \n ");
  for (const n of numbersIn(out)) {
    if (!srcNums.has(n)) return { ok: false, reason: `number "${n}" not in source` };
  }
  for (const q of quotesIn(out)) {
    if (!src.includes(q)) return { ok: false, reason: `quote "${q.slice(0, 40)}" not in source` };
  }
  return { ok: true };
}
