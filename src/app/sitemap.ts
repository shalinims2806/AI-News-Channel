import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/config/categories";
import { FOOTER_LINKS } from "@/config/site";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/latest"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/breaking"), changeFrequency: "hourly", priority: 0.7 },
    ...CATEGORIES.map((c) => ({ url: absoluteUrl(`/category/${c.slug}`), changeFrequency: "hourly" as const, priority: 0.8 })),
    ...FOOTER_LINKS.map((l) => ({ url: absoluteUrl(l.href), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
  try {
    const rows = await db.article.findMany({
      where: { status: "PUBLISHED", primaryId: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 5000, // sitemap protocol limit is 50k; Google News prefers recent items
    });
    return [...staticEntries, ...rows.map((r) => ({ url: absoluteUrl(`/news/${r.slug}`), lastModified: r.updatedAt, changeFrequency: "daily" as const, priority: 0.6 }))];
  } catch {
    return staticEntries;
  }
}
