import { NextResponse } from "next/server";
import { getBreaking } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getBreaking(8);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}
