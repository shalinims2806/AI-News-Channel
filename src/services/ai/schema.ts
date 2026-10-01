import { z } from "zod";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import type { AiResult } from "./types";

const raw = z.object({
  headline: z.string().min(5).max(200),
  summary: z.string().min(20).max(1500),
  keyPoints: z.array(z.string().min(3).max(300)).max(8).default([]),
  category: z.string(),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
});

export function parseAiJson(text: string, fallbackCategory: CategorySlug): AiResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI response contained no JSON object");
  const parsed = raw.parse(JSON.parse(text.slice(start, end + 1)));
  const category = (CATEGORY_SLUGS as string[]).includes(parsed.category)
    ? (parsed.category as CategorySlug)
    : fallbackCategory;
  return {
    headline: parsed.headline.trim(),
    summary: parsed.summary.trim(),
    keyPoints: parsed.keyPoints.map((k) => k.trim()).slice(0, 5),
    category,
    tags: [...new Set(parsed.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 6),
  };
}
