"use client";
import { useActionState } from "react";
import { CATEGORIES } from "@/config/categories";
import { updateArticleAction } from "../../actions";

interface Initial { title: string; summary: string; category: string; status: string; keyPoints: string; tags: string; isBreaking: boolean; isFeatured: boolean }

export function ArticleEditForm({ id, initial }: { id: string; initial: Initial }) {
  const [state, action, pending] = useActionState(updateArticleAction.bind(null, id), undefined);
  return (
    <form action={action} className="card mt-4 space-y-4 p-5">
      <label className="block text-sm font-medium">Headline
        <input name="title" defaultValue={initial.title} required className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">Summary
        <textarea name="summary" defaultValue={initial.summary} rows={5} required className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">Key points (one per line)
        <textarea name="keyPoints" defaultValue={initial.keyPoints} rows={4} className="field mt-1" />
      </label>
      <label className="block text-sm font-medium">Tags (comma separated)
        <input name="tags" defaultValue={initial.tags} className="field mt-1" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Category
          <select name="category" defaultValue={initial.category} className="field mt-1">{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Status
          <select name="status" defaultValue={initial.status} className="field mt-1"><option>PUBLISHED</option><option>HIDDEN</option><option>DRAFT</option></select>
        </label>
      </div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isBreaking" defaultChecked={initial.isBreaking} /> Breaking</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={initial.isFeatured} /> Featured</label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-alert">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-600">Saved.</p>}
      <button disabled={pending} className="btn-brand disabled:opacity-60">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
