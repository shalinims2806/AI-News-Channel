import type { CategorySlug } from "@/config/categories";

export interface AiInput {
  title: string;
  /** Short feed excerpt (never full article text). May be empty. */
  excerpt: string;
  sourceName: string;
  language: string;
  categoryHint: CategorySlug;
}

export interface AiResult {
  headline: string;
  summary: string;
  keyPoints: string[];
  category: CategorySlug;
  tags: string[];
}

export interface AiProvider {
  readonly name: string;
  readonly model?: string;
  process(input: AiInput): Promise<AiResult>;
}
