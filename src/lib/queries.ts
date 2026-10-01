import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { CATEGORIES, categoryName } from "@/config/categories";
import { db } from "./db";

export const PAGE_SIZE = 12;
export const NEWS_TAG = "news";
const REVALIDATE = 60;

/** Only primary reports of published stories are listed; other outlets' reports hang off the primary. */
const visible: Prisma.ArticleWhereInput = { status: "PUBLISHED", primaryId: null };

const cardSelect = {
  id: true, slug: true, title: true, summary: true, category: true, imageUrl: true, sourceName: true,
  publishedAt: true, isBreaking: true, isFeatured: true, sourceCount: true, readingTime: true, viewCount: true, aiProcessed: true,
} satisfies Prisma.ArticleSelect;

type CardRow = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

export interface ArticleDTO {
  id: string; slug: string; title: string; summary: string; category: string; categoryName: string;
  imageUrl: string | null; sourceName: string; publishedAt: string; isBreaking: boolean; isFeatured: boolean;
  sourceCount: number; readingTime: number; viewCount: number; aiProcessed: boolean;
}

export const toDTO = (a: CardRow): ArticleDTO => ({ ...a, categoryName: categoryName(a.category), publishedAt: a.publishedAt.toISOString() });

export interface Paged<T> { items: T[]; total: number; page: number; pages: number }

const cached = <T extends (...args: any[]) => Promise<any>>(fn: T, key: string, revalidate = REVALIDATE): T =>
  unstable_cache(fn, [key], { revalidate, tags: [NEWS_TAG] }) as unknown as T;

// ---------------------------------------------------------------- lists

async function listArticles(where: Prisma.ArticleWhereInput, page: number, pageSize = PAGE_SIZE, orderBy: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: "desc" }]): Promise<Paged<ArticleDTO>> {
  const p = Math.max(1, Math.floor(page) || 1);
  const [rows, total] = await Promise.all([
    db.article.findMany({ where: { ...visible, ...where }, select: cardSelect, orderBy, skip: (p - 1) * pageSize, take: pageSize }),
    db.article.count({ where: { ...visible, ...where } }),
  ]);
  return { items: rows.map(toDTO), total, page: p, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getLatest = cached(
  (page: number, category?: string) => listArticles(category ? { category } : {}, page),
  "latest",
);

export const getBreaking = cached(async (limit = 8): Promise<ArticleDTO[]> => {
  const since = new Date(Date.now() - 24 * 3600_000);
  const rows = await db.article.findMany({
    where: { ...visible, isBreaking: true, publishedAt: { gte: since } },
    select: cardSelect, orderBy: { publishedAt: "desc" }, take: limit,
  });
  return rows.map(toDTO);
}, "breaking", 30);

export const getBreakingArchive = cached((page: number) => listArticles({ isBreaking: true }, page), "breaking-archive");

export const getTrendingTopics = cached(async (limit = 8) => {
  const rows = await db.trendingTopic.findMany({ orderBy: { score: "desc" }, take: limit });
  return rows.map((t) => ({ topic: t.topic, slug: t.slug, articleCount: t.articleCount }));
}, "trending");

export type TrendingTopicDTO = Awaited<ReturnType<typeof getTrendingTopics>>[number];

export const getHome = cached(async () => {
  const [latest, featured, breaking, trending, ...perCat] = await Promise.all([
    db.article.findMany({ where: visible, select: cardSelect, orderBy: { publishedAt: "desc" }, take: 14 }),
    db.article.findMany({ where: { ...visible, isFeatured: true }, select: cardSelect, orderBy: { publishedAt: "desc" }, take: 1 }),
    getBreaking(6),
    getTrendingTopics(8),
    ...["ai", "technology", "india", "world", "business", "sports", "entertainment"].map((slug) =>
      db.article.findMany({ where: { ...visible, category: slug }, select: cardSelect, orderBy: { publishedAt: "desc" }, take: 4 }).then((r) => [slug, r.map(toDTO)] as const),
    ),
  ]);
  const withImage = latest.find((a) => a.imageUrl);
  const heroRow = featured[0] ?? withImage ?? latest[0] ?? null;
  const hero = heroRow ? toDTO(heroRow) : null;
  return {
    hero,
    breaking,
    trending,
    latest: latest.filter((a) => a.id !== hero?.id).slice(0, 10).map(toDTO),
    byCategory: Object.fromEntries(perCat) as Record<string, ArticleDTO[]>,
  };
}, "home");

/** Used by the live-update poller: stories newer than `since`. */
export async function getSince(since: Date, category?: string): Promise<ArticleDTO[]> {
  const rows = await db.article.findMany({
    where: { ...visible, publishedAt: { gt: since }, ...(category ? { category } : {}) },
    select: cardSelect, orderBy: { publishedAt: "desc" }, take: 20,
  });
  return rows.map(toDTO);
}

export const getCategoryPage = cached((slug: string, page: number) => listArticles({ category: slug }, page), "category");

// ---------------------------------------------------------------- article

export interface ArticleDetail extends ArticleDTO {
  originalTitle: string; keyPoints: string[]; contentExcerpt: string | null; sourceUrl: string; canonicalUrl: string;
  fetchedAt: string; updatedAt: string; author: string | null; language: string; tags: { name: string; slug: string }[];
  reports: { id: string; sourceName: string; sourceUrl: string; title: string; publishedAt: string }[];
  related: ArticleDTO[];
}

export const getArticleBySlug = cached(async (slug: string): Promise<ArticleDetail | null> => {
  const a = await db.article.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { tags: { include: { tag: true } }, primary: { select: { slug: true } } },
  });
  if (!a) return null;
  const groupId = a.primaryId ?? a.id;
  const [reports, related] = await Promise.all([
    db.article.findMany({
      where: { status: "PUBLISHED", OR: [{ id: groupId }, { primaryId: groupId }] },
      select: { id: true, sourceName: true, sourceUrl: true, originalTitle: true, publishedAt: true },
      orderBy: { publishedAt: "asc" },
    }),
    db.article.findMany({ where: { ...visible, category: a.category, id: { not: groupId } }, select: cardSelect, orderBy: { publishedAt: "desc" }, take: 4 }),
  ]);
  const seen = new Set<string>();
  const dedupedReports = reports.filter((r) => (seen.has(r.sourceName) ? false : (seen.add(r.sourceName), true)));
  return {
    ...toDTO(a),
    originalTitle: a.originalTitle, keyPoints: a.keyPoints, contentExcerpt: a.contentExcerpt, sourceUrl: a.sourceUrl,
    canonicalUrl: a.canonicalUrl, fetchedAt: a.fetchedAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
    author: a.author, language: a.language,
    tags: a.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug })),
    reports: dedupedReports.map((r) => ({ id: r.id, sourceName: r.sourceName, sourceUrl: r.sourceUrl, title: r.originalTitle, publishedAt: r.publishedAt.toISOString() })),
    related: related.map(toDTO),
  };
}, "article");

