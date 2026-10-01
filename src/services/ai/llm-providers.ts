import { parseAiJson } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { AiInput, AiProvider, AiResult } from "./types";

const timeoutMs = () => Number(process.env.AI_TIMEOUT_MS) || 30000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs()),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 0;
    throw Object.assign(new Error("AI rate limited (429)"), { rateLimited: true, retryAfter: retry });
  }
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Works with OpenAI and any OpenAI-compatible endpoint (Azure, OpenRouter, Ollama, ...). */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly model = process.env.AI_MODEL || "gpt-4o-mini";
  async process(input: AiInput): Promise<AiResult> {
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const data = await postJson(
      `${base}/chat/completions`,
      { authorization: `Bearer ${process.env.AI_API_KEY}` },
      {
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      },
    );
    return parseAiJson(data.choices?.[0]?.message?.content ?? "", input.categoryHint);
  }
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model = process.env.AI_MODEL || "claude-haiku-4-5-20251001";
  async process(input: AiInput): Promise<AiResult> {
    const base = (process.env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
    const data = await postJson(
      `${base}/v1/messages`,
      { "x-api-key": process.env.AI_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: 900,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      },
    );
    const text = (data.content ?? []).map((b: any) => b.text ?? "").join("");
    return parseAiJson(text, input.categoryHint);
  }
}
