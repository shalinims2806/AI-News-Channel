import Link from "next/link";

export function Pagination({ page, pages, basePath, params = {} }: { page: number; pages: number; basePath: string; params?: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
      {page > 1 ? <Link className="btn-ghost" href={href(page - 1)} rel="prev">← Newer</Link> : <span />}
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      {page < pages ? <Link className="btn-ghost" href={href(page + 1)} rel="next">Older →</Link> : <span />}
    </nav>
  );
}
