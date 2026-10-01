"use client";
import { useActionState, useRef, useState } from "react";
import { CATEGORIES } from "@/config/categories";
import { addSourceAction, testSourceAction, type TestResult } from "../actions";

export function AddSourceForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (p: { error?: string; ok?: boolean } | undefined, fd: FormData) => {
    const r = await addSourceAction(p, fd);
    if (r.ok) ref.current?.reset();
    return r;
  }, undefined);
  const [test, setTest] = useState<TestResult | null>(null);

  return (
    <form ref={ref} action={action} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="font-bold sm:col-span-2 lg:col-span-4">Add source</h2>
      <input name="name" required placeholder="Source name" className="field" />
      <input name="url" type="url" required placeholder="RSS / API URL" className="field sm:col-span-2" />
      <input name="website" type="url" placeholder="Website (optional)" className="field" />
      <select name="type" className="field"><option value="rss">RSS / Atom</option><option value="newsapi">NewsAPI endpoint</option></select>
      <select name="category" defaultValue="other" className="field">{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
      <select name="reliability" className="field"><option value="unrated">Unrated</option><option value="reviewed">Reviewed</option><option value="trusted">Trusted</option></select>
      <input name="language" defaultValue="en" className="field" aria-label="Language code" />
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button disabled={pending} className="btn-brand disabled:opacity-60">{pending ? "Adding…" : "Add source"}</button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            const fd = new FormData(ref.current!);
            setTest(await testSourceAction({ url: String(fd.get("url") ?? ""), type: String(fd.get("type") ?? "rss") }));
          }}
        >
          Test before adding
        </button>
        {state?.error && <span role="alert" className="text-sm text-alert">{state.error}</span>}
        {state?.ok && <span role="status" className="text-sm text-emerald-600">Added.</span>}
        {test && <span className={`text-sm ${test.ok ? "text-emerald-600" : "text-alert"}`}>{test.ok ? `✓ ${test.count} items (${test.sample?.[0] ?? ""})` : `✗ ${test.error}`}</span>}
      </div>
    </form>
  );
}
