import { CATEGORIES } from "@/config/categories";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { ConfirmButton } from "../ConfirmButton";
import { deleteSourceAction, toggleSourceAction, updateSourceAction } from "../actions";
import { AddSourceForm } from "./AddSourceForm";
import { TestSourceButton } from "./TestSourceButton";

export default async function AdminSources() {
  await requireAdmin();
  const sources = await db.source.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }], include: { _count: { select: { articles: true } } } });
  return (
    <div className="space-y-8">
      <h1 className="section-title text-3xl">Sources</h1>
      <AddSourceForm />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr><th className="p-3">Source</th><th className="p-3">Category / reliability</th><th className="p-3">Status</th><th className="p-3">Articles</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sources.map((s) => (
              <tr key={s.id} className={s.enabled ? "" : "opacity-60"}>
                <td className="max-w-xs p-3">
                  <div className="font-semibold">{s.name} <span className="text-xs font-normal text-muted">({s.type})</span></div>
                  <div className="truncate text-xs text-muted" title={s.url}>{s.url}</div>
                </td>
                <td className="p-3">
                  <form action={updateSourceAction.bind(null, s.id)} className="flex gap-1">
                    <select name="category" defaultValue={s.category} className="field !w-auto !py-1 text-xs">{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
                    <select name="reliability" defaultValue={s.reliability} className="field !w-auto !py-1 text-xs"><option>unrated</option><option>reviewed</option><option>trusted</option></select>
                    <button className="btn-ghost !px-2 !py-1 text-xs">Save</button>
                  </form>
                </td>
                <td className="p-3 text-xs">
                  {!s.enabled ? "Disabled" : s.lastStatus === "error" ? <span className="text-alert">Error ({s.failureCount}×): {s.lastError}</span> : s.lastStatus === "ok" ? <span className="text-emerald-600">OK</span> : "Never fetched"}
                  {s.lastFetchedAt && <div className="text-muted">{timeAgo(s.lastFetchedAt)}</div>}
                </td>
                <td className="p-3">{s._count.articles}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <TestSourceButton url={s.url} type={s.type} />
                    <form action={toggleSourceAction.bind(null, s.id, !s.enabled)}><button className="btn-ghost !px-2 !py-1">{s.enabled ? "Disable" : "Enable"}</button></form>
                    <form action={deleteSourceAction.bind(null, s.id)}><ConfirmButton message={`Remove source "${s.name}"? Its articles stay published.`} className="btn-ghost !px-2 !py-1 text-alert">Remove</ConfirmButton></form>
                  </div>
                </td>
              </tr>
            ))}
            {!sources.length && <tr><td colSpan={5} className="p-6 text-center text-muted">No sources yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
