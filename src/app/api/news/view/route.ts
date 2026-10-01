import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sha1 } from "@/lib/server-utils";
import { clientIp } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Records one view per visitor per article per 30 minutes. Visitors are stored as a salted daily hash. */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|preview|monitor/i.test(ua)) return NextResponse.json({ ok: true });
  if (!rateLimit(`view:${ip}`, 120, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || id.length > 40) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const day = new Date().toISOString().slice(0, 10);
    const visitor = sha1(`${process.env.AUTH_SECRET ?? ""}|${day}|${ip}|${ua}`).slice(0, 24);
    const recent = await db.articleView.findFirst({
      where: { articleId: id, visitor, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
      select: { id: true },
    });
    if (!recent) {
      await db.$transaction([
        db.articleView.create({ data: { articleId: id, visitor } }),
        db.article.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 }); // analytics must never surface errors to readers
  }
}
