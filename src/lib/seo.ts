import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import type { ArticleDetail } from "./queries";

export function absoluteUrl(path: string) {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata(o: { title: string; description: string; path: string; image?: string | null; type?: "website" | "article" }): Metadata {
  const url = absoluteUrl(o.path);
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: url },
    openGraph: { title: o.title, description: o.description, url, siteName: siteConfig.name, type: o.type ?? "website", images: o.image ? [{ url: o.image }] : undefined },
    twitter: { card: o.image ? "summary_large_image" : "summary", title: o.title, description: o.description, images: o.image ? [o.image] : undefined },
  };
}

/** schema.org NewsArticle. We describe our summary page and point to the original via isBasedOn. */
export function newsArticleJsonLd(a: ArticleDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title.slice(0, 110),
    description: a.summary,
    mainEntityOfPage: absoluteUrl(`/news/${a.slug}`),
    image: a.imageUrl ? [a.imageUrl] : undefined,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    articleSection: a.categoryName,
    keywords: a.tags.map((t) => t.name).join(", ") || undefined,
    inLanguage: a.language,
    isBasedOn: a.canonicalUrl,
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    sourceOrganization: { "@type": "Organization", name: a.sourceName },
  };
}

/** Safe to inline in <script>: escapes "<" so titles can't break out of the tag. */
export const jsonLdString = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