/** Slug of the primary story when a visitor opens a secondary report's slug. */
export async function getPrimarySlug(slug: string): Promise<string | null> {
  const a = await db.article.findUnique({ where: { slug }, select: { primary: { select: { slug: true, status: true } } } });
  return a?.primary && a.primary.status === "PUBLISHED" ? a.primary.slug : null;
}

// ---------------------------------------------------------------- search

export interface SearchParams { q?: string; category?: string; source?: string; range?: string; page?: number }

export const RANGES: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30 };

export async function searchArticles(p: SearchParams): Promise<Paged<ArticleDTO>> {
  const terms = (p.q ?? "").trim().split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
  const and: Prisma.ArticleWhereInput[] = terms.map((t) => {
    const catMatch = CATEGORIES.filter((c) => c.name.toLowerCase().includes(t.toLowerCase())).map((c) => c.slug);
    return {
      OR: [
        { title: { contains: t, mode: "insensitive" } },
        { originalTitle: { contains: t, mode: "insensitive" } },
        { summary: { contains: t, mode: "insensitive" } },
        { sourceName: { contains: t, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: t, mode: "insensitive" } } } } },
        ...(catMatch.length ? [{ category: { in: catMatch } }] : []),
        // Other outlets' reports of the same story also make the story findable.
        { reports: { some: { sourceName: { contains: t, mode: "insensitive" } } } },
      ],
    };
  });
  const where: Prisma.ArticleWhereInput = { AND: and };
  if (p.category) where.category = p.category;
  if (p.source) where.OR = [{ sourceName: p.source }, { reports: { some: { sourceName: p.source } } }];
  if (p.range && RANGES[p.range]) where.publishedAt = { gte: new Date(Date.now() - RANGES[p.range] * 86400_000) };
  return listArticles(where, p.page ?? 1);
}

export const getSourceNames = cached(async () => {
  const rows = await db.article.findMany({ where: visible, select: { sourceName: true }, distinct: ["sourceName"], orderBy: { sourceName: "asc" }, take: 200 });
  return rows.map((r) => r.sourceName);
}, "source-names", 300);

export async function recordSearch(q: string) {
  const query = q.trim().toLowerCase().slice(0, 80);
  if (query.length < 3) return;
  try { await db.searchLog.create({ data: { query } }); } catch { /* analytics only */ }
}

export const getPublicSources = cached(async () => {
  const rows = await db.source.findMany({ where: { enabled: true }, orderBy: { name: "asc" }, select: { name: true, website: true, category: true, language: true } });
  return rows;
}, "public-sources", 300);
