import { CATEGORIES, type CategorySlug } from "@/config/categories";
import { splitSentences, truncate } from "@/lib/utils";
import type { AiInput, AiProvider, AiResult } from "./types";

const KEYWORDS: Record<CategorySlug, string[]> = {
  ai: ["artificial intelligence", "openai", "chatgpt", "gemini", "llm", "machine learning", "anthropic", "deepmind", "generative", "chatbot", "neural", "copilot", "nvidia"],
  technology: ["software", "smartphone", "app ", "cyber", "chip", "startup", "google", "apple", "microsoft", "internet", "gadget", "semiconductor", "5g", "android", "cloud"],
  business: ["market", "stocks", "sensex", "nifty", "economy", "inflation", "rbi", "gdp", "earnings", "profit", "shares", "bank", "trade", "investors", "revenue", "rupee"],
  india: ["india", "delhi", "mumbai", "lok sabha", "rajya sabha", "modi", "bengaluru", "hyderabad", "kolkata", "parliament", "isro", "indian", "bjp", "congress", "mla", "mlc", "chief minister", "high court", "supreme court", "police", "state government", "district"],
  "tamil-nadu": ["tamil nadu", "chennai", "madurai", "coimbatore", "tamil", "stalin", "trichy", "tiruchi", "salem"],
  world: ["united nations", "war", "president", "ukraine", "gaza", "china", "europe", "russia", "summit", "nato", "u.s.", "white house", "israel", "iran"],
  sports: ["cricket", "football", "match", "tournament", "olympic", "fifa", "ipl", "tennis", "goal", "wicket", "league", "champion", "coach"],
  entertainment: ["film", "movie", "actor", "actress", "box office", "album", "series", "netflix", "trailer", "bollywood", "kollywood", "singer", "festival"],
  science: ["nasa", "research", "study", "scientists", "space", "climate", "planet", "telescope", "species", "vaccine", "physics", "discovery"],
  other: [],
};

const STOP_TAGS = new Set(["The", "This", "That", "These", "After", "Before", "With", "From", "Will", "Have", "What", "When", "Why", "How", "Who", "New", "Here", "Their", "They", "But", "And", "For", "Not", "Its", "Has", "Was", "Were"]);

export function guessCategory(text: string, hint: CategorySlug): CategorySlug {
  const t = ` ${text.toLowerCase()} `;
  let best: CategorySlug = hint;
  let bestScore = hint === "other" ? 0 : 0.5; // small prior for the source's configured category
  for (const c of CATEGORIES) {
    const score = KEYWORDS[c.slug].reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0) + (c.slug === hint ? 0.5 : 0);
    if (score > bestScore) {
      best = c.slug;
      bestScore = score;
    }
  }
  return best;
}

export function extractTags(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z0-9]{2,}(?:\s[A-Z][a-zA-Z0-9]{2,}){0,2})\b/g)) {
    const tag = m[1];
    const atSentenceStart = m.index === 0 || /[.!?:]\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index));
    if (atSentenceStart && !tag.includes(" ")) continue; // capitalised only because it starts a sentence
    if (STOP_TAGS.has(tag)) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([t]) => t);
}

/**
 * Extractive, no-LLM fallback. It can only quote/trim the source text, so it
 * cannot hallucinate. Used when no AI key is configured or the LLM fails.
 */
export class HeuristicProvider implements AiProvider {
  readonly name = "heuristic";
  async process(i: AiInput): Promise<AiResult> {
    const sentences = splitSentences(i.excerpt);
    const body = sentences.slice(0, 3).join(" ");
    const summary = body ? truncate(body, 520) : `The publisher did not include a summary in its feed. Read the full report at ${i.sourceName}.`;
    const text = `${i.title}. ${i.excerpt}`;
    return {
      headline: i.title,
      summary,
      keyPoints: sentences.slice(0, 4).map((s) => truncate(s, 220)),
      category: guessCategory(text, i.categoryHint),
      tags: extractTags(text),
    };
  }
}
