import { db } from "@/lib/db";
import { errMsg, sleep, wordCount } from "@/lib/utils";
import { checkGrounding } from "./grounding";
import { HeuristicProvider } from "./heuristic";
import { AnthropicProvider, OpenAiProvider } from "./llm-providers";
import type { AiInput, AiProvider, AiResult } from "./types";

export type ProcessOutcome = AiResult & {
  readingTime: number;
  provider: string;
  /** true only when an LLM produced (and passed grounding checks for) the text */
  aiProcessed: boolean;
};

const heuristic = new HeuristicProvider();

export function getProvider(): AiProvider {
  const name = (process.env.AI_PROVIDER || "heuristic").toLowerCase();
  if (name !== "heuristic" && !process.env.AI_API_KEY) return heuristic; // no key => safe fallback
  if (name === "openai") return new OpenAiProvider();
  if (name === "anthropic") return new AnthropicProvider();
  return heuristic;
}

export const readingTimeOf = (r: AiResult) =>
  Math.max(1, Math.ceil(wordCount([r.summary, ...r.keyPoints].join(" ")) / 200));

async function log(d: { articleId?: string; provider: string; model?: string; ok: boolean; fallback: boolean; ms: number; error?: string }) {
  try {
    await db.aiProcessingLog.create({
      data: {
        articleId: d.articleId,
        provider: d.provider,
        model: d.model,
        ok: d.ok,
        fallback: d.fallback,
        durationMs: d.ms,
        error: d.error?.slice(0, 500),
      },
    });
  } catch {
    /* logging must never break the pipeline */
  }
}

/**
 * Runs the configured LLM with retry/backoff and output grounding checks.
 * Any failure degrades to the extractive heuristic so an article is always publishable.
 */
export async function processArticleText(
  input: AiInput,
  articleId?: string,
  opts: { skipLlm?: boolean } = {},
): Promise<ProcessOutcome> {
  const provider: AiProvider = opts.skipLlm ? heuristic : getProvider();
  const sourceText = `${input.title}\n${input.excerpt}`;

  if (provider.name !== "heuristic") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now();
      try {
        const result = await provider.process(input);
        const g = checkGrounding(result, sourceText);
        if (!g.ok) {
          await log({ articleId, provider: provider.name, model: provider.model, ok: false, fallback: true, ms: Date.now() - started, error: `grounding check failed: ${g.reason}` });
          break; // retrying rarely fixes a hallucination; use the extractive fallback
        }
        await log({ articleId, provider: provider.name, model: provider.model, ok: true, fallback: false, ms: Date.now() - started });
        return { ...result, readingTime: readingTimeOf(result), provider: provider.name, aiProcessed: true };
      } catch (e: any) {
        await log({ articleId, provider: provider.name, model: provider.model, ok: false, fallback: attempt === 2, ms: Date.now() - started, error: errMsg(e) });
        const wait = e?.rateLimited ? Math.max((e.retryAfter || 0) * 1000, 2000 * (attempt + 1)) : 800 * 2 ** attempt;
        if (attempt < 2) await sleep(Math.min(wait, 15000));
      }
    }
  }

  const started = Date.now();
  const result = await heuristic.process(input);
  await log({ articleId, provider: "heuristic", ok: true, fallback: provider.name !== "heuristic", ms: Date.now() - started });
  return { ...result, readingTime: readingTimeOf(result), provider: "heuristic", aiProcessed: false };
}
