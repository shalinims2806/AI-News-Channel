# AI News Channel

Automated AI news platform: fetches headlines from RSS/news APIs on a schedule, de-duplicates and groups stories, classifies and summarizes them with an LLM (or an extractive fallback), publishes automatically, and optionally posts to Telegram. Next.js 15 · React 19 · TypeScript · Tailwind · Prisma · PostgreSQL.

## Pipeline

```
SOURCE (RSS / NewsAPI)          services/ingestion/feeds.ts     timeout, retry+backoff, 429 handling, invalid-feed handling, SSRF guard
  → FETCH (4 sources in parallel; one failing source never blocks the rest, health logged)
  → VALIDATE                    pipeline.ts                     title/link/date checks, max age, future-date clamp
  → DEDUPLICATE                 normalize.ts + dedupe.ts        canonical URL (DB unique) → normalized headline → token similarity → headline+excerpt similarity
       same story, other outlet → attached to the primary story ("Covered by N sources"), no AI cost
  → AI CLASSIFY + SUMMARIZE     services/ai/*                   category, headline, 2–4 sentence summary, key points, tags, reading time
       grounding check          numbers/quotes not in the source ⇒ output rejected ⇒ extractive fallback
  → STORE + PUBLISH             status=PUBLISHED automatically
  → TRENDING                    trending.ts                     recency-weighted tags + on-site views + on-site searches
  → WEBSITE UPDATE              revalidateTag("news") + client polling (/api/news/latest) shows "N new stories" without reload
  → TELEGRAM                    services/telegram.ts            only if configured; max 5/run; skips stories older than 6h
```

Honesty rules built in: "Breaking" is applied only when ≥ `BREAKING_MIN_SOURCES` independent outlets carry a story within `BREAKING_WINDOW_HOURS`, or an admin marks it. Single-source stories are labelled "Developing · single source". The AI never decides confirmation. Only headline + a ≤500-char feed excerpt are stored — never full article text.

## Local development

Prerequisites: Node 20+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # fill DATABASE_URL, AUTH_SECRET (32+ chars), ADMIN_EMAIL, ADMIN_PASSWORD (12+ chars), CRON_SECRET
npx prisma migrate deploy     # or: npm run db:migrate (dev, creates new migrations)
npm run db:seed               # categories, admin user, default RSS sources, fictional sample stories
npm run dev                   # http://localhost:3000   admin: /admin
npm run ingest                # run one live ingestion now (or use "Run ingestion now" in the admin)
npm run worker                # optional: local scheduler (INGEST_INTERVAL_CRON, default every 10 min)
npm test                      # unit tests (dedupe, grounding, URL canonicalisation, heuristics)
```

Sample data: `SEED_SAMPLE_DATA=false npm run db:seed` skips the fictional stories. Sample publishers are stored as disabled sources and can be deleted in the admin.

## Environment variables

See [.env.example](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SITE_NAME`, `SITE_URL`, `SITE_TAGLINE`, `CONTACT_EMAIL` | Branding / canonical URLs |
| `INSTAGRAM_URL`, `FACEBOOK_URL`, `TELEGRAM_URL` | Social links (single source of truth; icons hidden when empty) |
| `AUTH_SECRET` | Signs admin session JWTs (32+ chars) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin, created by the seed script only |
| `CRON_SECRET` | Bearer token required by `/api/cron/ingest` (endpoint refuses to run without it) |
| `AI_PROVIDER` | `heuristic` (default, no key, extractive), `openai`, `anthropic` |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | LLM credentials; `AI_BASE_URL` allows any OpenAI-compatible endpoint |
| `MAX_AI_PER_RUN` | Cap on LLM calls per ingestion run (cost control); remaining items get extractive summaries and are upgraded on later runs |
| `NEWS_API_KEY` | For sources of type `newsapi` (key is sent as a header server-side) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional auto-posting; the bot must be admin of the channel |

All secrets are server-side only; nothing is exposed with `NEXT_PUBLIC_`.

## Source configuration

