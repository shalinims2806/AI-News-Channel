import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/services/ai";
import { telegramConfig } from "@/services/telegram";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { RunIngestionButton } from "./RunIngestionButton";
import { recomputeTrendingAction, saveTelegramSettingAction } from "./actions";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function Dashboard() {
  await requireAdmin();
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const week = new Date(now - 7 * 86400_000);
  const day = new Date(now - 86400_000);
  const pub = { status: "PUBLISHED" as const, primaryId: null };

  const [total, today, thisWeek, activeSources, failedReqs, failingSources, topViewed, trending, aiLogs, aiPending, aiDone, lastFetch, recentErrors, tgSetting, tg, tgFailed] = await Promise.all([
    db.article.count({ where: pub }),
    db.article.count({ where: { ...pub, fetchedAt: { gte: startOfDay } } }),
    db.article.count({ where: { ...pub, fetchedAt: { gte: week } } }),
    db.source.count({ where: { enabled: true } }),
    db.sourceFetchLog.count({ where: { ok: false, createdAt: { gte: day } } }),
    db.source.findMany({ where: { enabled: true, lastStatus: "error" }, select: { id: true, name: true, lastError: true, failureCount: true } }),
    db.article.findMany({ where: pub, orderBy: { viewCount: "desc" }, take: 5, select: { id: true, slug: true, title: true, viewCount: true } }),
    db.trendingTopic.findMany({ orderBy: { score: "desc" }, take: 8 }),
    db.aiProcessingLog.groupBy({ by: ["ok", "fallback"], where: { createdAt: { gte: day } }, _count: { _all: true } }),
    db.article.count({ where: { ...pub, aiProcessed: false } }),
    db.article.count({ where: { ...pub, aiProcessed: true } }),
    db.sourceFetchLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.sourceFetchLog.findMany({ where: { ok: false }, orderBy: { createdAt: "desc" }, take: 5, include: { source: { select: { name: true } } } }),
    db.telegramSetting.findUnique({ where: { id: 1 } }),
    telegramConfig(),
    db.socialPost.count({ where: { ok: false, createdAt: { gte: day } } }),
  ]);

  const provider = getProvider();
  const aiOk = aiLogs.filter((l) => l.ok).reduce((s, l) => s + l._count._all, 0);
  const aiFail = aiLogs.filter((l) => !l.ok).reduce((s, l) => s + l._count._all, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title text-3xl">Dashboard</h1>
        <RunIngestionButton />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total articles" value={total} />
        <Stat label="Today" value={today} />
        <Stat label="This week" value={thisWeek} />
        <Stat label="Active sources" value={activeSources} hint={lastFetch ? `Last fetch ${timeAgo(lastFetch.createdAt)}` : "No fetches yet"} />
        <Stat label="Failed requests (24h)" value={<span className={failedReqs ? "text-alert" : ""}>{failedReqs}</span>} hint={`${failingSources.length} source(s) currently failing`} />
        <Stat label="AI provider" value={provider.name} hint={provider.model ?? "extractive, no LLM"} />
        <Stat label="AI calls (24h)" value={`${aiOk} ok / ${aiFail} failed`} hint={`${aiDone} articles AI-summarized · ${aiPending} extractive`} />
        <Stat label="Telegram" value={tg ? "Configured" : "Off"} hint={tgFailed ? `${tgFailed} failed posts (24h)` : tg ? "Auto-posting new stories" : "Set TELEGRAM_BOT_TOKEN + CHAT_ID"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Most viewed articles</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {topViewed.map((a) => (
              <li key={a.id} className="flex justify-between gap-3"><Link className="hover:text-brand" href={`/news/${a.slug}`}>{a.title}</Link><span className="shrink-0 text-muted">{a.viewCount} views</span></li>
            ))}
            {!topViewed.length && <li className="text-muted">No data yet.</li>}
          </ol>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-bold">Trending topics</h2>
            <form action={recomputeTrendingAction}><button className="text-xs font-semibold text-brand hover:underline">Recompute</button></form>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trending.map((t) => <span key={t.id} className="chip">{t.topic} · {t.score.toFixed(1)}</span>)}
            {!trending.length && <span className="text-sm text-muted">No data yet.</span>}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Failing sources</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {failingSources.map((s) => <li key={s.id}><span className="font-semibold">{s.name}</span> <span className="text-muted">({s.failureCount} in a row)</span><br /><span className="text-xs text-alert">{s.lastError}</span></li>)}
            {!failingSources.length && <li className="text-muted">All enabled sources are healthy.</li>}
          </ul>
          {recentErrors.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Recent errors</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">{recentErrors.map((e) => <li key={e.id}>{formatDateTime(e.createdAt)} · {e.source.name}: {e.error}</li>)}</ul>
            </>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Telegram posting</h2>
          <form action={saveTelegramSettingAction} className="mt-3 space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={tgSetting?.enabled ?? true} /> Post new stories automatically</label>
            <label className="block">Chat / channel override (optional)
              <input name="chatId" defaultValue={tgSetting?.chatId ?? ""} placeholder="@yourchannel (defaults to TELEGRAM_CHAT_ID)" className="field mt-1" />
            </label>
            <button className="btn-ghost">Save</button>
            <p className="text-xs text-muted">The bot token is only read from the environment and is never shown or stored in the database.</p>
          </form>
        </section>
      </div>
    </div>
  );
}
