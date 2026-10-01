const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid|igshid|ref|ref_src|cmpid|ocid|taid|source|ico|ns_.+)$/i;

/** Canonical form of a URL: no fragment, no tracking params, sorted query, no trailing slash. */
export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  const kept = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

/** Strips a trailing " - Publisher" / " | Publisher" that aggregators (e.g. Google News) append. */
export function stripPublisherSuffix(title: string, publisher?: string): string {
  if (publisher) {
    const esc = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\s+[-–—|]\\s+${esc}\\s*$`, "i");
    if (re.test(title)) return title.replace(re, "").trim();
  }
  return title.trim();
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/, "") // trailing publisher
    .replace(/['’`]s\b/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the and or but of in on at to for from by with as is are was were be been being it its this that these those after before over under into about amid says say said new will has have had not no than then up down out off more most also how what why when who which their they he she his her we you our us".split(" "),
);

export function tokenize(text: string): string[] {
  return normalizeTitle(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Overlap coefficient: robust when one headline is much shorter than the other. */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}
