import type { Source } from "@prisma/client";
import { isCategorySlug, type CategorySlug } from "@/config/categories";
import { pipelineConfig } from "@/config/site";
import { db } from "@/lib/db";
import { sha1 } from "@/lib/server-utils";
import { errMsg, safeHttpUrl, slugify, truncate } from "@/lib/utils";
import { getProvider, processArticleText } from "@/services/ai";
import { notifyTelegram } from "@/services/telegram";
import { findStoryMatch, type StoryCandidate } from "./dedupe";
import { fetchSource, type RawItem } from "./feeds";
import { canonicalizeUrl, normalizeTitle, stripPublisherSuffix } from "./normalize";
import { computeTrending } from "./trending";

export interface RunSummary {
  ok: boolean;
  skipped?: string;
  sources: { name: string; ok: boolean; items: number; error?: string }[];
  created: number;
  grouped: number;
  duplicates: number;
  invalid: number;
  aiProcessed: number;
  telegramSent: number;
  durationMs: number;
}

interface Entry { source: Source; item: RawItem }
interface Counters { created: number; grouped: number; duplicates: number; invalid: number; aiProcessed: number; telegramSent: number }

const LOCK_KEY = "ingest_lock";
const LOCK_TTL_MS = 8 * 60_000;
const MAX_TELEGRAM_PER_RUN = 5;
const TELEGRAM_MAX_AGE_MS = 6 * 3600_000;

async function acquireLock(): Promise<boolean> {
  const now = Date.now();
  const cur = await db.systemSetting.findUnique({ where: { key: LOCK_KEY } });
  if (cur && now - Number(cur.value) < LOCK_TTL_MS) return false;
  await db.systemSetting.upsert({ where: { key: LOCK_KEY }, update: { value: String(now) }, create: { key: LOCK_KEY, value: String(now) } });
  return true;
}
const releaseLock = () => db.systemSetting.deleteMany({ where: { key: LOCK_KEY } }).catch(() => {});

async function mapLimit<T, R>(arr: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, arr.length) }, async () => {
      while (i < arr.length) {
        const idx = i++;
        out[idx] = await fn(arr[idx]);
      }
    }),
  );
  return out;
}

async function upsertTags(names: string[]) {
  const unique = new Map<string, string>();
  for (const n of names) {
    const slug = slugify(n, 40);
    if (slug && !unique.has(slug)) unique.set(slug, n.slice(0, 40));
  }
  const ids: string[] = [];
  for (const [slug, name] of unique) {
    const t = await db.tag.upsert({ where: { slug }, update: {}, create: { slug, name } });
    ids.push(t.id);
  }
  return ids;
}

/** Story becomes "breaking" automatically ONLY when enough independent outlets carry it, quickly. */
async function evaluateBreaking(primaryId: string) {
  const p = await db.article.findUnique({ where: { id: primaryId }, select: { sourceCount: true, publishedAt: true, isBreaking: true, breakingManual: true } });
  if (!p || p.breakingManual || p.isBreaking) return;
  const withinWindow = Date.now() - p.publishedAt.getTime() < pipelineConfig.breakingWindowHours * 3600_000;
  if (withinWindow && p.sourceCount >= pipelineConfig.breakingMinSources) {
    await db.article.update({ where: { id: primaryId }, data: { isBreaking: true } });
  }
}

/** Auto-flagged breaking stories expire; manual flags stay until an admin clears them. */
async function expireBreaking() {
  await db.article.updateMany({
    where: { isBreaking: true, breakingManual: false, publishedAt: { lt: new Date(Date.now() - 6 * 3600_000) } },
    data: { isBreaking: false },
  });
}

/**
 * Core of the pipeline: validate → dedupe → (group | classify+summarize) → store → publish → notify.
 * Entries must be sorted newest-first. Exported so seeding/tests can feed it sample data.
 */
