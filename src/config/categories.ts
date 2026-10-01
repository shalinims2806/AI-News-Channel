export const CATEGORIES = [
  { slug: "ai", name: "AI", sortOrder: 1 },
  { slug: "technology", name: "Technology", sortOrder: 2 },
  { slug: "business", name: "Business", sortOrder: 3 },
  { slug: "india", name: "India", sortOrder: 4 },
  { slug: "tamil-nadu", name: "Tamil Nadu", sortOrder: 5 },
  { slug: "world", name: "World", sortOrder: 6 },
  { slug: "sports", name: "Sports", sortOrder: 7 },
  { slug: "entertainment", name: "Entertainment", sortOrder: 8 },
  { slug: "science", name: "Science", sortOrder: 9 },
  { slug: "other", name: "Other", sortOrder: 10 },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? "Other";
}

export function isCategorySlug(slug: string): slug is CategorySlug {
  return (CATEGORY_SLUGS as string[]).includes(slug);
}

/** Tailwind-free gradient pairs for category placeholders (used when no licensed image exists). */
export const CATEGORY_COLORS: Record<string, [string, string]> = {
  ai: ["#6d28d9", "#2563eb"],
  technology: ["#0369a1", "#0891b2"],
  business: ["#047857", "#65a30d"],
  india: ["#c2410c", "#15803d"],
  "tamil-nadu": ["#b91c1c", "#b45309"],
  world: ["#1d4ed8", "#0f766e"],
  sports: ["#be123c", "#ea580c"],
  entertainment: ["#a21caf", "#db2777"],
  science: ["#4338ca", "#0e7490"],
  other: ["#374151", "#6b7280"],
};
