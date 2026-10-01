"use client";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { FacebookIcon, TelegramIcon, WhatsAppIcon, XIcon } from "./icons";

/** Uses each network's public share-intent URL: no accounts, tokens or SDKs involved. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, Icon: WhatsAppIcon },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, Icon: XIcon },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { window.prompt("Copy this link:", url); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this story">
      <span className="text-sm font-semibold text-muted">Share</span>
      {links.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand hover:text-brand">
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button onClick={copy} aria-label="Copy link" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand">
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy Link"}
      </button>
    </div>
  );
}