export async function processEntries(entries: Entry[], notify = true): Promise<Counters> {
  const c: Counters = { created: 0, grouped: 0, duplicates: 0, invalid: 0, aiProcessed: 0, telegramSent: 0 };
  const now = Date.now();
  const maxAgeMs = pipelineConfig.maxArticleAgeHours * 3600_000;
  let aiBudget = pipelineConfig.maxAiPerRun;

  // Step 1-2: validate and canonicalize.
  const valid: (Entry & { canonical: string; title: string; publisher: string; published: Date })[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    try {
      const link = safeHttpUrl(e.item.link);
      const publisher = e.item.publisher?.trim() || e.source.name;
      const title = stripPublisherSuffix(e.item.title, e.item.publisher ?? undefined).replace(/\s+/g, " ").trim();
      if (!link || title.length < 12 || title.length > 300) { c.invalid++; continue; }
      let published = e.item.publishedAt ?? new Date(now);
      if (published.getTime() > now + 3600_000) published = new Date(now); // future-dated feeds
      if (now - published.getTime() > maxAgeMs) { c.invalid++; continue; }
      const canonical = canonicalizeUrl(link);
      if (seen.has(canonical)) { c.duplicates++; continue; }
      seen.add(canonical);
      valid.push({ ...e, canonical, title, publisher, published });
    } catch { c.invalid++; }
  }
  if (!valid.length) return c;

  // Step 3a: exact canonical-URL duplicates already stored.
  const existing = await db.article.findMany({ where: { canonicalUrl: { in: valid.map((v) => v.canonical) } }, select: { canonicalUrl: true } });
  const existingSet = new Set(existing.map((x) => x.canonicalUrl));

  // Step 3b: pool of recent primary stories for headline/content similarity.
  const recentRows = await db.article.findMany({
    where: { primaryId: null, publishedAt: { gte: new Date(now - 96 * 3600_000) } },
    select: { id: true, title: true, originalTitle: true, contentExcerpt: true, sourceName: true, titleHash: true },
    orderBy: { publishedAt: "desc" },
    take: 1500,
  });
  const pool: StoryCandidate[] = recentRows.map((r) => ({ id: r.id, title: r.originalTitle, excerpt: r.contentExcerpt ?? "", sourceName: r.sourceName, titleHash: r.titleHash }));

  for (const v of valid) {
    if (existingSet.has(v.canonical)) { c.duplicates++; continue; }
    try {
      const excerpt = v.item.excerpt;
      const match = findStoryMatch({ title: v.title, excerpt, sourceName: v.publisher }, pool);
      if (match?.kind === "same-source-duplicate") { c.duplicates++; continue; }

      const baseData = {
        originalTitle: v.title,
        contentExcerpt: excerpt || null,
        sourceId: v.source.id,
        sourceName: v.publisher,
        sourceUrl: v.item.link,
        canonicalUrl: v.canonical,
        imageUrl: safeHttpUrl(v.item.imageUrl),
        publishedAt: v.published,
        author: v.item.author?.slice(0, 120) ?? null,
        language: v.source.language,
        titleHash: normalizeTitle(v.title),
      };
      const slug = `${slugify(v.title, 70)}-${sha1(v.canonical).slice(0, 6)}`;

      // Same story reported by another outlet → attach as an additional report.
      if (match) {
        const primary = await db.article.findUnique({ where: { id: match.candidate.id }, select: { category: true, status: true } });
        if (primary) {
          await db.article.create({
            data: { ...baseData, title: v.title, slug, summary: truncate(excerpt || v.title, 400), keyPoints: [], category: primary.category, primaryId: match.candidate.id, status: primary.status, aiProcessed: false, aiProvider: null },
          });
          const count = await db.article.count({ where: { OR: [{ id: match.candidate.id }, { primaryId: match.candidate.id }] } });
          const distinct = await db.article.findMany({ where: { OR: [{ id: match.candidate.id }, { primaryId: match.candidate.id }] }, select: { sourceName: true }, distinct: ["sourceName"] });
          await db.article.update({ where: { id: match.candidate.id }, data: { sourceCount: Math.max(1, Math.min(count, distinct.length)) } });
          await evaluateBreaking(match.candidate.id);
          c.grouped++;
          continue;
        }
      }

      // New story → AI classification + summary (heuristic once the per-run budget is spent).
      const hint: CategorySlug = isCategorySlug(v.source.category) ? v.source.category : "other";
      const useLlm = aiBudget > 0 && getProvider().name !== "heuristic";
      if (useLlm) aiBudget--;
      const ai = await processArticleText({ title: v.title, excerpt, sourceName: v.publisher, language: v.source.language, categoryHint: hint }, undefined, { skipLlm: !useLlm });
      const tagIds = await upsertTags(ai.tags);
      const article = await db.article.create({
        data: {
          ...baseData,
          title: ai.headline,
          slug,
          summary: ai.summary,
          keyPoints: ai.keyPoints,
          category: ai.category,
          readingTime: ai.readingTime,
          aiProcessed: ai.aiProcessed,
          aiProvider: ai.provider,
          aiAttempts: 1,
          status: "PUBLISHED", // auto-publish: no manual step
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        select: { id: true, title: true, summary: true, category: true, slug: true, isBreaking: true },
      });
      pool.unshift({ id: article.id, title: v.title, excerpt, sourceName: v.publisher, titleHash: baseData.titleHash });
      c.created++;
      if (ai.aiProcessed) c.aiProcessed++;

      if (notify && c.telegramSent < MAX_TELEGRAM_PER_RUN && now - v.published.getTime() < TELEGRAM_MAX_AGE_MS) {
        if (await notifyTelegram(article)) c.telegramSent++;
      }
    } catch (e) {
      // A single bad item (or transient DB error) must not abort the batch.
      c.invalid++;
      console.error("[ingest] item failed:", v.title.slice(0, 60), errMsg(e));
    }
  }
  return c;
}

/** Re-run the LLM on articles that were published with the extractive fallback. */
async function retryPendingAi(limit: number): Promise<number> {
  if (getProvider().name === "heuristic" || limit <= 0) return 0;
  const rows = await db.article.findMany({
    where: { aiProcessed: false, aiAttempts: { lt: 3 }, primaryId: null, status: { not: "DRAFT" } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  let n = 0;
  for (const a of rows) {
    const hint: CategorySlug = isCategorySlug(a.category) ? a.category : "other";
    const ai = await processArticleText({ title: a.originalTitle, excerpt: a.contentExcerpt ?? "", sourceName: a.sourceName, language: a.language, categoryHint: hint }, a.id);
    await db.article.update({ where: { id: a.id }, data: { aiAttempts: { increment: 1 } } });
    if (!ai.aiProcessed) continue;
    const tagIds = await upsertTags(ai.tags);
    await db.$transaction([
      db.articleTag.deleteMany({ where: { articleId: a.id } }),
      db.article.update({
        where: { id: a.id },
        data: { title: ai.headline, summary: ai.summary, keyPoints: ai.keyPoints, category: ai.category, readingTime: ai.readingTime, aiProcessed: true, aiProvider: ai.provider, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
      }),
    ]);
    n++;
  }
  return n;
}

async function cleanup() {
  const d = (days: number) => new Date(Date.now() - days * 86400_000);
  await Promise.all([
    db.articleView.deleteMany({ where: { createdAt: { lt: d(30) } } }),
    db.searchLog.deleteMany({ where: { createdAt: { lt: d(14) } } }),
    db.sourceFetchLog.deleteMany({ where: { createdAt: { lt: d(14) } } }),
    db.aiProcessingLog.deleteMany({ where: { createdAt: { lt: d(14) } } }),
  ]).catch(() => {});
}

/** Fetch one source and record its health. Never throws. */
export async function fetchAndRecord(source: Source): Promise<{ entries: Entry[]; error?: string; count: number }> {
  const started = Date.now();
  try {
    const feed = await fetchSource(source);
    await db.source.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastStatus: "ok", lastError: null, failureCount: 0 } });
    await db.sourceFetchLog.create({ data: { sourceId: source.id, ok: true, itemCount: feed.items.length, durationMs: Date.now() - started } });
    return { entries: feed.items.map((item) => ({ source, item })), count: feed.items.length };
  } catch (e) {
    const error = errMsg(e).slice(0, 300);
    await db.source.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastStatus: "error", lastError: error, failureCount: { increment: 1 } } }).catch(() => {});
    await db.sourceFetchLog.create({ data: { sourceId: source.id, ok: false, error, durationMs: Date.now() - started } }).catch(() => {});
    return { entries: [], error, count: 0 };
  }
}

