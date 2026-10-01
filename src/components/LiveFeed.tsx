"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleDTO } from "@/lib/queries";
import { NewsCard } from "./NewsCard";

const POLL_MS = 60_000;

/**
 * Renders the newest stories and quietly polls /api/news/latest. New items are offered via a
 * "N new stories" button (no layout jumps, no full page reload).
 */
export function LiveFeed({ initial, category, variant = "row" }: { initial: ArticleDTO[]; category?: string; variant?: "row" | "default" }) {
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<ArticleDTO[]>([]);
  const newest = useRef(initial[0]?.publishedAt ?? new Date(Date.now() - 3600_000).toISOString());

  const poll = useCallback(async () => {
    if (document.hidden) return;
    try {
      const qs = new URLSearchParams({ since: newest.current });
      if (category) qs.set("category", category);
      const res = await fetch(`/api/news/latest?${qs}`);
      if (!res.ok) return;
      const { items: fresh } = (await res.json()) as { items: ArticleDTO[] };
      if (fresh.length) {
        setPending((prev) => {
          const known = new Set([...prev, ...items].map((x) => x.id));
          return [...fresh.filter((f) => !known.has(f.id)), ...prev];
        });
      }
    } catch { /* offline / transient: try again next tick */ }
  }, [category, items]);

  useEffect(() => {
    const t = setInterval(poll, POLL_MS);
    const onVis = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [poll]);

  const showNew = () => {
    setItems((cur) => [...pending, ...cur]);
    if (pending[0]) newest.current = pending[0].publishedAt;
    setPending([]);
  };

  return (
    <div>
      {pending.length > 0 && (
        <button onClick={showNew} className="btn-brand sticky top-20 z-10 mx-auto mb-3 flex shadow-lg" aria-live="polite">
          ↑ {pending.length} new {pending.length === 1 ? "story" : "stories"}
        </button>
      )}
      <div className={variant === "default" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : ""}>
        {items.map((a) => <NewsCard key={a.id} a={a} variant={variant} />)}
      </div>
      {items.length === 0 && <p className="py-10 text-center text-muted">No stories yet. The next automatic update will populate this page.</p>}
    </div>
  );
}
