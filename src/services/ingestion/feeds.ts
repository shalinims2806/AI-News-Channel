import Parser from "rss-parser";
import { stripHtml } from "@/lib/server-utils";
import { errMsg, safeHttpUrl, sleep, truncate } from "@/lib/utils";

export interface RawItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  excerpt: string;
  imageUrl: string | null;
  author: string | null;
  /** Set when the feed itself names the real publisher (Google News, NewsAPI). */
  publisher: string | null;
}

export interface FetchedFeed {
  items: RawItem[];
  feedTitle?: string;
}

export interface SourceLike {
  type: string;
  url: string;
  name: string;
}

const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_ITEMS_PER_FEED = 50;
const EXCERPT_MAX = 500; // we only keep a short excerpt (copyright-conscious)

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["source", "sourceEl"],
      ["dc:creator", "creator"],
    ],
  },
});

/** Reject obviously internal targets (SSRF hardening for admin-supplied URLs). */
export function assertPublicUrl(raw: string): URL {
  const safe = safeHttpUrl(raw);
  if (!safe) throw new Error("Only http(s) URLs are allowed");
  const u = new URL(safe);
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "::1" || h.startsWith("[")
  ) {
    throw new Error("Private/internal hosts are not allowed");
  }
  return u;
}

async function fetchText(url: string, headers: Record<string, string> = {}, retries = 2): Promise<string> {
  assertPublicUrl(url);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "AINewsChannelBot/1.0 (+news aggregator)", accept: "application/rss+xml, application/atom+xml, application/xml, application/json;q=0.9, */*;q=0.5", ...headers },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        lastErr = new Error(`HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
        if (attempt < retries) await sleep(Math.min(Math.max(retryAfter * 1000, 1000 * 2 ** attempt), 10000));
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      const text = await res.text();
      if (text.length > MAX_BYTES) throw Object.assign(new Error("Feed too large"), { fatal: true });
      return text;
    } catch (e: any) {
      lastErr = e;
      if (e?.fatal) throw e;
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(errMsg(lastErr) || "Request failed");
}

function firstImgSrc(html: string | undefined): string | null {
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? safeHttpUrl(m[1]) : null;
}

function pickImage(item: any): string | null {
  const enc = item.enclosure;
  if (enc?.url && (!enc.type || String(enc.type).startsWith("image"))) {
    const u = safeHttpUrl(enc.url);
    if (u) return u;
  }
  const media: any[] = Array.isArray(item.mediaContent) ? item.mediaContent : [];
  for (const m of media) {
    const url = m?.$?.url;
    const medium = m?.$?.medium ?? m?.$?.type ?? "image";
    if (url && String(medium).includes("image")) {
      const u = safeHttpUrl(url);
      if (u) return u;
    }
  }
  const thumb = item.mediaThumbnail?.$?.url ?? item.mediaThumbnail?.url;
  if (thumb && safeHttpUrl(thumb)) return safeHttpUrl(thumb);
  return firstImgSrc(item["content:encoded"]) ?? firstImgSrc(item.content) ?? null;
}

async function fetchRss(source: SourceLike): Promise<FetchedFeed> {
  const xml = await fetchText(source.url);
  let feed: Awaited<ReturnType<typeof parser.parseString>>;
  try {
    feed = await parser.parseString(xml);
  } catch (e) {
    throw new Error(`Invalid RSS/Atom feed: ${errMsg(e).slice(0, 120)}`);
  }
  const isGoogleNews = new URL(source.url).hostname === "news.google.com";
  const items: RawItem[] = [];
  for (const it of (feed.items ?? []).slice(0, MAX_ITEMS_PER_FEED) as any[]) {
    const link = safeHttpUrl(it.link ?? (typeof it.guid === "string" && it.guid.startsWith("http") ? it.guid : undefined));
    if (!link || !it.title) continue;
    const pub = it.sourceEl ? stripHtml(typeof it.sourceEl === "string" ? it.sourceEl : it.sourceEl._ ?? "") : "";
    const published = it.isoDate ?? it.pubDate;
    const d = published ? new Date(published) : null;
    items.push({
      title: stripHtml(it.title),
      link,
      publishedAt: d && !isNaN(d.getTime()) ? d : null,
      // Google News descriptions are lists of related links, not an excerpt.
      excerpt: isGoogleNews ? "" : truncate(stripHtml(it.contentSnippet ?? it.summary ?? it.content ?? ""), EXCERPT_MAX),
      imageUrl: pickImage(it),
      author: it.creator ?? it.author ?? null,
      publisher: pub || null,
    });
  }
  if (!feed.items?.length) throw new Error("Feed parsed but contains no items");
  return { items, feedTitle: feed.title };
}

async function fetchNewsApi(source: SourceLike): Promise<FetchedFeed> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NEWS_API_KEY is not configured");
  const text = await fetchText(source.url, { "x-api-key": key });
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error("NewsAPI returned invalid JSON"); }
  if (json.status && json.status !== "ok") throw new Error(`NewsAPI: ${json.message ?? json.code ?? "error"}`);
  const items: RawItem[] = [];
  for (const a of (json.articles ?? []).slice(0, MAX_ITEMS_PER_FEED)) {
    const link = safeHttpUrl(a.url);
    if (!link || !a.title || a.title === "[Removed]") continue;
    const d = a.publishedAt ? new Date(a.publishedAt) : null;
    items.push({
      title: stripHtml(a.title),
      link,
      publishedAt: d && !isNaN(d.getTime()) ? d : null,
      excerpt: truncate(stripHtml(a.description ?? ""), EXCERPT_MAX),
      imageUrl: safeHttpUrl(a.urlToImage),
      author: a.author ?? null,
      publisher: a.source?.name ?? null,
    });
  }
  return { items };
}

/** Adapter registry: add new API types (GNews, Bing, ...) here without touching the pipeline. */
export async function fetchSource(source: SourceLike): Promise<FetchedFeed> {
  switch (source.type) {
    case "newsapi": return fetchNewsApi(source);
    case "rss":
    default: return fetchRss(source);
  }
}
