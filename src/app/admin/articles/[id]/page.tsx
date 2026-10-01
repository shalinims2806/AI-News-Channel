import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { reprocessArticleAction } from "../../actions";
import { ArticleEditForm } from "./ArticleEditForm";

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const a = await db.article.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, reports: { select: { id: true, sourceName: true, sourceUrl: true } }, aiLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!a) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link href="/admin/articles" className="text-sm text-muted hover:text-brand">← All articles</Link>
        <h1 className="section-title mt-1 text-2xl">Edit article</h1>
        <ArticleEditForm
          id={a.id}
          initial={{
            title: a.title, summary: a.summary, category: a.category, status: a.status,
            keyPoints: a.keyPoints.join("\n"), tags: a.tags.map((t) => t.tag.name).join(", "),
            isBreaking: a.isBreaking, isFeatured: a.isFeatured,
          }}
        />
      </div>
      <aside className="space-y-4 text-sm">
        <div className="card p-4">
          <h2 className="font-bold">Source</h2>
          <p className="mt-1">{a.sourceName}</p>
          <a className="break-all text-brand hover:underline" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">{a.sourceUrl}</a>
          <p className="mt-2 text-xs text-muted">Original headline: {a.originalTitle}</p>
          <p className="text-xs text-muted">Published {formatDateTime(a.publishedAt)} · fetched {formatDateTime(a.fetchedAt)}</p>
          <a className="mt-2 inline-block text-xs text-brand hover:underline" href={`/news/${a.slug}`} target="_blank">Public page ↗</a>
        </div>
        <div className="card p-4">
          <h2 className="font-bold">AI status</h2>
          <p className="mt-1">{a.aiProcessed ? "Summarized by LLM" : "Extractive summary (no LLM used)"} · provider: {a.aiProvider ?? "—"}</p>
          <form action={reprocessArticleAction.bind(null, a.id)} className="mt-2"><button className="btn-ghost !py-1 text-xs">Re-run AI processing</button></form>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {a.aiLogs.map((l) => <li key={l.id}>{l.ok ? "✓" : "✗"} {l.provider} {l.model ?? ""} {l.fallback ? "(fallback)" : ""} {l.error ?? ""}</li>)}
          </ul>
        </div>
        {a.reports.length > 0 && (
          <div className="card p-4">
            <h2 className="font-bold">Grouped reports ({a.reports.length})</h2>
            <ul className="mt-1 space-y-1">{a.reports.map((r) => <li key={r.id}><a className="text-brand hover:underline" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.sourceName} ↗</a></li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
