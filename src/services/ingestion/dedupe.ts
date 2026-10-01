import { jaccard, normalizeTitle, overlap, tokenize } from "./normalize";

export interface StoryCandidate {
  id: string;
  title: string;
  excerpt: string;
  sourceName: string;
  titleHash: string;
}

export interface IncomingItem {
  title: string;
  excerpt: string;
  sourceName: string;
}

export type MatchKind = "same-source-duplicate" | "same-story";

export interface MatchResult {
  kind: MatchKind;
  candidate: StoryCandidate;
  score: number;
}

/** Thresholds are deliberately conservative: a false merge hides a different story. */
export const TITLE_JACCARD = 0.62;
export const TITLE_OVERLAP = 0.8;
export const TEXT_JACCARD = 0.5;
const MIN_SHARED_TOKENS = 3;

/**
 * Layered duplicate detection (canonical URL is handled by a DB unique constraint before this):
 *  1. identical normalized headline
 *  2. headline token similarity (Jaccard / overlap)
 *  3. headline+excerpt text similarity
 * Two different outlets => same story (grouped). Same outlet + same headline => plain duplicate (skipped).
 * Optional 4th layer (LLM/embedding similarity) can be plugged in here for borderline scores.
 */
export function findStoryMatch(item: IncomingItem, pool: StoryCandidate[]): MatchResult | null {
  const hash = normalizeTitle(item.title);
  const tTokens = new Set(tokenize(item.title));
  const fullTokens = new Set(tokenize(`${item.title} ${item.excerpt}`));
  let best: MatchResult | null = null;

  for (const c of pool) {
    const sameSource = c.sourceName.toLowerCase() === item.sourceName.toLowerCase();
    if (c.titleHash === hash) {
      return { kind: sameSource ? "same-source-duplicate" : "same-story", candidate: c, score: 1 };
    }
    if (sameSource) continue; // a publisher's different headlines are different stories

    const cTokens = new Set(tokenize(c.title));
    let shared = 0;
    for (const t of tTokens) if (cTokens.has(t)) shared++;
    const titleScore = Math.max(jaccard(tTokens, cTokens), shared >= MIN_SHARED_TOKENS ? overlap(tTokens, cTokens) * 0.8 : 0);
    const textScore = jaccard(fullTokens, new Set(tokenize(`${c.title} ${c.excerpt}`)));

    const isMatch =
      (titleScore >= TITLE_JACCARD && shared >= MIN_SHARED_TOKENS) ||
      (overlap(tTokens, cTokens) >= TITLE_OVERLAP && shared >= 4) ||
      (textScore >= TEXT_JACCARD && shared >= MIN_SHARED_TOKENS);
    if (!isMatch) continue;

    const score = Math.max(titleScore, textScore);
    if (!best || score > best.score) best = { kind: "same-story", candidate: c, score };
  }
  return best;
}
