import { siteConfig } from "@/config/site";
import { getLatest } from "@/lib/queries";
import { absoluteUrl } from "@/lib/seo";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Our own RSS feed: headline + AI summary + link (summaries only, never publisher full text). */
export async function GET() {
  const { items } = await safe(() => getLatest(1), { items: [], total: 0, page: 1, pages: 1 });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${x(siteConfig.name)}</title><link>${siteConfig.url}</link><description>${x(siteConfig.tagline)}</description>
${items.map((a) => `<item><title>${x(a.title)}</title><link>${absoluteUrl(`/news/${a.slug}`)}</link><guid>${absoluteUrl(`/news/${a.slug}`)}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><category>${x(a.categoryName)}</category><description>${x(a.summary)}</description></item>`).join("\n")}
</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
