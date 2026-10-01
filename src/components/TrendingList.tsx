import Link from "next/link";
import type { TrendingTopicDTO } from "@/lib/queries";

export function TrendingList({ topics }: { topics: TrendingTopicDTO[] }) {
  return (
    <aside className="card p-5" aria-labelledby="trending-h">
      <h2 id="trending-h" className="section-title text-xl">Trending Now</h2>
      <p className="text-xs text-muted">Trending on this platform — based on recent coverage, reads and searches here. Not a measure of importance.</p>
      {topics.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Trending topics appear after the first update cycle.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {topics.slice(0, 8).map((t, i) => (
            <li key={t.slug} className="flex items-baseline gap-3">
              <span className="w-6 font-serif text-2xl font-extrabold text-brand/70">{i + 1}</span>
              <Link href={`/search?q=${encodeURIComponent(t.topic)}`} className="font-semibold hover:text-brand">
                {t.topic}
                <span className="ml-2 text-xs font-normal text-muted">{t.articleCount} {t.articleCount === 1 ? "story" : "stories"}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
