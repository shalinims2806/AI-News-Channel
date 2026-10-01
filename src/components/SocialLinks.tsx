import type { SocialLinks as Links } from "@/config/site";
import { FacebookIcon, InstagramIcon, TelegramIcon } from "./icons";

/** Renders only the networks that have a URL configured (INSTAGRAM_URL / FACEBOOK_URL / TELEGRAM_URL). */
export function SocialLinks({ links, className = "", size = "h-5 w-5" }: { links: Links; className?: string; size?: string }) {
  const items = [
    { href: links.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: links.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: links.telegram, label: "Telegram", Icon: TelegramIcon },
  ].filter((i) => i.href);
  if (!items.length) return null;
  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {items.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-line/60 hover:text-brand"
          >
            <Icon className={size} />
          </a>
        </li>
      ))}
    </ul>
  );
}
