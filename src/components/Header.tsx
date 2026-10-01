"use client";
import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS, type SocialLinks as Links } from "@/config/site";
import { SocialLinks } from "./SocialLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ name, social }: { name: string; social: Links }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setOpen(false); setSearching(false); }, [pathname]);
  useEffect(() => { if (searching) inputRef.current?.focus(); }, [searching]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <button className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-line/60 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="inline-block h-6 w-1.5 rounded-sm bg-brand" aria-hidden />
          {name}
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {NAV_ITEMS.map((n) => (
            <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition hover:bg-line/50 ${isActive(n.href) ? "text-brand" : "text-muted hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {searching ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}
              role="search"
              className="flex items-center"
            >
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news…" aria-label="Search news" className="field h-9 w-40 sm:w-64" onKeyDown={(e) => e.key === "Escape" && setSearching(false)} />
            </form>
          ) : null}
          <button onClick={() => setSearching((s) => !s)} aria-label="Search" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-line/60 hover:text-ink">
            {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <ThemeToggle />
          <SocialLinks links={social} className="hidden sm:flex" />
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-bg lg:hidden">
          <ul className="container-page grid grid-cols-2 gap-1 py-3">
            {NAV_ITEMS.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={`block rounded-md px-3 py-2 text-sm font-medium ${isActive(n.href) ? "bg-brand/10 text-brand" : "hover:bg-line/50"}`}>{n.label}</Link>
              </li>
            ))}
          </ul>
          <div className="container-page pb-3 sm:hidden"><SocialLinks links={social} /></div>
        </nav>
      )}
    </header>
  );
}
