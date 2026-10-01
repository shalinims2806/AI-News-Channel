import { notFound } from "next/navigation";
import { LiveFeed } from "@/components/LiveFeed";
import { NewsCard } from "@/components/NewsCard";
import { Pagination } from "@/components/Pagination";
import { categoryName, isCategorySlug } from "@/config/categories";
import { getCategoryPage } from "@/lib/queries";
import { pageMetadata } from "@/lib/seo";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCategorySlug(slug)) return {};
  const name = categoryName(slug);
  return pageMetadata({ title: `${name} News`, description: `Latest ${name} news with AI-generated summaries and original source links.`, path: `/category/${slug}` });
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  if (!isCategorySlug(slug)) notFound();
  const { page } = await searchParams;
  const data = await safe(() => getCategoryPage(slug, Number(page) || 1), { items: [], total: 0, page: 1, pages: 1 });
  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="section-title text-3xl">{categoryName(slug)}</h1>
      <p className="mb-4 text-sm text-muted">{data.total} stories</p>
      {data.page === 1 ? <LiveFeed initial={data.items} category={slug} /> : data.items.map((a) => <NewsCard key={a.id} a={a} variant="row" />)}
      <Pagination page={data.page} pages={data.pages} basePath={`/category/${slug}`} />
    </div>
  );
}
