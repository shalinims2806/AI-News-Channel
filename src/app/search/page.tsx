import { NewsCard } from "@/components/NewsCard";
import { Pagination } from "@/components/Pagination";
import { CATEGORIES } from "@/config/categories";
import { getSourceNames, RANGES, recordSearch, searchArticles } from "@/lib/queries";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search", robots: { index: false, follow: true } };

type SP = { q?: string; category?: string; source?: string; range?: string; page?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Number(sp.page) || 1;
  const hasQuery = q.trim().length >= 2;
  const [sources, result] = await Promise.all([
    safe(getSourceNames, []),
    hasQuery || sp.category || sp.source || sp.range
      ? safe(() => searchArticles({ q, category: sp.category, source: sp.source, range: sp.range, page }), { items: [], total: 0, page: 1, pages: 1 })
      : Promise.resolve(null),
  ]);
  if (hasQuery && page === 1) void recordSearch(q);

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="section-title text-3xl">Search</h1>
      <form action="/search" method="get" role="search" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Headlines, topics, keywords, sources…" aria-label="Search query" className="field sm:col-span-2 lg:col-span-4" />
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className="field">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} aria-label="Source" className="field">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="range" defaultValue={sp.range ?? ""} aria-label="Date" className="field">
          <option value="">Any time</option>
          {Object.keys(RANGES).map((r) => <option key={r} value={r}>{r === "24h" ? "Past 24 hours" : r === "7d" ? "Past 7 days" : "Past 30 days"}</option>)}
        </select>
        <button className="btn-brand">Search</button>
      </form>

      <div className="mt-6">
        {!result ? (
          <p className="text-muted">Enter at least two characters to search.</p>
        ) : result.items.length === 0 ? (
          <p className="py-10 text-center text-muted">No stories matched your search.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">{result.total} result{result.total === 1 ? "" : "s"}</p>
            {result.items.map((a) => <NewsCard key={a.id} a={a} variant="row" />)}
            <Pagination page={result.page} pages={result.pages} basePath="/search" params={{ q, category: sp.category, source: sp.source, range: sp.range }} />
          </>
        )}
      </div>
    </div>
  );
}
