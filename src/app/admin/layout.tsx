import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) return <div className="container-page py-10">{children}</div>;
  return (
    <div className="container-page py-6">
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line pb-3">
        <span className="font-serif text-lg font-bold">{siteConfig.name} · Admin</span>
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/admin" className="hover:text-brand">Dashboard</Link>
          <Link href="/admin/articles" className="hover:text-brand">Articles</Link>
          <Link href="/admin/sources" className="hover:text-brand">Sources</Link>
          <Link href="/" className="text-muted hover:text-brand" target="_blank">View site ↗</Link>
        </nav>
        <form action={logoutAction} className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span>{session.email}</span>
          <button className="btn-ghost !px-3 !py-1">Sign out</button>
        </form>
      </div>
      {children}
    </div>
  );
}
