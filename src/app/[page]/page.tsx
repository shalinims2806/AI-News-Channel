import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { getPublicSources } from "@/lib/queries";
import { categoryName } from "@/config/categories";
import { connection } from "next/server";
import { safe } from "@/lib/utils";

const name = siteConfig.name;

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  about: {
    title: "About Us",
    body: (
      <>
        <p>{name} is an automated news platform. It collects headlines and short excerpts from publishers&apos; official RSS feeds and news APIs, then uses AI to classify each story and write a short, factual summary that always links back to the original report.</p>
        <p>We do not republish full articles. Every story page names the original publisher and sends readers to their site.</p>
      </>
    ),
  },
  contact: {
    title: "Contact",
    body: (
      <p>Corrections, takedown requests and partnership enquiries: <a className="text-brand underline" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.</p>
    ),
  },
  "privacy-policy": {
    title: "Privacy Policy",
    body: (
      <>
        <p>We collect minimal data. Page views are counted using a salted, daily-rotating hash of network and browser details — no raw IP addresses are stored and no advertising profiles are built. Search terms entered on this site are stored (without identifiers) for up to 14 days to compute on-site trending topics.</p>
        <p>The admin area uses a single strictly-necessary session cookie. Readers are not required to log in. If you contact us, we use your details only to reply.</p>
      </>
    ),
  },
  terms: {
    title: "Terms of Use",
    body: (
      <>
        <p>Content is provided for general information. Summaries are generated automatically and may be incomplete or inaccurate; rely on the original publisher&apos;s report for authoritative information.</p>
        <p>Publisher names, headlines, images and trademarks belong to their owners. Do not scrape or republish this site&apos;s content in bulk.</p>
      </>
    ),
  },
  disclaimer: {
    title: "Disclaimer",
    body: (
      <>
        <p>{name} aggregates information from external sources and provides AI-generated summaries. We do not independently verify reports. A story being covered by several outlets does not make it true; it only means several outlets reported it.</p>
        <p>Nothing on this site is financial, legal or medical advice.</p>
      </>
    ),
  },
  "editorial-policy": {
    title: "Editorial Policy",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>Summaries use only the headline and excerpt supplied by the publisher; the AI is instructed never to add facts, quotes or statistics, and outputs are automatically checked for numbers or quotations that do not appear in the source.</li>
          <li>Claims are attributed to their source and uncertainty is preserved.</li>
          <li>&ldquo;Breaking&rdquo; is applied only when multiple independent outlets report a story within a short window, or when a human editor marks it. Nothing is labelled &ldquo;confirmed&rdquo; by AI.</li>
          <li>Stories with a single source are labelled &ldquo;Developing · single source&rdquo;.</li>
          <li>&ldquo;Trending&rdquo; reflects activity on this platform only and is not a measure of importance.</li>
          <li>Images come from publisher feeds or are replaced by neutral placeholders.</li>
        </ul>
      </>
    ),
  },
};

export function generateStaticParams() {
  return [...Object.keys(PAGES), "sources"].map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const t = page === "sources" ? "Sources" : PAGES[page]?.title;
  return t ? pageMetadata({ title: t, description: `${t} — ${name}`, path: `/${page}` }) : {};
}

export default async function StaticPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;

  if (page === "sources") {
    await connection();
    const sources = await safe(getPublicSources, []);
    return (
      <div className="container-page max-w-3xl py-8">
        <h1 className="section-title text-3xl">Sources</h1>
        <p className="mt-2 text-muted">Publishers we currently collect headlines from. Inclusion is not an endorsement of accuracy.</p>
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          {sources.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 p-3">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">{categoryName(s.category)}{s.website && <> · <a className="text-brand hover:underline" href={s.website} target="_blank" rel="noopener noreferrer">website</a></>}</span>
            </li>
          ))}
          {sources.length === 0 && <li className="p-4 text-muted">No sources configured yet.</li>}
        </ul>
      </div>
    );
  }

  const p = PAGES[page];
  if (!p) notFound();
  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="section-title text-3xl">{p.title}</h1>
      <div className="mt-4 space-y-4 leading-relaxed text-ink/90">{p.body}</div>
      <p className="mt-8 text-sm"><Link href="/" className="text-brand hover:underline">← Back to home</Link></p>
    </div>
  );
}