/** Full scheduled run. Safe to call from cron, the worker, or the admin "Run now" button. */
export async function runIngestion(opts: { sourceIds?: string[]; notify?: boolean } = {}): Promise<RunSummary> {
  const started = Date.now();
  const empty: RunSummary = { ok: true, sources: [], created: 0, grouped: 0, duplicates: 0, invalid: 0, aiProcessed: 0, telegramSent: 0, durationMs: 0 };

  if (!(await acquireLock())) return { ...empty, skipped: "another ingestion run is in progress", durationMs: 0 };
  try {
    const sources = await db.source.findMany({ where: { enabled: true, ...(opts.sourceIds ? { id: { in: opts.sourceIds } } : {}) } });

    // Fetch phase: one failing source never blocks the others (Promise-level isolation in fetchAndRecord).
    const fetched = await mapLimit(sources, 4, fetchAndRecord);
    const entries = fetched.flatMap((f) => f.entries).sort((a, b) => (b.item.publishedAt?.getTime() ?? 0) - (a.item.publishedAt?.getTime() ?? 0));

    const counters = await processEntries(entries, opts.notify ?? true);

    const retried = await retryPendingAi(Math.max(0, pipelineConfig.maxAiPerRun - counters.aiProcessed));
    await expireBreaking();
    await computeTrending().catch((e) => console.error("[trending]", errMsg(e)));
    await cleanup();

    const perSource = sources.map((s, i) => ({ name: s.name, ok: !fetched[i].error, items: fetched[i].count, error: fetched[i].error }));
    return { ...empty, ...counters, aiProcessed: counters.aiProcessed + retried, sources: perSource, ok: true, durationMs: Date.now() - started };
  } catch (e) {
    console.error("[ingest] run failed:", errMsg(e));
    return { ...empty, ok: false, skipped: errMsg(e), durationMs: Date.now() - started };
  } finally {
    await releaseLock();
  }
}
