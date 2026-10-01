import { NextResponse } from "next/server";
import { isCategorySlug } from "@/config/categories";
import { getSince } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Lightweight endpoint polled by the homepage to show "N new stories" without a page reload. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const since = new Date(sp.get("since") ?? "");
  if (isNaN(since.getTime())) return NextResponse.json({ error: "invalid 'since'" }, { status: 400 });
  const category = sp.get("category") ?? undefined;
  if (category && !isCategorySlug(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
  try {
    const items = await getSince(since, category);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}
