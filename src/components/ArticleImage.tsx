"use client";
import Image from "next/image";
import { useState } from "react";
import { CATEGORY_COLORS, categoryName } from "@/config/categories";

/** Clean category-based placeholder used when no licensed/feed-provided image exists. */
export function CategoryPlaceholder({ category }: { category: string }) {
  const [a, b] = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  return (
    <div
      className="flex h-full w-full items-end p-3 text-xs font-bold uppercase tracking-widest text-white/80"
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      role="img"
      aria-label={`${categoryName(category)} news`}
    >
      {categoryName(category)}
    </div>
  );
}

export function ArticleImage({ src, alt, category, priority = false, sizes = "(min-width:1024px) 33vw, 100vw" }: { src: string | null; alt: string; category: string; priority?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden bg-line">
      {src && !failed ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} loading={priority ? undefined : "lazy"} onError={() => setFailed(true)} className="object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <CategoryPlaceholder category={category} />
      )}
    </div>
  );
}
