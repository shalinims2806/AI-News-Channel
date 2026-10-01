import bcrypt from "bcryptjs";
import { CATEGORIES } from "../src/config/categories";
import { db } from "../src/lib/db";
import { processEntries } from "../src/services/ingestion/pipeline";
import { computeTrending } from "../src/services/ingestion/trending";
import { SAMPLE_ENTRIES } from "../src/services/sample-data";

/** Default live feeds. All enabled = false except a few; run "Test" in the admin UI before enabling more. */
const LIVE_SOURCES = [
  { name: "BBC News – World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", website: "https://www.bbc.com/news", category: "world", enabled: true },
  { name: "BBC News – Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", website: "https://www.bbc.com/news", category: "technology", enabled: true },
  { name: "BBC News – Science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", website: "https://www.bbc.com/news", category: "science", enabled: true },
  { name: "BBC News – Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", website: "https://www.bbc.com/news", category: "business", enabled: true },
  { name: "BBC News – Entertainment", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", website: "https://www.bbc.com/news", category: "entertainment", enabled: true },
  { name: "The Hindu – National", url: "https://www.thehindu.com/news/national/feeder/default.rss", website: "https://www.thehindu.com", category: "india", enabled: true },
  { name: "The Hindu – Tamil Nadu", url: "https://www.thehindu.com/news/national/tamil-nadu/feeder/default.rss", website: "https://www.thehindu.com", category: "tamil-nadu", enabled: true },
  { name: "The Hindu – Sport", url: "https://www.thehindu.com/sport/feeder/default.rss", website: "https://www.thehindu.com", category: "sports", enabled: true },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", website: "https://techcrunch.com", category: "technology", enabled: true },
  { name: "TechCrunch – AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", website: "https://techcrunch.com", category: "ai", enabled: true },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", website: "https://arstechnica.com", category: "technology", enabled: true },
  { name: "Google News – AI (India)", url: "https://news.google.com/rss/search?q=artificial+intelligence&hl=en-IN&gl=IN&ceid=IN:en", website: "https://news.google.com", category: "ai", enabled: false },
  { name: "Google News – Tamil Nadu", url: "https://news.google.com/rss/search?q=Tamil+Nadu&hl=en-IN&gl=IN&ceid=IN:en", website: "https://news.google.com", category: "tamil-nadu", enabled: false },
];

async function main() {
  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { slug: c.slug }, update: { name: c.name, sortOrder: c.sortOrder }, create: c });
  }

  const email = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (email && password.length >= 12) {
    await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "Admin", passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
    });
    console.log(`Admin user ready: ${email}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD (>= 12 chars) not set: no admin user created.");
  }

  for (const s of LIVE_SOURCES) {
    await db.source.upsert({ where: { url: s.url }, update: {}, create: { ...s, reliability: "reviewed", type: "rss", language: "en" } });
  }

  if (process.env.SEED_SAMPLE_DATA !== "false") {
    // Sample publishers exist as disabled sources so the FK is satisfied and they never get fetched.
    const byPublisher = new Map<string, Awaited<ReturnType<typeof db.source.upsert>>>();
    for (const e of SAMPLE_ENTRIES) {
      if (byPublisher.has(e.publisher)) continue;
      const src = await db.source.upsert({
        where: { url: `https://${e.publisher.toLowerCase().replace(/[^a-z]/g, "")}.example.com/feed` },
        update: {},
        create: { name: e.publisher, url: `https://${e.publisher.toLowerCase().replace(/[^a-z]/g, "")}.example.com/feed`, category: e.category, enabled: false, notes: "Sample data source (fictional). Safe to delete.", reliability: "unrated" },
      });
      byPublisher.set(e.publisher, src);
    }
    const entries = SAMPLE_ENTRIES.map((e) => ({ source: byPublisher.get(e.publisher)!, item: { ...e.item, publisher: e.publisher } }))
      .sort((a, b) => b.item.publishedAt!.getTime() - a.item.publishedAt!.getTime());
    // Runs through the REAL pipeline (validate → dedupe → AI/heuristic → store). No Telegram in seed.
    const counters = await processEntries(entries, false);
    await computeTrending();
    console.log("Sample data:", counters);
  }
  console.log("Seed complete.");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
