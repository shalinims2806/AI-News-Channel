import Link from "next/link";
import { FOOTER_LINKS, siteConfig } from "@/config/site";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page py-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row">
          <div className="max-w-md">
            <p className="font-serif text-2xl font-extrabold">{siteConfig.name}</p>
            <p className="mt-2 text-sm text-muted">{siteConfig.tagline}</p>
            <SocialLinks links={siteConfig.social} className="-ml-2 mt-3" />
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            {FOOTER_LINKS.map((l) => <Link key={l.href} href={l.href} className="text-muted hover:text-brand">{l.label}</Link>)}
          </nav>
        </div>
        <p className="mt-8 rounded-lg bg-bg p-4 text-xs leading-relaxed text-muted">
          <strong className="text-ink">Disclaimer:</strong> {siteConfig.name} aggregates headlines and short excerpts from external publishers and
          provides automatically generated AI summaries. Summaries may contain errors and are not a substitute for the original reporting.
          All articles remain the property of their respective publishers; always refer to the linked original source.
        </p>
        <p className="mt-4 text-xs text-muted">© {new Date().getFullYear()} {siteConfig.name}. All rights reserved. Source names, logos and content belong to their respective owners.</p>
      </div>
    </footer>
  );
}