Admin → Sources (add / test / enable / disable / remove, set category and reliability rating), or insert rows in `sources`:

```json
{ "name": "Source Name", "url": "https://example.com/feed.xml", "category": "technology", "enabled": true }
```

Types: `rss` (RSS/Atom, including Google News RSS search feeds) and `newsapi`. New API types are added in `feeds.ts` (`fetchSource`) without touching the pipeline. Do not scrape search-result pages. Respect each publisher's feed terms.

## API setup

* **OpenAI**: `AI_PROVIDER=openai`, `AI_API_KEY=sk-…` (default model `gpt-4o-mini`).
* **Anthropic**: `AI_PROVIDER=anthropic`, `AI_API_KEY=…` (default `claude-haiku-4-5-20251001`).
* **Telegram**: create a bot with @BotFather → add it as admin of your channel → set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (`@channelname`).
* **NewsAPI** (optional): get a key, set `NEWS_API_KEY`, add a source of type `newsapi`, e.g. `https://newsapi.org/v2/top-headlines?country=in&category=technology`.

## Deployment

**Vercel + managed Postgres (Neon / Supabase / Vercel Postgres)**

1. Create the database; set all env vars in the Vercel project (use the pooled connection string for `DATABASE_URL`).
2. Run once from your machine against the production DB: `npx prisma migrate deploy && npm run db:seed`.
3. Deploy. [vercel.json](vercel.json) registers `GET /api/cron/ingest` every 10 minutes; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Sub-daily crons require a Pro plan; on Hobby use an external scheduler (cron-job.org, GitHub Actions) that calls the endpoint with the same header.
4. Adjust `maxDuration` in `src/app/api/cron/ingest/route.ts` to your plan's limit and lower `MAX_AI_PER_RUN` if runs time out.

**Self-hosted / Docker**: `docker build -t ainews .`, run migrations as a release step (`npx prisma migrate deploy`), start the web container, and run `npm run worker` (same image/code) as a second process for the scheduler.

Scheduler options, pick one: Vercel Cron (default) · `npm run worker` · any external cron hitting `/api/cron/ingest`. Overlapping runs are prevented by a DB lock.

## Project structure

```
prisma/            schema.prisma, migrations/, seed.ts
src/config/        site.ts (brand, social links, nav), categories.ts
src/lib/           db, auth/session, queries (cached DTOs), seo, rate-limit, labels, utils
src/services/
  ai/              provider interface, OpenAI/Anthropic/heuristic providers, prompts, grounding guard
  ingestion/       feeds (adapters), normalize, dedupe, pipeline, trending
  telegram.ts      optional channel posting
  sample-data.ts   fictional dev fixtures (run through the real pipeline)
src/app/           pages (home, latest, breaking, category, news/[slug], search, static pages),
                   admin/ (dashboard, articles, sources, server actions), api/ (news, cron, health),
                   sitemap.ts, robots.ts, feed.xml
src/components/    cards, live feed, ticker, header/footer, share buttons, ...
scripts/           worker.ts (scheduler), ingest-once.ts
tests/             unit tests
```

## Security notes

* Admin: bcrypt-hashed passwords, HS256 JWT in an httpOnly/sameSite cookie (12h), middleware gate **and** `requireAdmin()` in every admin page/action, login rate limiting with constant-time failure path, server actions (Next's built-in origin checks).
* Source URLs are restricted to public http(s) hosts. The in-memory rate limiter suits a single instance; swap in Redis/Upstash for multi-instance deployments.
* Image hosts are open (`next.config.mjs`) because feeds reference many CDNs; restrict `remotePatterns` if you ingest from a fixed publisher set.

## Known gaps / next steps

* Search uses case-insensitive `ILIKE`; for large datasets add a `pg_trgm` GIN index or Postgres full-text search.
* UI is English-only; `language` fields, per-source language and language-aware AI prompts are in place for Tamil/Hindi/Malayalam/Telugu/Kannada.
* Social-engagement signals for trending are not wired (no data source).
* Newsletter sign-up is not implemented (Telegram CTA only).
