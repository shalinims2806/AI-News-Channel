"use client";
import { useState, useTransition } from "react";
import { testSourceAction, type TestResult } from "../actions";

export function TestSourceButton({ url, type }: { url: string; type: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<TestResult | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} className="btn-ghost !px-2 !py-1 disabled:opacity-60" onClick={() => start(async () => setRes(await testSourceAction({ url, type })))}>
        {pending ? "Testing…" : "Test"}
      </button>
      {res && (
        <div role="status" className={`mt-1 max-w-xs text-xs ${res.ok ? "text-emerald-600" : "text-alert"}`}>
          {res.ok ? `✓ ${res.count} items in ${res.ms}ms` : `✗ ${res.error}`}
          {res.sample?.map((t, i) => <div key={i} className="truncate text-muted">• {t}</div>)}
        </div>
      )}
    </div>
  );
}
