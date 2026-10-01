import Link from "next/link";
import type { ArticleDTO } from "@/lib/queries";
import { storyLabel } from "@/lib/labels";
import { timeAgo, truncate } from "@/lib/utils";
import { BreakingTag } from "./NewsCard";

/** Shown only when stories are actually flagged breaking; never falls back to ordinary articles. */
export function BreakingSection({ items }: { items: ArticleDTO[] }) {
  if (!items.length) return null;
  const [lead, ...rest] = items;
  return (
    <section aria-labelledby="breaking-h" className="rounded-2xl border-2 border-alert/40 bg-alert/5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 id="breaking-h" className="flex items-center gap-2 font-serif text-2xl font-extrabold"><BreakingTag /> Breaking News</h2>
        <Link href="/breaking" className="text-sm font-semibold text-brand hover:underline">All breaking →</Link>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="font-serif text-2xl font-bold leading-tight sm:text-3xl"><Link href={`/news/${lead.slug}`} className="hover:text-brand">{lead.title}</Link></h3>
          <p className="mt-2 text-muted">{truncate(lead.summary, 300)} <span className="text-xs">(AI summary)</span></p>
          <p className="mt-2 text-xs text-muted">
            <time dateTime={lead.publishedAt} suppressHydrationWarning>{timeAgo(lead.publishedAt)}</time> · {lead.sourceName} · {storyLabel(lead.sourceCount).text}
          </p>
          <Link href={`/news/${lead.slug}`} className="btn-brand mt-4">Read Full Story</Link>
        </div>
        {rest.length > 0 && (
          <ul className="space-y-3 border-t border-alert/20 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {rest.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.slug}`} className="font-serif font-bold leading-snug hover:text-brand">{a.title}</Link>
                <p className="text-xs text-muted"><time dateTime={a.publishedAt} suppressHydrationWarning>{timeAgo(a.publishedAt)}</time> · {a.sourceName}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
