"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArticleDTO } from "@/lib/queries";

/** Only renders when there is genuinely something flagged as breaking (multi-source or admin-marked). */
export function BreakingTicker({ initial }: { initial: ArticleDTO[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/news/breaking");
        if (res.ok) setItems((await res.json()).items);
      } catch { /* keep current */ }
    };
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!items.length) return null;
  const loop = [...items, ...items];
  return (
    <div className="border-b border-line bg-alert text-white" role="region" aria-label="Breaking news">
      <div className="container-page flex items-center gap-3 overflow-hidden py-1.5">
        <span className="z-10 flex shrink-0 items-center gap-1.5 rounded bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-alert">
          <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-alert" aria-hidden /> Breaking
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max animate-ticker gap-10 whitespace-nowrap text-sm font-medium hover:[animation-play-state:paused]">
            {loop.map((a, i) => (
              <Link key={`${a.id}-${i}`} href={`/news/${a.slug}`} className="hover:underline" aria-hidden={i >= items.length}>{a.title}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
