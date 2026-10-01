import { categoryName } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { errMsg, sleep, truncate } from "@/lib/utils";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function telegramConfig(): Promise<{ token: string; chatId: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  let chatId = process.env.TELEGRAM_CHAT_ID || "";
  try {
    const s = await db.telegramSetting.findUnique({ where: { id: 1 } });
    if (s && !s.enabled) return null; // admin switched it off
    if (s?.chatId) chatId = s.chatId;
  } catch { /* fall back to env */ }
  return chatId ? { token, chatId } : null;
}

export function buildTelegramMessage(a: { title: string; summary: string; category: string; slug: string; isBreaking?: boolean }) {
  const cat = categoryName(a.category);
  const head = a.isBreaking ? "🚨 BREAKING" : `📰 NEW ${cat.toUpperCase()} NEWS`;
  const url = `${siteConfig.url}/news/${a.slug}`;
  return `${head}\n\n<b>${esc(a.title)}</b>\n\n${esc(truncate(a.summary, 320))}\n\n<i>AI-generated summary · ${esc(cat)}</i>\nRead more:\n${url}`;
}

/** Sends one article to the configured channel. Silently no-ops when Telegram isn't configured. */
export async function notifyTelegram(article: { id: string; title: string; summary: string; category: string; slug: string; isBreaking?: boolean }): Promise<boolean> {
  const cfg = await telegramConfig();
  if (!cfg) return false;
  const already = await db.socialPost.findFirst({ where: { articleId: article.id, platform: "telegram", ok: true } });
  if (already) return false;

  let error: string | undefined;
  let externalId: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: cfg.chatId, text: buildTelegramMessage(article), parse_mode: "HTML", disable_web_page_preview: false }),
        signal: AbortSignal.timeout(15000),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        externalId = String(json.result?.message_id ?? "");
        error = undefined;
        break;
      }
      error = `Telegram ${res.status}: ${json.description ?? "error"}`;
      if (res.status === 429) {
        await sleep(Math.min((json.parameters?.retry_after ?? 3) * 1000, 20000));
        continue;
      }
      break; // 4xx other than 429 won't succeed on retry
    } catch (e) {
      error = errMsg(e);
      await sleep(1000 * (attempt + 1));
    }
  }
  // Never log the token; only the error text.
  await db.socialPost.create({ data: { articleId: article.id, platform: "telegram", ok: !error, externalId, error: error?.slice(0, 300) } }).catch(() => {});
  return !error;
}
