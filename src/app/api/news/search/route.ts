import { NextResponse } from "next/server";
import { searchArticles } from "@/lib/queries";
import { clientIp } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!rateLimit(`search:${clientIp(req.headers)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const sp = new URL(req.url).searchParams;
  try {
    const result = await searchArticles({
      q: sp.get("q")?.slice(0, 100) ?? "",
      category: sp.get("category") || undefined,
      source: sp.get("source") || undefined,
      range: sp.get("range") || undefined,
      page: Number(sp.get("page")) || 1,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
  }
}
