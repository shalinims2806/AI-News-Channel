import { CATEGORIES } from "@/config/categories";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

const HALF_LIFE_HOURS = 12;
const WINDOW_HOURS = 48;
const GENERIC = new Set(CATEGORIES.map((c) => c.name.toLowerCase()).concat(["news", "breaking", "latest", "update", "updates", "report", "video"]));

const decay = (ageHours: number) => Math.pow(0.5, ageHours / HALF_LIFE_HOURS);

/**
 * Trending score per topic (tag), computed from data on THIS platform only:
 *   recency-weighted article count  (+ extra weight for multi-outlet stories)
 *   + on-site views in the last 24h
 *   + on-site searches for the topic in the last 24h
 * Social engagement can be added as one more term if a data source is available.
 * Shown to users as "Trending on this platform" — it is not a measure of importance.
 */
export async function computeTrending(limit = 20): Promise<number> {
  const now = Date.now();
  const since = new Date(now - WINDOW_HOURS * 3600_000);
  const day = new Date(now - 24 * 3600_000);

  const rows = await db.articleTag.findMany({
    where: { article: { status: "PUBLISHED", primaryId: null, publishedAt: { gte: since } } },
    select: { tag: { select: { name: true } }, article: { select: { id: true, publishedAt: true, sourceCount: true } } },
    take: 5000,
  });
  if (!rows.length) return 0;

  const views = await db.articleView.groupBy({ by: ["articleId"], where: { createdAt: { gte: day } }, _count: { _all: true } });
  const viewMap = new Map(views.map((v) => [v.articleId, v._count._all]));
  const searches = await db.searchLog.groupBy({ by: ["query"], where: { createdAt: { gte: day } }, _count: { _all: true } });
  const searchMap = new Map(searches.map((s) => [s.query.toLowerCase(), s._count._all]));

  const topics = new Map<string, { name: string; score: number; count: number }>();
  for (const r of rows) {
    const name = r.tag.name;
    if (GENERIC.has(name.toLowerCase()) || name.length < 3) continue;
    const ageH = (now - r.article.publishedAt.getTime()) / 3600_000;
    const s = decay(ageH) * (1 + 0.5 * (r.article.sourceCount - 1)) + 0.15 * (viewMap.get(r.article.id) ?? 0);
    const t = topics.get(name.toLowerCase()) ?? { name, score: 0, count: 0 };
    t.score += s;
    t.count += 1;
    topics.set(name.toLowerCase(), t);
  }
  for (const [key, t] of topics) t.score += 0.5 * (searchMap.get(key) ?? 0);

  const top = [...topics.values()].filter((t) => t.count >= 1).sort((a, b) => b.score - a.score).slice(0, limit);

  await db.$transaction([
    db.trendingTopic.deleteMany({}),
    db.trendingTopic.createMany({
      data: top.map((t) => ({ topic: t.name, slug: slugify(t.name), score: Math.round(t.score * 100) / 100, articleCount: t.count })),
      skipDuplicates: true,
    }),
  ]);
  return top.length;
}
