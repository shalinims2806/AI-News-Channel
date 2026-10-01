import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { TickerSlot } from "@/components/TickerSlot";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} — AI-summarized news`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.tagline,
  openGraph: { siteName: siteConfig.name, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: siteConfig.name }] } },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f8f6" }, { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.defaultLanguage} suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
          <Header name={siteConfig.name} social={siteConfig.social} />
          <Suspense fallback={null}><TickerSlot /></Suspense>
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
