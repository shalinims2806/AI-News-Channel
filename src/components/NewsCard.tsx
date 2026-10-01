import Link from "next/link";
import type { ArticleDTO } from "@/lib/queries";
import { storyLabel } from "@/lib/labels";
import { timeAgo } from "@/lib/utils";
import { ArticleImage } from "./ArticleImage";

export function CategoryBadge({ slug, name }: { slug: string; name: string }) {
  return (
    <Link href={`/category/${slug}`} className="inline-block rounded bg-brand/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand hover:bg-brand/20">
      {name}
    </Link>
  );
}

export function Meta({ a }: { a: ArticleDTO }) {
  return (
    <p className="text-xs text-muted">
      <time dateTime={a.publishedAt} suppressHydrationWarning>{timeAgo(a.publishedAt)}</time>
      <span aria-hidden> · </span>
      <span>{a.sourceName}</span>
      {a.sourceCount > 1 && <span className="ml-1 font-medium text-ink/70">· {storyLabel(a.sourceCount).text}</span>}
    </p>
  );
}

export function NewsCard({ a, variant = "default", priority = false }: { a: ArticleDTO; variant?: "default" | "compact" | "row"; priority?: boolean }) {
  const href = `/news/${a.slug}`;

  if (variant === "compact") {
    return (
      <article className="group border-b border-line py-3 last:border-0">
        <CategoryBadge slug={a.category} name={a.categoryName} />
        <h3 className="mt-1.5 font-serif text-base font-bold leading-snug"><Link href={href} className="hover:text-brand">{a.title}</Link></h3>
        <div className="mt-1"><Meta a={a} /></div>
      </article>
    );
  }

  if (variant === "row") {
    return (
      <article className="group flex gap-4 border-b border-line py-4 last:border-0 animate-fadeUp">
        <Link href={href} className="relative block h-24 w-32 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-44" aria-hidden tabIndex={-1}>
          <ArticleImage src={a.imageUrl} alt="" category={a.category} sizes="176px" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><CategoryBadge slug={a.category} name={a.categoryName} />{a.isBreaking && <BreakingTag />}</div>
          <h3 className="mt-1.5 font-serif text-lg font-bold leading-snug sm:text-xl"><Link href={href} className="hover:text-brand">{a.title}</Link></h3>
          <p className="mt-1 line-clamp-2 hidden text-sm text-muted sm:block">{a.summary}</p>
          <div className="mt-1.5"><Meta a={a} /></div>
        </div>
      </article>
    );
  }

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg animate-fadeUp">
      <Link href={href} className="relative block aspect-[16/9]" aria-hidden tabIndex={-1}>
        <ArticleImage src={a.imageUrl} alt="" category={a.category} priority={priority} />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2"><CategoryBadge slug={a.category} name={a.categoryName} />{a.isBreaking && <BreakingTag />}</div>
        <h3 className="mt-2 font-serif text-lg font-bold leading-snug"><Link href={href} className="hover:text-brand">{a.title}</Link></h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted">{a.summary}</p>
        <div className="mt-auto pt-3">
          <Meta a={a} />
          <Link href={href} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Read More →</Link>
        </div>
      </div>
    </article>
  );
}

export function BreakingTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-alert px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-white" aria-hidden /> Breaking
    </span>
  );
}
