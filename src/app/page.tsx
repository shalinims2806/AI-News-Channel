import Link from "next/link";
import { BreakingSection } from "@/components/BreakingSection";
import { LiveFeed } from "@/components/LiveFeed";
import { BreakingTag, CategoryBadge, Meta, NewsCard } from "@/components/NewsCard";
import { ArticleImage } from "@/components/ArticleImage";
import { SocialLinks } from "@/components/SocialLinks";
import { TelegramCta } from "@/components/TelegramCta";
import { TrendingList } from "@/components/TrendingList";
import { categoryName } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getHome, type ArticleDTO } from "@/lib/queries";
import { safe } from "@/lib/utils";

export const dynamic = "force-dynamic"; // data is cached in queries.ts (60s + on-ingest revalidation)

const SECTIONS: { slug: string; title: string }[] = [
  { slug: "ai", title: "AI News" },
  { slug: "technology", title: "Technology News" },
  { slug: "india", title: "India News" },
  { slug: "world", title: "World News" },
  { slug: "business", title: "Business News" },
  { slug: "sports", title: "Sports News" },
  { slug: "entertainment", title: "Entertainment" },
];

function Hero({ a }: { a: ArticleDTO }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-surface animate-fadeUp">
      <Link href={`/news/${a.slug}`} className="relative block aspect-[16/9] sm:aspect-[2/1]" aria-hidden tabIndex={-1}>
        <ArticleImage src={a.imageUrl} alt="" category={a.category} priority sizes="(min-width:1024px) 66vw, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </Link>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">{categoryName(a.category)}</span>
          {a.isBreaking && <BreakingTag />}
        </div>
        <h2 className="font-serif text-2xl font-extrabold leading-tight sm:text-4xl"><Link href={`/news/${a.slug}`} className="hover:underline">{a.title}</Link></h2>
        <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-white/85 sm:text-base">{a.summary}</p>
      </div>
    </article>
  );
}

export default async function HomePage() {
  const data = await safe(getHome, null);

  if (!data) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="section-title">News is temporarily unavailable</h1>
        <p className="mt-2 text-muted">We couldn&apos;t reach the news database. Please try again in a moment.</p>
      </div>
    );
  }

  return (
    <div className="container-page space-y-12 py-6 sm:py-8">
      <BreakingSection items={data.breaking} />

      {data.hero ? (
        <section aria-label="Top story"><Hero a={data.hero} /></section>
      ) : (
        <section className="card p-10 text-center">
          <h1 className="section-title">Welcome to {siteConfig.name}</h1>
          <p className="mt-2 text-muted">No stories yet. Run <code>npm run db:seed</code> for sample data or wait for the first automatic update.</p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="latest-h">
          <div className="mb-2 flex items-end justify-between">
            <h2 id="latest-h" className="section-title">Latest News</h2>
            <Link href="/latest" className="text-sm font-semibold text-brand hover:underline">View all →</Link>
          </div>
          <LiveFeed initial={data.latest} />
        </section>
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <TrendingList topics={data.trending} />
          <TelegramCta url={siteConfig.social.telegram} />
        </div>
      </div>

      {SECTIONS.map(({ slug, title }) => {
        const items = data.byCategory[slug] ?? [];
        if (!items.length) return null;
        return (
          <section key={slug} aria-labelledby={`${slug}-h`}>
            <div className="mb-4 flex items-end justify-between border-b-2 border-brand pb-2">
              <h2 id={`${slug}-h`} className="section-title">{title}</h2>
              <Link href={`/category/${slug}`} className="text-sm font-semibold text-brand hover:underline">More →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((a) => <NewsCard key={a.id} a={a} />)}
            </div>
          </section>
        );
      })}

      <section className="card flex flex-col items-center gap-3 p-8 text-center" aria-labelledby="follow-h">
        <h2 id="follow-h" className="section-title">Follow {siteConfig.name}</h2>
        <p className="max-w-md text-sm text-muted">Stay updated on Instagram, Facebook and Telegram.</p>
        <SocialLinks links={siteConfig.social} size="h-6 w-6" />
      </section>
    </div>
  );
}
