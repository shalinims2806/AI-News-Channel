"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATEGORY_SLUGS } from "@/config/categories";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NEWS_TAG } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { clientIp, errMsg, slugify } from "@/lib/utils";
import { assertPublicUrl, fetchSource } from "@/services/ingestion/feeds";
import { runIngestion } from "@/services/ingestion/pipeline";
import { computeTrending } from "@/services/ingestion/trending";

const refresh = () => {
  revalidateTag(NEWS_TAG);
  revalidatePath("/admin", "layout");
};

// Compared against when the email is unknown so response timing does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// ---------------------------------------------------------------- auth

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const ip = clientIp(await headers());
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || password.length > 200) return { error: "Invalid email or password." };

  const user = await db.user.findUnique({ where: { email } }).catch(() => null);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Invalid email or password." };

  const token = await signSession({ uid: user.id, email: user.email, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------------------------------------------------------------- articles

const articleSchema = z.object({
  title: z.string().trim().min(5).max(300),
  summary: z.string().trim().min(10).max(2000),
  category: z.enum(CATEGORY_SLUGS as [string, ...string[]]),
  status: z.enum(["PUBLISHED", "HIDDEN", "DRAFT"]),
  keyPoints: z.string().default(""),
  tags: z.string().default(""),
});

export async function updateArticleAction(id: string, _prev: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  await requireAdmin();
  const parsed = articleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = parsed.data;
  const tagNames = [...new Set(d.tags.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const slug = slugify(name, 40);
    const t = await db.tag.upsert({ where: { slug }, update: {}, create: { slug, name: name.slice(0, 40) } });
    tagIds.push(t.id);
  }
  await db.$transaction([
    db.articleTag.deleteMany({ where: { articleId: id } }),
    db.article.update({
      where: { id },
      data: {
        title: d.title,
        summary: d.summary,
        category: d.category,
        status: d.status,
        keyPoints: d.keyPoints.split("\n").map((k) => k.trim()).filter(Boolean).slice(0, 8),
        isBreaking: formData.get("isBreaking") === "on",
        breakingManual: true, // admin has decided; automation won't override
        isFeatured: formData.get("isFeatured") === "on",
        aiAttempts: 99, // human-edited: never overwrite with a later AI retry
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    }),
  ]);
  refresh();
  return { ok: true };
}

async function patchArticle(id: string, data: Record<string, unknown>) {
  await requireAdmin();
  await db.article.update({ where: { id }, data });
  refresh();
}

export async function toggleHiddenAction(id: string, hide: boolean) {
  // Hiding a primary hides its grouped reports too, so the story vanishes consistently.
  await requireAdmin();
  await db.article.updateMany({ where: { OR: [{ id }, { primaryId: id }] }, data: { status: hide ? "HIDDEN" : "PUBLISHED" } });
  refresh();
}
export async function setBreakingAction(id: string, value: boolean) {
  await patchArticle(id, { isBreaking: value, breakingManual: true });
}
export async function setFeaturedAction(id: string, value: boolean) {
  await patchArticle(id, { isFeatured: value });
}
export async function deleteArticleAction(id: string) {
  await requireAdmin();
  await db.article.delete({ where: { id } });
  refresh();
}

export async function reprocessArticleAction(id: string) {
  await requireAdmin();
  const { processArticleText } = await import("@/services/ai");
  const a = await db.article.findUnique({ where: { id } });
  if (!a) return;
  const ai = await processArticleText({ title: a.originalTitle, excerpt: a.contentExcerpt ?? "", sourceName: a.sourceName, language: a.language, categoryHint: (CATEGORY_SLUGS as string[]).includes(a.category) ? (a.category as (typeof CATEGORY_SLUGS)[number]) : "other" }, a.id);
  await db.article.update({
    where: { id },
    data: { title: ai.headline, summary: ai.summary, keyPoints: ai.keyPoints, category: ai.category, readingTime: ai.readingTime, aiProcessed: ai.aiProcessed, aiProvider: ai.provider },
  });
  refresh();
}

// ---------------------------------------------------------------- sources

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().url().max(500),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  type: z.enum(["rss", "newsapi"]).default("rss"),
  category: z.enum(CATEGORY_SLUGS as [string, ...string[]]),
  language: z.string().trim().min(2).max(5).default("en"),
  reliability: z.enum(["unrated", "reviewed", "trusted"]).default("unrated"),
});

export async function addSourceAction(_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  await requireAdmin();
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  try {
    assertPublicUrl(parsed.data.url);
    await db.source.create({ data: { ...parsed.data, website: parsed.data.website || null, enabled: true } });
  } catch (e: any) {
    return { error: e?.code === "P2002" ? "A source with this URL already exists." : errMsg(e) };
  }
  refresh();
  return { ok: true };
}

export async function toggleSourceAction(id: string, enabled: boolean) {
  await requireAdmin();
  await db.source.update({ where: { id }, data: { enabled, ...(enabled ? { failureCount: 0 } : {}) } });
  refresh();
}

export async function updateSourceAction(id: string, formData: FormData) {
  await requireAdmin();
  const category = String(formData.get("category"));
  const reliability = String(formData.get("reliability"));
  if (!(CATEGORY_SLUGS as string[]).includes(category) || !["unrated", "reviewed", "trusted"].includes(reliability)) return;
  await db.source.update({ where: { id }, data: { category, reliability } });
  refresh();
}

export async function deleteSourceAction(id: string) {
  await requireAdmin();
  await db.source.delete({ where: { id } }); // articles keep their source_name/source_url (FK is SET NULL)
  refresh();
}

export interface TestResult { ok: boolean; count?: number; sample?: string[]; error?: string; ms?: number }

export async function testSourceAction(input: { url: string; type: string }): Promise<TestResult> {
  await requireAdmin();
  const started = Date.now();
  try {
    assertPublicUrl(input.url);
    const feed = await fetchSource({ url: input.url, type: input.type === "newsapi" ? "newsapi" : "rss", name: "test" });
    return { ok: true, count: feed.items.length, sample: feed.items.slice(0, 3).map((i) => i.title), ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: errMsg(e).slice(0, 300), ms: Date.now() - started };
  }
}

// ---------------------------------------------------------------- operations

export async function runIngestionAction(): Promise<{ text: string }> {
  await requireAdmin();
  const s = await runIngestion();
  refresh();
  if (s.skipped) return { text: `Skipped: ${s.skipped}` };
  const failed = s.sources.filter((x) => !x.ok).length;
  return { text: `Done in ${(s.durationMs / 1000).toFixed(1)}s — ${s.created} new, ${s.grouped} grouped, ${s.duplicates} duplicates, ${s.invalid} rejected, ${failed} source(s) failed.` };
}

export async function recomputeTrendingAction() {
  await requireAdmin();
  await computeTrending();
  refresh();
}

export async function saveTelegramSettingAction(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const chatId = String(formData.get("chatId") ?? "").trim().slice(0, 100) || null;
  await db.telegramSetting.upsert({ where: { id: 1 }, update: { enabled, chatId }, create: { id: 1, enabled, chatId } });
  revalidatePath("/admin");
}
