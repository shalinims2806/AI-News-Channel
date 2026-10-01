import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Pagination } from "@/components/Pagination";
import { CATEGORIES, categoryName } from "@/config/categories";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { ConfirmButton } from "../ConfirmButton";
import { deleteArticleAction, setBreakingAction, setFeaturedAction, toggleHiddenAction } from "../actions";

const PER = 25;

export default async function AdminArticles({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ArticleWhereInput = { primaryId: null };
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { sourceName: { contains: sp.q, mode: "insensitive" } }];
  if (sp.status && ["PUBLISHED", "HIDDEN", "DRAFT"].includes(sp.status)) where.status = sp.status as "PUBLISHED";
  if (sp.category) where.category = sp.category;

  const [rows, total] = await Promise.all([
    db.article.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * PER, take: PER }),
    db.article.count({ where }),
  ]);

  return (
    <div>
      <h1 className="section-title text-3xl">Articles</h1>
      <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Search title / source" className="field sm:col-span-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="field"><option value="">Any status</option><option>PUBLISHED</option><option>HIDDEN</option><option>DRAFT</option></select>
        <select name="category" defaultValue={sp.category ?? ""} className="field"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <button className="btn-ghost sm:col-span-4 sm:w-max">Filter</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr><th className="p-3">Story</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Views</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => (
              <tr key={a.id} className={a.status !== "PUBLISHED" ? "opacity-60" : ""}>
                <td className="max-w-md p-3">
                  <Link href={`/admin/articles/${a.id}`} className="font-semibold hover:text-brand">{a.title}</Link>
                  <div className="text-xs text-muted">{a.sourceName} · {timeAgo(a.publishedAt)} · {a.sourceCount} source(s) · {a.aiProcessed ? "AI" : "extractive"}
                    {a.isBreaking && <span className="ml-1 font-bold text-alert">BREAKING</span>}{a.isFeatured && <span className="ml-1 font-bold text-brand">FEATURED</span>}</div>
                </td>
                <td className="p-3">{categoryName(a.category)}</td>
                <td className="p-3">{a.status}</td>
                <td className="p-3">{a.viewCount}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Link className="btn-ghost !px-2 !py-1" href={`/admin/articles/${a.id}`}>Edit</Link>
                    <a className="btn-ghost !px-2 !py-1" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>
                    <form action={toggleHiddenAction.bind(null, a.id, a.status === "PUBLISHED")}><button className="btn-ghost !px-2 !py-1">{a.status === "PUBLISHED" ? "Hide" : "Publish"}</button></form>
                    <form action={setBreakingAction.bind(null, a.id, !a.isBreaking)}><button className="btn-ghost !px-2 !py-1">{a.isBreaking ? "Unmark breaking" : "Mark breaking"}</button></form>
                    <form action={setFeaturedAction.bind(null, a.id, !a.isFeatured)}><button className="btn-ghost !px-2 !py-1">{a.isFeatured ? "Unfeature" : "Feature"}</button></form>
                    <form action={deleteArticleAction.bind(null, a.id)}><ConfirmButton message="Delete this article permanently?" className="btn-ghost !px-2 !py-1 text-alert">Delete</ConfirmButton></form>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted">No articles.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} basePath="/admin/articles" params={{ q: sp.q, status: sp.status, category: sp.category }} />
    </div>
  );
}
