"use client";
import { useState, useTransition } from "react";
import { runIngestionAction } from "./actions";

export function RunIngestionButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
      <button
        className="btn-brand disabled:opacity-60"
        disabled={pending}
        onClick={() => start(async () => { setMsg("Running…"); try { setMsg((await runIngestionAction()).text); } catch { setMsg("Run failed — see server logs."); } })}
      >
        {pending ? "Fetching…" : "Run ingestion now"}
      </button>
    </div>
  );
}
