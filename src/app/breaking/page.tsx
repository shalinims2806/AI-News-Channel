import { NewsCard } from "@/components/NewsCard";
import { Pagination } from "@/components/Pagination";
import { getBreakingArchive } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({ title: "Breaking News", description: "Stories reported by multiple independent outlets or flagged by our editors.", path: "/breaking" });

export default async function BreakingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const data = await safe(() => getBreakingArchive(Number(page) || 1), { items: [], total: 0, page: 1, pages: 1 });
  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="section-title text-3xl">Breaking News</h1>
      <p className="mb-4 text-sm text-muted">
        A story appears here only when several independent outlets carry it in a short time window, or an editor flags it. Ordinary articles are never labelled breaking.
      </p>
      {data.items.length === 0 ? <p className="py-10 text-center text-muted">No breaking stories right now.</p> : data.items.map((a) => <NewsCard key={a.id} a={a} variant="row" />)}
      <Pagination page={data.page} pages={data.pages} basePath="/breaking" />
    </div>
  );
}
