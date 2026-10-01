import { NextResponse } from "next/server";
import { getTrendingTopics } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const topics = await getTrendingTopics(8);
    return NextResponse.json({ topics, note: "Trending on this platform" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ topics: [] }, { status: 503 });
  }
}
