import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { NEWS_TAG } from "@/lib/queries";
import { runIngestion } from "@/services/ingestion/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Pro); lower on Hobby

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run unauthenticated
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await runIngestion();
  revalidateTag(NEWS_TAG); // refresh cached homepage/category queries immediately
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}

export const GET = handle; // Vercel Cron issues GET
export const POST = handle;
