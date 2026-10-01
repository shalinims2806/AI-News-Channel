import { LiveFeed } from "@/components/LiveFeed";
import { NewsCard } from "@/components/NewsCard";
import { Pagination } from "@/components/Pagination";
import { getLatest } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Latest News", description: "The newest stories from trusted publishers, summarized by AI.", path: "/latest" });

export default async function LatestPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const data = await safe(() => getLatest(Number(page) || 1), { items: [], total: 0, page: 1, pages: 1 });
  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="section-title text-3xl">Latest News</h1>
      <p className="mb-4 text-sm text-muted">{data.total} stories · AI-generated summaries with links to the original sources</p>
      {data.page === 1 ? (
        <LiveFeed initial={data.items} />
      ) : (
        data.items.map((a) => <NewsCard key={a.id} a={a} variant="row" />)
      )}
      <Pagination page={data.page} pages={data.pages} basePath="/latest" />
    </div>
  );
}
